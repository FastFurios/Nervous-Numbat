import { Injectable } from '@angular/core'
import { Observable, Subscription, interval } from 'rxjs'

import { SystemExecParms } from "../main-canvas/main-canvas"
import { Point } from "./geometry"
import { ColorSchemes } from "./color"
import { Actor } from "./actor"
import { ActorGroup } from "./actorGroup"
import { Configuration, ConfigActorGroupDynamic, ConfigActorGroup, ConfigPoint, cVirtalGridHeight, cVirtalGridWidth, CoordinateType } from "./api"



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
    public  maxIterations?:         number
    public  intervalMillisecs?:     number
    public  time$?:                 Observable<void>
    private timeSubscription?:      Subscription 
    public  doneIterations:         number                                  = 0
    private iterationMode:          IterationMode                           = IterationMode.paused
    private showActorJourney:       boolean                                 = false
    public  colorSchemes                                                    = new ColorSchemes(1)  // 1 as default
                                 
    
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
    }
    public updateExecParms(sep: SystemExecParms): void {
        this.maxIterations          = sep.run.maxIterations
        this.intervalMillisecs      = sep.run.intervalMillisecs
        Point.boundaryMode          = sep.run.boundaryMode      
        this.showActorJourney       = sep.display.showActorJourney
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
            this.actGrps.forEach(ag => ag.moveActors())
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

// ---------------------------------------------------------------------------------------
//      export the system and it's state
// ---------------------------------------------------------------------------------------

    public exportedAsConfiguration(): Configuration {
        return new Configuration(this.id!, this.actGrps.map(ag => ConfigActorGroupDynamic.newFromSystem(ag)))
    }
}