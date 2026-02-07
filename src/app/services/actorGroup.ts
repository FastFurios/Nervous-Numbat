// ****************************************************************************************
//      ACTOR GROUP
// ****************************************************************************************

import { CanvasObject, Point, Box } from "./geometry"
import { powerFunctionFactory, powerCurveBloatedListOf } from "./helpers"
import { RgbColor, ColorScheme } from "./color"
import { Actor } from "./actor"
//import { cShowActorGroupIdAndQuality, cMinTriangleQuality, cShowOneActorOnlyWithTheGivenAgIndex } from "./parameters"
import { Log } from "./log"
import { SystemExecParms } from "../main-canvas/main-canvas"

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
    public visualize() {
//      console.log(`ActorGroup: "${this.id}".visualize(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
//      console.log(`ActorGroup: "${this.id}".visualize(): this.showActorJourney= ${this.showActorJourney}`)
        if (this.showActorJourney && this.showOneActorOnlyWithTheGivenAgIndex >= 0) {
            this.actors[this.showOneActorOnlyWithTheGivenAgIndex || 0].visualize(this.ctx)
            return
        }
        this.actors.forEach(a => a.visualize(this.ctx))
        if (!this.showActorGroupIdAndQuality) return 
        this.visualizeIdAndQuality()
    }
    private visualizeIdAndQuality(remark: string = ""): void {
        const ctr = this.centerPoint()
        this.ctx.beginPath()
        this.ctx.moveTo(ctr.x, ctr.y)
        this.ctx.closePath() 
        this.ctx.fillStyle = new RgbColor(100, 100, 100).rgbString
        this.ctx.textAlign = "center"
        this.ctx.font = "12px Arial"
        const expanse = this.expanse(this.centerPoint())
        const avgTriangleQuality = this.avgTriangleQuality
        const performance = expanse * avgTriangleQuality 
        this.ctx.fillText(`${this.id} ${(avgTriangleQuality * 100).toFixed(0)}% ${(this.expanse(this.centerPoint())).toFixed(0)}: [${(expanse * avgTriangleQuality).toFixed(0)}] ${remark}`, ctr.x, ctr.y)
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
    public get avgTriangleQuality(): number {
        return this.actors.map(a => a.triangleQuality).reduce((q1, q2) => q1 + q2) / this.actors.length
    }
    public isFrozen(): boolean {
//      console.log(`${this.id} is frozen? ${this.actors.map(a => a.isFrozen()).reduce((a, b) => a && b, true)}`)
        return this.actors.map(a => a.isFrozen()).reduce((a, b) => a && b, true)
    }
    public toString(): string {
        return `Actor Group ${this.id}: #actors= ${this.actors.length}` 
    }
    public updateParameters(sep: SystemExecParms) {
        console.log(`actorGroup.updateParameter(): propagating parameter updates...`)
        this.showActorJourney = sep.display.showActorJourney
        this.showOneActorOnlyWithTheGivenAgIndex = sep.display.showOneActorOnlyWithTheGivenAgIndex || 0
        this.showActorGroupIdAndQuality = sep.display.showActorGroupIdAndQuality 
        this.minTriangleQuality = sep.run.minTriangleQuality
        this.actors.forEach(a => a.updateParameters(sep))
        this.visualize()
    } 
    abstract calculateNewActorPositions(otherActGrps: ActorGroup[], iteration: number): void
    abstract moveActors(): void
}

export class ActorGroupDynamic extends ActorGroup {
    static newRandomizedActGrp(ctx: CanvasRenderingContext2D, id: string, numActors: number, startBox: Box, sep: SystemExecParms, powerCurveFactor: number = 0) {
        const ag = new ActorGroupDynamic(ctx, id, [], sep, powerCurveFactor)
        ag.randomizeActors(startBox, numActors, sep)
//      console.log(`${ag.id}: bloated list: ${powerCurveBloatedListOf(ag.actors, powerFunctionFactory(cPowerCurveFactor, ag.actors.length)).map(a => a.id)}`)
        ag.assign2RandomObservees(powerCurveBloatedListOf(ag.actors, powerFunctionFactory(powerCurveFactor, ag.actors.length)))
//      console.log(powerCurveBloatedListOf(ag.actors, powerFunctionFactory(-cPowerCurveFactor, ag.actors.length)).map(e => e.id))
//      console.log(ag.actors.map(e => `${e.id}=>[${e.observee1?.id}, ${e.observee2?.id}]\n`))
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
//      console.log(bloatedActorsList.map(a => a.id))
        this.actors.forEach(a => a.assign2RandomObservees(bloatedActorsList))
//      console.log(this.actors.map(e => `${e.id}=>[${e.observee1?.id}, ${e.observee2?.id}]\n`))
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
    public moveActors(): void {
        for (let i = 0; i < this.actors.length; i++) {
            this.actors[i].setPosition(this.calculatedNewPositions[i])
        }
        this.visualize()
    }
}

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

