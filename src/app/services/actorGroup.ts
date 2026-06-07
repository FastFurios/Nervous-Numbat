// ****************************************************************************************
//      ACTOR GROUP
// ****************************************************************************************

import { signal, WritableSignal } from '@angular/core'
import { CanvasObjectDisplayParms, Coordinate, Point, Box, MapperRealToCanvas } from "./geometry"
import { RgbColor, ColorScheme, cDefaultColor } from "./color"
import { Actor } from "./actor"
import { Barrier } from "./barrier"
import { Log } from "./log"
import { SystemRunParms, SystemDisplayParms } from '../control-panel/control-panel'


export enum ActorGroupMode {
    dynamic = "dynamic",
    static  = "static"
}

type ActGrpStats = {
    expanse:            number
    avgTriangleQuality: number
    performance:        number 
}



// ****************************************************************************************
//      abstract ACTOR GROUP
// ****************************************************************************************

export class ActorGroup implements CanvasObjectDisplayParms {
    private showActorJourney: boolean 
    private showOneActorOnlyWithTheGivenAgIndex: number
    private showActorGroupIdAndQuality: boolean
    public  minTriangleQuality: number = 1
    public  log = new Log(1000)
    private calculatedNewPositions: Point[] = []
    public  actGrpStats: WritableSignal<ActGrpStats> = signal({
        expanse:            0,
        avgTriangleQuality: 0,
        performance:        0 
    })
    
    constructor(public id: string, public actors: Actor[] = [], public mode: ActorGroupMode, public colorScheme?: ColorScheme) { 
        this.showActorJourney = false
        this.showOneActorOnlyWithTheGivenAgIndex = -1
        this.showActorGroupIdAndQuality = false
        this.updateActGrpStats()
    }
    public covers(p: Point): boolean {
        return this.actors.map(a => a.covers(p)).reduce((d, e) => d || e, false)
    }
    public applyColorScheme(colorScheme: ColorScheme): void {
        this.colorScheme = colorScheme
        this.actors.forEach(a => a.color = RgbColor.newRandomColor(colorScheme))
    } 
    public visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, sdp: SystemDisplayParms) {
//      console.log(`ActorGroup: "${this.id}".visualize(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
//      console.log(`ActorGroup: "${this.id}".visualize(): this.showActorJourney= ${this.showActorJourney}`)
        
        if (this.showActorJourney && this.showOneActorOnlyWithTheGivenAgIndex >= 0) {
            this.actors[this.showOneActorOnlyWithTheGivenAgIndex || 0].visualize(ctx, m2c, sdp)
            return
        }
        this.actors.forEach(a => a.visualize(ctx, m2c, sdp))
        if (!this.showActorGroupIdAndQuality) return 
        this.visualizeIdAndQuality(ctx, m2c)
    }
    public updateActGrpStats(): void {
        const _expanse = this.expanse(this.centerPoint())
        this.actGrpStats.set({
            expanse:            _expanse,
            avgTriangleQuality: this.avgTriangleQuality,
            performance:        _expanse * this.avgTriangleQuality 
        })
    }
    private visualizeIdAndQuality(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, remark: string = ""): void {
        const ctr = m2c(this.centerPoint().toPoint(ctx))
        /*this.*/ctx.beginPath()
        /*this.*/ctx.moveTo(ctr.x, ctr.y)
        /*this.*/ctx.closePath() 
        /*this.*/ctx.fillStyle = new RgbColor(100, 100, 100).rgbString
        /*this.*/ctx.textAlign = "center"
        /*this.*/ctx.font = "12px Arial"
/*
        const expanse = this.expanse(this.centerPoint())
        const avgTriangleQuality = this.avgTriangleQuality
        const performance = expanse * avgTriangleQuality 
*/
//      this.ctx.fillText(`${this.id} ${(avgTriangleQuality * 100).toFixed(0)}% ${(this.expanse(this.centerPoint())).toFixed(0)}: [${(expanse * avgTriangleQuality).toFixed(0)}] ${remark}`, ctr.x, ctr.y)
        /*this.*/ctx.fillText(`${this.id} qlty=${(this.actGrpStats().avgTriangleQuality * 100).toFixed(0)}% exp=${this.actGrpStats().expanse.toFixed(0)}: perf=${this.actGrpStats().performance.toFixed(0)} ${remark}`, ctr.x, ctr.y)
    } 
    public nearbyActors(p: Point, margin: number): Actor[] {
        return this.actors.filter(a => p.nearby(a.p, margin))
    }
    public centerPoint(): Point {
        return new Point(this.actors.map(a => a.p.x).reduce((acc, curr) => acc + curr, 0) / this.actors.length,
                              this.actors.map(a => a.p.y).reduce((acc, curr) => acc + curr, 0) / this.actors.length)
    }
    public expanse(c: Coordinate): number {
        return this.actors.map(a => a.p.distanceTo(c)).reduce((acc, curr) => acc + curr, 0) / this.actors.length
    } 
    public boxAround(ctx: CanvasRenderingContext2D): Box {
        const leftMost  = this.actors.map(a => a.p.x).reduce((min, x) => x < min ? x : min)
        const rightMost = this.actors.map(a => a.p.x).reduce((max, x) => x > max ? x : max)
        const bottom    = this.actors.map(a => a.p.y).reduce((min, y) => y < min ? y : min)
        const top       = this.actors.map(a => a.p.y).reduce((max, y) => y > max ? y : max)
        const boxAround = new Box("", new Point(/*this.ctx, */leftMost, bottom), new Point(/*this.ctx, */rightMost, top), cDefaultColor) 
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
    public updateRunParameters(srp: SystemRunParms) {
//      console.log(`actorGroup.updateParameter(): propagating parameter updates...`)
//        this.showActorJourney = sdp.showActorJourney
//        this.showOneActorOnlyWithTheGivenAgIndex = sep.display.showOneActorOnlyWithTheGivenAgIndex || 0
//        this.showActorGroupIdAndQuality = sep.display.showActorGroupIdAndQuality 
        this.minTriangleQuality = srp.minTriangleQuality
        this.actors.forEach(a => a.updateRunParameters(srp))
    } 
    public addActor(a: Actor): void {
        this.actors.push(a)
    }
    public calculateNewActorPositions(otherActGrps: ActorGroup[], barriers: Barrier[]): void {
        if (this.mode != ActorGroupMode.dynamic) return
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
            this.calculatedNewPositions.push(a.newPosition(otherActGrps, barriers))
    }
    public moveActors(): void {
        if (this.mode != ActorGroupMode.dynamic) return
        for (let i = 0; i < this.actors.length; i++) {
            this.actors[i].setPosition(this.calculatedNewPositions[i])
        }
        this.updateActGrpStats()
    }
}