// ****************************************************************************************
//      ACTOR
// ****************************************************************************************

import { CanvasObjectDisplayParms, Point, Line, LineSegment, Box, Vector, Intersection, MapperRealToCanvas } from "./geometry"
import { randomInRange } from "./helpers"
import { RgbColor, cDefaultColor  } from "./color"
import { ActorGroup } from "./actorGroup"
import { Barrier } from "./barrier"
import { Log } from "./log"
import { SystemRunParms, SystemDisplayParms } from "../control-panel/control-panel"

export const cOpacity = 0.1
export const cActorDotRadius = 2
//const cContextMargin = 0.4

export enum Halo {
    on  = "on",
    off = "off"
}

enum Mode {
    stickToCloserVertex = "stick to closer vertex",
    aimForFartherVertex = "aim for farther vertex"
}

export class Actor implements CanvasObjectDisplayParms {
    public  p:                  Point 
    public  observee1:          Actor | undefined
    public  observee2:          Actor | undefined

    private triangleQualityLog: Log = new Log()
    private halo                    = Halo.off
    private mode                    = Mode.stickToCloserVertex

    static newRandomizedActor(ctx: CanvasRenderingContext2D, id: string, startBox: Box, sysExecParms: SystemRunParms, color: RgbColor = cDefaultColor): Actor {
        const x = randomInRange(startBox.lowerLeft.x, startBox.upperRight.x) 
        const y = randomInRange(startBox.lowerLeft.y, startBox.upperRight.y) 
        return new Actor(id, new Point(x, y), sysExecParms, color)
    }

    constructor(public id: string, p: Point, public sysRunParms: SystemRunParms, public color: RgbColor = cDefaultColor) {
        this.p = p
//      console.log(`Actor${this.id}.constructor(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
    }
    private get twoDefinedObservees(): boolean {
        return this.observee1 != undefined && this.observee2 != undefined
    }
    private get observeesEdge(): LineSegment {
        if (!this.twoDefinedObservees) throw(`## Actor ${this.id} is missing defined obervees`)
        return new LineSegment(this.observee1!.p, this.observee2!.p)
    }
    private newPositionTowardsVertex(otherActGrps: ActorGroup[], barriers: Barrier[]): Point {
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
        const scaleFactor      = vectorToVertex.length <= this.sysRunParms.maxMoveDistance ? 1 : this.sysRunParms.maxMoveDistance / vectorToVertex.length  
        const targetP          = this.p.add(vectorToVertex.scale(scaleFactor), barriers)
        const wayToTargetP     = new LineSegment(this.p, targetP)
        const wayIntersectsObserveesEdge = wayToTargetP.intersects(this.observeesEdge)
        if (wayIntersectsObserveesEdge.type != "none") { // my move crosses the observees line
            this.mode = Mode.stickToCloserVertex
        }
        return targetP
    }
    public newPosition(otherActGrps: ActorGroup[], barriers: Barrier[]): Point {
        if (this.sysRunParms.aimAtFartherVertexOnEnduredPoorQuality && this.triangleQualityLog.areTooManyLoggedQualitiesBelow(this.sysRunParms.poorTriangleQualityThreshold)) {
            this.mode = Mode.aimForFartherVertex 
            this.triangleQualityLog = new Log()
         } 
        const aux = this.newPositionTowardsVertex(otherActGrps, barriers)
        return aux 
    }        
    public setPosition(p: Point): void {
        if (this.id == "R0") {    
        /*
            console.log("----------- check line segment intersection of 2 horizonal line segments ---------")
            console.log(new LineSegment(new Point(0,588), new Point(838, 588)).intersectsLineSegment(new LineSegment(new Point(0, 0), new Point(588, 0))))
            console.log("----------- check line segment intersection of 2  vertical line segments ---------")
            console.log(new LineSegment(new Point(838, 0), new Point(838, 588)).intersectsLineSegment(new LineSegment(new Point(0, 0), new Point(0, 588))))
            console.log("----------- check line segment intersection of a horizontal line segment with a skewed line segment ---------")
            console.log(new LineSegment(new Point(0, 100), new Point(838, -100)).intersectsLineSegment(new LineSegment(new Point(0, 0), new Point(588, 0))))
            console.log("----------- check line segment intersection of a vertical line segment with a skewed line segment ---------")
            console.log(new LineSegment(new Point(-838, 0), new Point(838, 588)).intersectsLineSegment(new LineSegment(new Point(0, 0), new Point(0, 588))))

            console.log("----------- check line segment intersection of 2 horizonal line segments ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(588, 0)).intersectsLineSegment(new LineSegment(new Point(0,588), new Point(838, 588))))
            console.log("----------- check line segment intersection of 2  vertical line segments ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(0, 588)).intersectsLineSegment(new LineSegment(new Point(838, 0), new Point(838, 588))))
            console.log("----------- check line segment intersection of a horizontal line segment with a skewed line segment ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(588, 0)).intersectsLineSegment(new LineSegment(new Point(0, 100), new Point(838, -100))))
            console.log("----------- check line segment intersection of a vertical line segment with a skewed line segment ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(0, 588)).intersectsLineSegment(new LineSegment(new Point(-838, 0), new Point(838, 588))))

            console.log("----------- check line intersection of 2 horizonal line segments ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(588, 0)).intersects(new LineSegment(new Point(0,588), new Point(838, 588))))
            console.log("----------- check line intersection of 2  vertical line segments ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(0, 588)).intersects(new LineSegment(new Point(838, 0), new Point(838, 588))))
            console.log("----------- check line intersection of a horizontal line segment with a skewed line segment ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(588, 0)).intersects(new LineSegment(new Point(0, 100), new Point(838, -100))))
            console.log("----------- check line intersection of a vertical line segment with a skewed line segment ---------")
            console.log(new LineSegment(new Point(0, 0), new Point(0, 588)).intersects(new LineSegment(new Point(-838, 0), new Point(838, 588))))

            console.log("----------- check line intersection of 2 horizonal lines ---------")
            console.log(new Line(new Point(0, 0), new Point(588, 0)).intersects(new Line(new Point(0,588), new Point(838, 588))))
            console.log("----------- check line intersection of 2  vertical lines ---------")
            console.log(new Line(new Point(0, 0), new Point(0, 588)).intersects(new Line(new Point(838, 0), new Point(838, 588))))
            console.log("----------- check line intersection of a horizontal line with a skewed line---------")
            console.log(new Line(new Point(0, 0), new Point(588, 0)).intersects(new Line(new Point(0, 100), new Point(838, -100))))
            console.log("----------- check line intersection of a vertical line with a skewed line---------")
            console.log(new Line(new Point(0, 0), new Point(0, 588)).intersects(new Line(new Point(-838, 0), new Point(838, 588))))
            console.log("----------- check line intersection of 2 line segments ---------")
*/
/*
            console.log(`Actor${this.id}.setPosition(): new LineSegment(new Point(  0, 0.46), new Point(588, 0.46)).intersectsLineSegment(new LineSegment(new Point(300, 1), new Point(300, -1))):`)
            const aux1 = new LineSegment(new Point(  0, 0.46), 
                                            new Point(588, 0.46))
                        .intersectsLineSegment(
                            new LineSegment(new Point(300, 1), 
                                            new Point(300, -1)))
            console.log(aux1)

            console.log(`Actor${this.id}.setPosition(): new LineSegment(new Point(300, 1), new Point(300, -1)).intersectsLineSegment(new LineSegment(new Point(  0, 0.46), new Point(588, 0.46))):`)
            const aux2 = new LineSegment(new Point(300, 1), 
                                            new Point(300, -1))
                        .intersectsLineSegment(
                            new LineSegment(new Point(  0, 0.46), 
                                            new Point(588, 0.46)))
            console.log(aux2)
*/
/*
            const aux2 = new LineSegment(new Point(  0, 0.47), 
                                            new Point(588, 0.47))
                        .intersectsLineSegment(
                            new LineSegment(new Point(300, 1), 
                                            new Point(301, -1)))
            console.log(`Actor${this.id}.constructor(): Actor ${this.id}: test of intersectsLineSegment(): aux2=`)
            console.log(aux2)

            const aux3 = new LineSegment(new Point(300, 1), 
                                            new Point(301, -1))
                        .intersectsLineSegment(
                            new LineSegment(new Point(  0, 0.46), 
                                            new Point(588, 0.46)))
            console.log(`Actor${this.id}.constructor(): Actor ${this.id}: test of intersectsLineSegment(): aux3=`)
            console.log(aux3)
            
            const aux4 = new LineSegment(new Point(300, 1), 
                                            new Point(301, -1))
                        .intersectsLineSegment(
                            new LineSegment(new Point(  0, 0.47), 
                                            new Point(588, 0.47)))
            console.log(`Actor${this.id}.constructor(): Actor ${this.id}: test of intersectsLineSegment(): aux4=`)
            console.log(aux4)

            throw Error (`Actor.setPosition(): ### aborted`)
*/
        }
/*
        if (p.x < 0 || p.x > 838 || p.y < 0 || p.y > 588) {
            throw Error (`Actor.setPosition(): old= ${this.p}, new= ${p} crossing canvas boundaries!`)
        } 
*/
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
    private visualizeEdgesAndFillTriangle(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas): void {
        //console.log(`Actor${this.id}.visualizeEdgesAndFillTriangle(): observees= ${this.observee1?.id} and ${this.observee2?.id}`)

        if (!this.observee1 || !this.observee2) return
        const cp  = m2c(this.p)
        const co1 = m2c(this.observee1.p)
        const co2 = m2c(this.observee2.p)
        ctx.beginPath()
        ctx.moveTo(co1.x, co1.y)
        ctx.lineTo(cp.x, cp.y)
        ctx.lineTo(co2.x, co2.y)

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
        return [new LineSegment(this.p,            this.observee1!.p),
                new LineSegment(this.observee1!.p, this.observee2!.p),
                new LineSegment(this.observee2!.p, this.p)]
    }
    public covers(p: Point): boolean {
        if (!this.observee1 || !this.observee2) return false
        const verticalThruP = Line.fromPointAndVector(new Point(p.x, 0), new Vector(0, 1))
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
        const lenAtoB = new LineSegment(this.p,           this.observee1.p).length
        const lenBtoC = new LineSegment(this.observee1.p, this.observee2.p).length
        const lenCtoA = new LineSegment(this.observee2.p, this.p).length
        const sumLen = lenAtoB + lenBtoC + lenCtoA
        if (sumLen == 0) return 0 // no real triangle any longer as it is a point; we deem this bad, s it gets a 0
        const avgEdgeLen = sumLen / 3
        const deltaAtoB = Math.abs(lenAtoB - avgEdgeLen)
        const deltaBtoC = Math.abs(lenBtoC - avgEdgeLen)
        const deltaCtoA = Math.abs(lenCtoA - avgEdgeLen)
        const sumDelta = deltaAtoB + deltaBtoC + deltaCtoA
        return ((sumLen - sumDelta) / sumLen)**4
    }
    public updateRunParameters(srp: SystemRunParms): void {
//      console.log(`actor.updateParameter(): intervall= ${this.sysExecParms.run.intervalMillisecs} millisecs`)
        this.sysRunParms = srp
    }

    public visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, sysDisplayParms: SystemDisplayParms): void {
//      console.log(`Actor${this.id}.visualize(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
        let actorLabel: string = ""
        if (sysDisplayParms.showActorId)              actorLabel  = `${this.id}`
        if (sysDisplayParms.showActorTriangleQuality) actorLabel += ` ${(this.triangleQuality * 100).toFixed(0)}%` 
        if (sysDisplayParms.showActorObservees)       actorLabel += `=> ${this.observee1?.id} and ${this.observee2?.id}`

        this.p.visualize(ctx, m2c, this.color, this.halo, actorLabel)
//      console.log(`Actor${this.id}.visualize(): this.sysExecParms.display.showTriangle= ${this.sysExecParms.display.showTriangle}`)
        if (sysDisplayParms.showTriangle) this.visualizeEdgesAndFillTriangle(ctx, m2c)
    }
    public toString(): string {
        return `${this.id}: ${this.p}; observees= ${this.observee1?.id}(${this.observee1?.p.x.toFixed(0)}, ${this.observee1?.p.y.toFixed(0)}) and ${this.observee2?.id}(${this.observee2?.p.x}, ${this.observee2?.p.y})` 
    }
}
