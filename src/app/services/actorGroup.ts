// ****************************************************************************************
//      ACTOR GROUP
// ****************************************************************************************

import { CanvasObject, Point, Box, Vector, MapperBtwRealAndCanvas, MapperRealToCanvas } from "./geometry"
import { powerFunctionFactory, powerCurveBloatedListOf } from "./helpers"
import { RgbColor, ColorScheme, cDefaultColor } from "./color"
import { Actor, Halo } from "./actor"
import { Log } from "./log"
import { SystemExecParms } from "../main-canvas/main-canvas"


// ****************************************************************************************
//      abstract ACTOR GROUP
// ****************************************************************************************

export abstract class ActorGroup implements CanvasObject {
    private showActorJourney: boolean 
    private showOneActorOnlyWithTheGivenAgIndex: number
    private showActorGroupIdAndQuality: boolean
    public  minTriangleQuality: number = 1

    constructor(public ctx: CanvasRenderingContext2D, 
                public id: string, 
                public actors: Actor[] = [], 
                public colorScheme?: ColorScheme) { 
        this.showActorJourney = false
        this.showOneActorOnlyWithTheGivenAgIndex = -1
        this.showActorGroupIdAndQuality = false
    }
    public covers(p: Point): boolean {
        return this.actors.map(a => a.covers(p)).reduce((d, e) => d || e, false)
    }
    public applyColorScheme(colorScheme: ColorScheme): void {
        this.colorScheme = colorScheme
        this.actors.forEach(a => a.color = RgbColor.newRandomColor(colorScheme))
    } 
    public mapperBtwRealAndCanvas(manualScaling: number): MapperBtwRealAndCanvas {
        const canvasBox: Box      = Box.fromCanvas(this.ctx)
        const boxAroundThis: Box  = this.boxAround()
        const scaleFactorGross    = boxAroundThis.scaleToFitInto(canvasBox)
        const scaleFactor: number = (scaleFactorGross > 1 ? 1 : scaleFactorGross) / manualScaling  
        const shiftVector: Vector = boxAroundThis.scaledBy(scaleFactor).center().vectorTo(canvasBox.center())
        const mapperRealToCanvas  = (rp: Point) => new Point(this.ctx, (rp.x * scaleFactor) + shiftVector.dx, (rp.y * scaleFactor) + shiftVector.dy)
        const mapperCanvasToReal  = (cp: Point) => new Point(this.ctx, ((cp.x - shiftVector.dx) / scaleFactor) , ((cp.y - shiftVector.dy) / scaleFactor) )
        return {
            realToCanvas: mapperRealToCanvas,
            canvasToReal: mapperCanvasToReal
        }
//      return { realToCanvas: (p: Point) => p, canvasToReal: (p: Point) => p  }
    }
    public visualize(m2c: MapperRealToCanvas) {
//      console.log(`ActorGroup: "${this.id}".visualize(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
//      console.log(`ActorGroup: "${this.id}".visualize(): this.showActorJourney= ${this.showActorJourney}`)
        
        if (this.showActorJourney && this.showOneActorOnlyWithTheGivenAgIndex >= 0) {
            this.actors[this.showOneActorOnlyWithTheGivenAgIndex || 0].visualize(m2c)
            return
        }
        this.actors.forEach(a => a.visualize(m2c))
        if (!this.showActorGroupIdAndQuality) return 
        this.visualizeIdAndQuality(m2c)
    }
    private visualizeIdAndQuality(m2c: MapperRealToCanvas, remark: string = ""): void {
        const ctr = m2c(this.centerPoint())
        this.ctx.beginPath()
        this.ctx.moveTo(ctr.x, ctr.y)
        this.ctx.closePath() 
        this.ctx.fillStyle = new RgbColor(100, 100, 100).rgbString
        this.ctx.textAlign = "center"
        this.ctx.font = "12px Arial"
        const expanse = this.expanse(this.centerPoint())
        const avgTriangleQuality = this.avgTriangleQuality
        const performance = expanse * avgTriangleQuality 
        this.ctx.fillText(`${this.id} ${this.centerPoint()} ${(avgTriangleQuality * 100).toFixed(0)}% ${(this.expanse(this.centerPoint())).toFixed(0)}: [${(expanse * avgTriangleQuality).toFixed(0)}] ${remark}`, ctr.x, ctr.y)
    } 
    public nearbyActors(p: Point, margin: number): Actor[] {
        return this.actors.filter(a => p.nearby(a.p, margin))
    }
    public centerPoint(): Point {
        return new Point(this.ctx, 
                         this.actors.map(a => a.p.x).reduce((acc, curr) => acc + curr, 0) / this.actors.length,
                         this.actors.map(a => a.p.y).reduce((acc, curr) => acc + curr, 0) / this.actors.length)
    }
    public expanse(p: Point): number {
        return this.actors.map(a => a.p.distanceTo(p)).reduce((acc, curr) => acc + curr, 0) / this.actors.length
    } 
    public boxAround(): Box {
        const leftMost  = this.actors.map(a => a.p.x).reduce((min, x) => x < min ? x : min)
        const rightMost = this.actors.map(a => a.p.x).reduce((max, x) => x > max ? x : max)
        const bottom    = this.actors.map(a => a.p.y).reduce((min, y) => y < min ? y : min)
        const top       = this.actors.map(a => a.p.y).reduce((max, y) => y > max ? y : max)
        const boxAround = new Box(this.ctx, "", new Point(this.ctx, leftMost, bottom), new Point(this.ctx, rightMost, top), cDefaultColor) 
        return boxAround
    }
    public get avgTriangleQuality(): number {
        return this.actors.map(a => a.triangleQuality).reduce((q1, q2) => q1 + q2) / this.actors.length
    }
    public isFrozen(): boolean {
        return this.actors.map(a => a.isFrozen()).reduce((a, b) => a && b, true)
    }
    public toString(): string {
        return `Actor Group ${this.id}: #actors= ${this.actors.length}` 
    }
    public updateParameters(sep: SystemExecParms, m2c: MapperRealToCanvas) {
        console.log(`actorGroup.updateParameter(): propagating parameter updates...`)
        this.showActorJourney = sep.display.showActorJourney
        this.showOneActorOnlyWithTheGivenAgIndex = sep.display.showOneActorOnlyWithTheGivenAgIndex || 0
        this.showActorGroupIdAndQuality = sep.display.showActorGroupIdAndQuality 
        this.minTriangleQuality = sep.run.minTriangleQuality
        this.actors.forEach(a => a.updateParameters(sep))
        this.visualize(m2c)
    } 
    abstract calculateNewActorPositions(otherActGrps: ActorGroup[], iteration: number): void
    abstract moveActors(m2c: MapperRealToCanvas): void
}

// ****************************************************************************************
//      ACTOR GROUP DYNAMIC
// ****************************************************************************************

export class ActorGroupDynamic extends ActorGroup {
    static newRandomizedActGrp(ctx: CanvasRenderingContext2D, id: string, numActors: number, startBox: Box, sep: SystemExecParms, powerCurveFactor: number = 0) {
        const ag = new ActorGroupDynamic(ctx, id, [], sep, powerCurveFactor)
        ag.randomizeActors(startBox, numActors, sep)
        ag.assign2RandomObservees(powerCurveBloatedListOf(ag.actors, powerFunctionFactory(powerCurveFactor, ag.actors.length)))
        return ag
    }

    public log = new Log(1000)
    private calculatedNewPositions: Point[] = []
    
    constructor(ctx: CanvasRenderingContext2D, id: string, actors: Actor[] = [], sep: SystemExecParms, public powerCurveFactor: number = 0) { 
        super(ctx, id, actors)
    }
    public addActor(a: Actor): void {
        this.actors.push(a)
    }
    public randomizeActors(startBox: Box, numActors: number, sep: SystemExecParms): void {
        for (let i = 0; i < numActors; i++)
            this.addActor(Actor.newRandomizedActor(this.ctx, `${this.id[0]}${i}`, startBox, sep))
    }    
    public assign2RandomObservees(bloatedActorsList: Actor[]): void {
        this.actors.forEach(a => a.assign2RandomObservees(bloatedActorsList))
    }
    public calculateNewActorPositions(otherActGrps: ActorGroup[], iteration: number): void {
        const qlty = this.avgTriangleQuality  
        if (qlty > this.minTriangleQuality) {
            console.log(`iterations stopped at avg. triangle quality= ${qlty}`)
            return
        }    
        this.log.push(qlty)
/*
        if (iteration % 100 == 0) console.log(`iterating ${iteration}: avgQuality= ${(qlty * 100).toFixed(0)}%`)
        if (iteration % 1000 == 0) console.log(`${this.log}`)
*/
        this.calculatedNewPositions = [] 
        for (let a of this.actors)
            this.calculatedNewPositions.push(a.newPosition(otherActGrps))
    }
    public moveActors(m2c: MapperRealToCanvas): void {
        for (let i = 0; i < this.actors.length; i++) {
            this.actors[i].setPosition(this.calculatedNewPositions[i])
        }
        this.visualize(m2c)
    }
}

// ****************************************************************************************
//      ACTOR GROUP STATIC BOX
// ****************************************************************************************

export class ActorGroupStaticBox extends ActorGroup {
    constructor(ctx: CanvasRenderingContext2D, id: string, box: Box, sep: SystemExecParms, colRgbRanges?: ColorScheme) { 
        const black = new RgbColor(0, 0, 0)
        const actors = [
            new Actor(ctx, "lowerLeft",  new Point(ctx, box.lowerLeft.x,  box.lowerLeft.y),  sep, black),
            new Actor(ctx, "upperLeft",  new Point(ctx, box.lowerLeft.x,  box.upperRight.y), sep, black),
            new Actor(ctx, "upperRight", new Point(ctx, box.upperRight.x, box.upperRight.y), sep, black),
            new Actor(ctx, "lowerRight", new Point(ctx, box.upperRight.x, box.lowerLeft.y),  sep, black)
        ]
        super(ctx, id, actors, colRgbRanges)
        actors[0].observee1 = actors[1]
        actors[0].observee2 = actors[3]
        actors[2].observee1 = actors[1]
        actors[2].observee2 = actors[3]
    }
    public calculateNewActorPositions(otherActGrps: ActorGroup[], iteration: number): void { 
        return 
    }    
    public moveActors(): void { 
        return 
    }
}

