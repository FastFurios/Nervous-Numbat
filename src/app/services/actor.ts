// ****************************************************************************************
//      ACTOR
// ****************************************************************************************

import { CanvasObject, Point, Line, LineSegment, Box, Vector, Intersection } from "./geometry"
import { randomInRange } from "./helpers"
import { RgbColor, cDefaultColor  } from "./color"
import { ActorGroup } from "./actorGroup"
import { Log } from "./log"
import { SystemExecParms } from "../main-canvas/main-canvas"


export const cOpacity = 0.1
export const cActorDotRadius = 1
//const cContextMargin = 0.4

export enum Halo {
    on  = "on",
    off = "off"
}

enum Mode {
    stickToCloserVertex = "stick to closer vertex",
    aimForFartherVertex = "aim for farther vertex"
}

export class Actor implements CanvasObject {
    public  p:                  Point 
    public  observee1:          Actor | undefined
    public  observee2:          Actor | undefined

    private triangleQualityLog: Log = new Log()
    private halo                    = Halo.off
    private mode                    = Mode.stickToCloserVertex

    static newRandomizedActor(ctx: CanvasRenderingContext2D, id: string, startBox: Box, sysExecParms: SystemExecParms, color: RgbColor = cDefaultColor): Actor {
        const x = randomInRange(startBox.lowerLeft.x, startBox.upperRight.x) 
        const y = randomInRange(startBox.lowerLeft.y, startBox.upperRight.y) 
        return new Actor(ctx, id, new Point(ctx, x, y), sysExecParms, color)
    }

    constructor(public ctx: CanvasRenderingContext2D, public id: string, p: Point, public sysExecParms: SystemExecParms, public color: RgbColor = cDefaultColor) {
        this.p = p
//      console.log(`Actor${this.id}.constructor(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
    }
    private get twoDefinedObservees(): boolean {
        return this.observee1 != undefined && this.observee2 != undefined
    }
    private get observeesEdge(): LineSegment {
        if (!this.twoDefinedObservees) throw(`## Actor ${this.id} is missing defined obervees`)
        return new LineSegment(this.ctx, this.observee1!.p, this.observee2!.p)
    }
    private newPositionTowardsVertex(otherActGrps: ActorGroup[]): Point {
        let targetVertex: Point
        if (this.observee1!.p.equalsTo(this.observee2!.p))
            targetVertex = this.observee1!.p
        else {
            const twoVertices   = this.observeesEdge.equilateralVertices
            const closestVertex = this.p.closerTo(twoVertices)
            const fartherVertex = closestVertex == twoVertices[0] ? twoVertices[1] : twoVertices[0]
            targetVertex = this.mode == Mode.aimForFartherVertex
                        || otherActGrps.map(ag => ag.covers(this.p)).reduce((d, e) => d || e, false) // detection of collision with other actor group
                                ? fartherVertex 
                                : closestVertex  
        }
        const vectorToVertex   = new Vector(targetVertex.x - this.p.x, targetVertex.y - this.p.y)
        const scaleFactor      = vectorToVertex.length <= this.sysExecParms.run.maxMoveDistance ? 1 : this.sysExecParms.run.maxMoveDistance / vectorToVertex.length  
        const targetP          = this.p.add(vectorToVertex.scale(scaleFactor))
        const wayToTargetP     = new LineSegment(this.ctx, this.p, targetP)
        const wayIntersectsObserveesEdge = wayToTargetP.intersects(this.observeesEdge)
        if (wayIntersectsObserveesEdge.type != "none") { // my move crosses the observees line
            this.mode = Mode.stickToCloserVertex
        }
        return targetP
    }
    public newPosition(otherActGrps: ActorGroup[]): Point {
        if (this.sysExecParms.strategy.aimAtFartherVertexOnEnduredPoorQuality && this.triangleQualityLog.areTooManyLoggedQualitiesBelow(this.sysExecParms.strategy.poorTriangleQualityThreshold)) {
            this.mode = Mode.aimForFartherVertex 
            this.triangleQualityLog = new Log()
         } 
        return this.newPositionTowardsVertex(otherActGrps)
    }
    public setPosition(p: Point): void {
        this.triangleQualityLog.push(this.triangleQuality)
        this.p = p 
    }  
    public assign2SpecificObservees(a1: Actor, a2: Actor): void {
        this.observee1      = a1
        this.observee2      = a2
    }
    public assign2RandomObservees(actors: Actor[]): void {
        const restOfActors1 = actors.filter(a => a !== this)
        this.observee1      = restOfActors1[randomInRange(0, restOfActors1.length)]
        const restOfActors2 = restOfActors1.filter(a => a !== this.observee1)
        this.observee2      = restOfActors2[randomInRange(0, restOfActors2.length)]
//      console.log(`${this.id}: just assigned observees ${this.observee1.id} and ${this.observee2.id}}`)
    }
    public isFrozen(): boolean {
//      return this.triangleQualityLog.avgStandardDeviation < 0.01 // cStandardDeviationThreshold
        return this.triangleQualityLog.lastLoggedQuality ? this.triangleQualityLog.lastLoggedQuality > 0.98 : false
    }
    public turnHaloOn(): void {
        this.halo = Halo.on
    }
    public turnHaloOff(): void {
        this.halo = Halo.off
    }
    public haloStatus(): Halo {
        return this.halo
    }
    private visualizeEdgesAndFillTriangle(ctx: CanvasRenderingContext2D): void {
        //console.log(`Actor${this.id}.visualizeEdgesAndFillTriangle(): observees= ${this.observee1?.id} and ${this.observee2?.id}`)

        if (!this.observee1 || !this.observee2) return
        ctx.beginPath()
        ctx.moveTo(this.observee1.p.x, this.observee1.p.y)
        ctx.lineTo(this.p.x, this.p.y)
        ctx.lineTo(this.observee2.p.x, this.observee2.p.y)

        if (this.mode == Mode.aimForFartherVertex) ctx.setLineDash([10, 5]) // [line length, space length]

        ctx.strokeStyle = this.color.rgbString
        ctx.stroke();
        ctx.setLineDash([])
        ctx.closePath()
        ctx.fillStyle = this.color.rgbWithOpacityString
        ctx.fill()
    }
    get triangleEdges(): [LineSegment, LineSegment, LineSegment]{
        if (!this.twoDefinedObservees) throw(`## Actor ${this.id} is missing defined obervees`)
        return [new LineSegment(this.ctx, this.p,            this.observee1!.p),
                new LineSegment(this.ctx, this.observee1!.p, this.observee2!.p),
                new LineSegment(this.ctx, this.observee2!.p, this.p)]
    }
    public covers(p: Point): boolean {
        if (!this.observee1 || !this.observee2) return false
        const verticalThruP = Line.newLineFromPointAndVector(this.ctx, new Point(this.ctx, p.x, 0), new Vector(0, 1))
        const edgeIntersecs: Intersection[] = []
        for (let e of this.triangleEdges) {
            const is: Intersection = e.intersects(verticalThruP)
            if (is.type == "point") edgeIntersecs.push(is)  // && is.p?.isInBox(e.base, e.p2) 
        }
        if (edgeIntersecs.length != 2) return false
        const isYmin = Math.min(...edgeIntersecs.map(is => is.p!.y))  
        const isYmax = Math.max(...edgeIntersecs.map(is => is.p!.y))  
        return  isYmin < p.y && p.y < isYmax
    }
    get triangleQuality(): number {
        if (!this.observee1 || !this.observee2) return 0
        const lenAtoB = new LineSegment(this.ctx, this.p,           this.observee1.p).length
        const lenBtoC = new LineSegment(this.ctx, this.observee1.p, this.observee2.p).length
        const lenCtoA = new LineSegment(this.ctx, this.observee2.p, this.p).length
        const sumLen = lenAtoB + lenBtoC + lenCtoA
        if (sumLen == 0) return 0 // no real triangle any longer as it is a point; we deem this bad, s it gets a 0
        const avgEdgeLen = sumLen / 3
        const deltaAtoB = Math.abs(lenAtoB - avgEdgeLen)
        const deltaBtoC = Math.abs(lenBtoC - avgEdgeLen)
        const deltaCtoA = Math.abs(lenCtoA - avgEdgeLen)
        const sumDelta = deltaAtoB + deltaBtoC + deltaCtoA
        return ((sumLen - sumDelta) / sumLen)**4
    }
    public updateParameters(sep: SystemExecParms): void {
        console.log(`actor.updateParameter(): intervall= ${this.sysExecParms.run.intervalMillisecs} millisecs`)
        this.sysExecParms = sep
    }

    public visualize(ctx: CanvasRenderingContext2D): void {
//      console.log(`Actor${this.id}.visualize(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
        let actorLabel: string = ""
        if (this.sysExecParms.display.showActorId)              actorLabel  = `${this.id}`
        if (this.sysExecParms.display.showActorTriangleQuality) actorLabel += ` ${(this.triangleQuality * 100).toFixed(0)}%` 
        if (this.sysExecParms.display.showActorObservees)       actorLabel += `=> ${this.observee1?.id} and ${this.observee2?.id}`

        this.p.visualize(ctx, this.color, this.halo, actorLabel)
//      console.log(`Actor${this.id}.visualize(): this.sysExecParms.display.showTriangle= ${this.sysExecParms.display.showTriangle}`)
        if (this.sysExecParms.display.showTriangle) this.visualizeEdgesAndFillTriangle(ctx)
    }
    public toString(): string {
        return `${this.id}: ${this.p}; observees= ${this.observee1?.id}(${this.observee1?.p.x.toFixed(0)}, ${this.observee1?.p.y.toFixed(0)}) and ${this.observee2?.id}(${this.observee2?.p.x}, ${this.observee2?.p.y})` 
    }
}
