import { Injectable } from '@angular/core'
import { Observable, Subscription, interval } from 'rxjs'

import { SystemExecParms, WheelMotion } from "../main-canvas/main-canvas"
import { Point, Box, MapperBtwRealAndCanvas, mapperBtwRealAndCanvas, canvasCenter } from "./geometry"
import { ColorSchemes, RgbColor } from "./color"
import { Actor } from "./actor"
import { ActorGroup } from "./actorGroup"
import { Configuration, ConfigActorGroupDynamic, ConfigActorGroup, ConfigPoint, cVirtalGridHeight, cVirtalGridWidth, CoordinateType } from "./api"
import { cActorPickMargin  } from "./parameters"



// --- ITERATION CONTROL ----------------------------------------------------------------------

/* no export */ export enum IterationMode {
    iterating = "iterating",
    paused    = "paused",
    dead      = "dead"
}

// ****************************************************************************************
//      SYSTEM SERVICE
// ****************************************************************************************

@Injectable({
  providedIn: 'root',
})
export class System {
    public  id:                     string | undefined                      = undefined
    public  configActGrps:          ConfigActorGroup[]                      = []
    public  actGrps:                ActorGroup[]                            = []
//  private ctx:                    CanvasRenderingContext2D | undefined    = undefined
    public  maxIterations?:         number
    public  intervalMillisecs?:     number
    private showActorJourney?:      boolean
//  private focusAndFollowActGrp0?: boolean
    public  time$?:                 Observable<void>
    private timeSubscription?:      Subscription 
    public  doneIterations:         number                                  = 0
    private iterationMode:          IterationMode                           = IterationMode.paused
    public  pickedActor:            Actor | null | undefined                = undefined
    public  colorSchemes                                                    = new ColorSchemes(1)  // 1 as default
    public  mbrc?:                  MapperBtwRealAndCanvas
    public  centerOfView?:          Point                                   
    private zoom?:                  number  // zoom > 1: zoomed in ; z < 1: zommed out
                                 
    
    constructor() { }

// ---------------------------------------------------------------------------------------
//      create the system and setting parameters
// ---------------------------------------------------------------------------------------

    private mappedConfigPointOntoCanvas(ctx: CanvasRenderingContext2D, cp: ConfigPoint, coordType: CoordinateType): Point {
        if (!ctx) throw Error("System.fitInto(): missing canvas context.")
        if (coordType == CoordinateType.relative)    
            return new Point(ctx, ctx.canvas.width * cp.x / cVirtalGridWidth, ctx.canvas.height * cp.y / cVirtalGridHeight) 
        return new Point(ctx, cp.x, cp.y) 

    }

    public set configuration(configuration: Configuration) {
        this.id = configuration.id
        this.configActGrps = configuration.actorGroups
    }

    public initialize(ctx: CanvasRenderingContext2D, systemExecParms: SystemExecParms): void {
        if (this.configActGrps.length < 1) throw Error(`System.initialize(): too few actor groups (${this.configActGrps.length}).`)
        if (!systemExecParms)              throw Error("System.initialize(): missing systemExecParms.")
        if (!ctx)                          throw Error("System.initialize(): missing canvas context.")
//      ctx          = ctx

        this.stopIterating()
        this.actGrps = []
        for (let cag of this.configActGrps) {
            const actors: Actor[] = cag.actors.map(ca => new Actor(ctx!, ca.id, this.mappedConfigPointOntoCanvas(ctx, ca.p!, cag.coordType), systemExecParms!))
            for (let ca of cag.actors) {
                const actor: Actor | undefined = actors.find(a => a.id == ca.id)
                if (!actor) throw Error(`system.initialize(): could not find ${ca.id} in actors`)
                const obs1 : Actor | undefined = actors.find(a => a.id == ca.observee1id)
                const obs2 : Actor | undefined = actors.find(a => a.id == ca.observee2id)
                if (!obs1 || !obs2) throw Error(`system.initialize(): missing observee(s) for actor ${ca.id}`)
                actor.assign2SpecificObservees(obs1, obs2)
            }
            const ag = new ActorGroup(ctx, cag.id, actors, cag.mode)
            this.actGrps.push(ag)
            this.colorSchemes = new ColorSchemes(this.actGrps.length)
            this.actGrps.forEach(ag => ag.applyColorScheme(this.colorSchemes.nextColorScheme()))
        }
        this.home(ctx)
    }
    public updateExecParms(sep: SystemExecParms): void {
        this.maxIterations          = sep.run.maxIterations
        this.intervalMillisecs      = sep.run.intervalMillisecs
        Point.boundaryMode          = sep.run.boundaryMode      
        this.showActorJourney       = sep.display.showActorJourney
//      this.focusAndFollowActGrp0  = sep.display.focusAndFollowActGrp0 
//      if (this.focusAndFollowActGrp0) this.centerOfView = this.actGrps[0].centerPoint()
        this.actGrps.forEach(ag => ag.updateParameters(sep, this.mbrc!.realToCanvas))
    }
    public initializeCanvas(ctx: CanvasRenderingContext2D) {
        this.clearCanvas(ctx)
        this.visualize(ctx)
    }
    private setMapperBtwRealAndCanvas(ctx: CanvasRenderingContext2D): void {
        this.mbrc = mapperBtwRealAndCanvas(ctx!, this.centerOfView!, this.zoom!) 
    }

// ---------------------------------------------------------------------------------------
//      run the system
// ---------------------------------------------------------------------------------------

    public stopIterating(): void {
        this.iterationMode = IterationMode.paused
    }

    public runResumeIterating(ctx: CanvasRenderingContext2D): Observable<number> | undefined {
        if (this.iterationMode == IterationMode.iterating) return undefined
        this.iterationMode = IterationMode.iterating
        if (this.actGrps[0].isFrozen()) throw(`${this.actGrps[0].id} is frozen.`)
        const time$ = interval(this.intervalMillisecs)
        this.timeSubscription = time$.subscribe((now) => {
            if (this.iterationMode != IterationMode.iterating || now > this.maxIterations!) { 
                this.timeSubscription?.unsubscribe()
                this.time$ = undefined
            }
            this.actGrps.forEach(ag => ag.calculateNewActorPositions(this.actGrps.filter(ag2 => ag2 != ag)))
            this.actGrps.forEach(ag => ag.moveActors(this.mbrc!.realToCanvas))
            this.setMapperBtwRealAndCanvas(ctx)
            this.visualize(ctx)
        })
        return time$
    }

    private nearbyActorsInRange(p: Point, margin: number): Actor[] {
        return this.actGrps.flatMap(ag => ag.nearbyActors(p, margin))
    }

    public closestActorInRange(p: Point, margin: number): Actor | null {
        const actorsInRange = this.nearbyActorsInRange(p, margin)
        if (actorsInRange.length  < 1) return null
        if (actorsInRange.length == 1) return actorsInRange[0]
        const minDistance = actorsInRange.map(a => p.distanceTo(a.p)).reduce((e, f) => e < f ? e : f)
        return actorsInRange.find(a => p.distanceTo(a.p) == minDistance) || actorsInRange[0]
    }

    private visualizeCanvasInReal(ctx: CanvasRenderingContext2D): void {
        const canvasLowerLeft  = new Point(ctx!, 0, 0, "Canvas-lower-left")
        const canvasUpperRight = new Point(ctx!, ctx!.canvas.width, ctx!.canvas.height, "Canvas-upper-right")//      const canvasBoxScaled = new Box(ctx!, "canvas-scaled", canvasLowerLeftScaled, canvasUpperRightScaled, new RgbColor(0, 0, 255))
        const canvasBox = new Box(ctx!, "canvas", canvasLowerLeft, canvasUpperRight, new RgbColor(0, 0, 255))
        canvasBox.visualize(this.mbrc!.realToCanvas)
    }

    public visualize(ctx: CanvasRenderingContext2D): void {
        if (!this.showActorJourney) this.clearCanvas(ctx)
        this.visualizeCanvasInReal(ctx)
        this.actGrps.forEach(ag => ag.visualize(this.mbrc!.realToCanvas))
    }
    
    public clearCanvas(ctx: CanvasRenderingContext2D): void {
        ctx!.clearRect(0, 0, ctx!.canvas.width, ctx!.canvas.height)
    }

    public home(ctx: CanvasRenderingContext2D): void {
        this.centerOfView = canvasCenter(ctx)
        this.zoom         = 1
        this.setMapperBtwRealAndCanvas(ctx)
        this.visualize(ctx)
    }

    public focusOnFirstActGrp(ctx: CanvasRenderingContext2D): void {
        this.centerOfView = this.actGrps[0].centerPoint()
        this.setMapperBtwRealAndCanvas(ctx)
        this.visualize(ctx)
    }
// ---------------------------------------------------------------------------------------
//      export the system and it's state
// ---------------------------------------------------------------------------------------

    public exportedAsConfiguration(): Configuration {
        return new Configuration(this.id!, this.actGrps.map(ag => ConfigActorGroupDynamic.newFromSystem(ag)))
    }

// ---------------------------------------------------------------------------------------
//      handle canvas UI events
// ---------------------------------------------------------------------------------------

    public actorSelected(ctx: CanvasRenderingContext2D, rp: Point): Actor | undefined {  // x, y are real Points 
        this.pickedActor = this.closestActorInRange(rp, cActorPickMargin / this.zoom!)
        if (this.pickedActor) {
            this.pickedActor.turnHaloOn() // actor selected, turn halo on, do not change center of view
            this.visualize(ctx)
            return this.pickedActor
        }
        this.centerOfView = rp // no actor selected, so set center of view to the clicked point
        return undefined
    }

    public handleActorMove(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        if (!this.pickedActor) return
        this.pickedActor.setPosition(this.mbrc!.canvasToReal(new Point(ctx!, x, y)))
        this.visualize(ctx)
    }

    public handleActorDrop(ctx: CanvasRenderingContext2D): void {
        this.pickedActor?.turnHaloOff()
        this.pickedActor = undefined
        this.visualize(ctx)
    }

    public reset(ctx: CanvasRenderingContext2D, systemExecParms: SystemExecParms): void {
        this.clearCanvas(ctx)
    }

    public handleWheelMotion(ctx: CanvasRenderingContext2D, motion: WheelMotion): void {
        this.zoom! *= motion == WheelMotion.up ? 2 : 0.5
        this.setMapperBtwRealAndCanvas(ctx)
        this.visualize(ctx)
    }
}