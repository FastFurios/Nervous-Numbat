import { Injectable, signal } from '@angular/core'
import { Observable, Subscription, from, interval } from 'rxjs'

import { CanvasSize, SystemRunParms } from "../control-panel/control-panel"
import { Point } from "./geometry"
import { ColorSchemes } from "./color"
import { Actor } from "./actor"
import { ActorGroup, ActorGroupMode } from "./actorGroup"
import { Barrier } from "./barrier"
import { Configuration, ConfigActorGroupDynamic, ConfigActorGroup, ConfigPoint, ConfigBarrier, cVirtualGridHeight, cVirtualGridWidth, CoordinateType } from "./api"
import { cDefaultCanvasWidth, cDefaultCanvasHeight } from "./parameters"

const cCanvasBorderMargin = 0
const cMaxKpiHistorySamples = 2000   // when exceeded, every 2nd sample is dropped and the sampling stride doubles; keeps memory and drawing effort bounded

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
    public  configBarriers?:        ConfigBarrier[]                         = []
    public  barriers:               Barrier[]                               = []
    public  maxIterations?:         number
    public  intervalMillisecs?:     number
    public  tact$?:                 Observable<void>
    private tactSubscription?:      Subscription 
    public  doneIterations:         number                                  = 0
    public  worldSize?:             CanvasSize                              // size of the world in real coordinates, i.e. the box spanned by the border barriers; set once at initialize
    /** number of completed iteration steps; the one and only clock all views redraw on. Notifies on every set, so re-setting 0 after a reset triggers a redraw as well */
    public  readonly step                                                   = signal(0, { equal: () => false })
    private iterationMode:          IterationMode                           = IterationMode.paused
    public  perfHistory:            number[][]                              = []  // perfHistory[i][g] = performance of dynamic actor group g at step i * kpiHistoryStride
    public  qualityHistory:         number[][]                              = []  // qualityHistory[i][g] = avg. triangle quality (0..1) of dynamic actor group g at step i * kpiHistoryStride
    public  kpiHistoryStride:       number                                  = 1
    public  perfHistoryMax:         number                                  = 0   // biggest performance value recorded so far
    private showActorJourney:       boolean                                 = false
    public  colorSchemes                                                    = new ColorSchemes(1)  // 1 as default
                                 
    constructor() { }

// ---------------------------------------------------------------------------------------
//      create the system and setting parameters
// ---------------------------------------------------------------------------------------

    private mappedConfigPointOntoCanvas(canvasSize: CanvasSize | undefined, cp: ConfigPoint): Point {
        if (!canvasSize) 
            canvasSize = { 
                width:  cDefaultCanvasWidth,
                height: cDefaultCanvasHeight
            }    
        if (cp.coordType == CoordinateType.relative)    
            return new Point(canvasSize.width * cp.x / cVirtualGridWidth, canvasSize.height * cp.y / cVirtualGridHeight) 
        else
            return new Point(cp.x, cp.y) 
    }

    public set configuration(configuration: Configuration) {
        this.id               = configuration.id
        this.configActGrps    = configuration.actorGroups
        this.configBarriers   = configuration.barriers
    }

    private addCanvasBorders(canvasSize: CanvasSize): void {
        this.barriers.push(new Barrier(new Point(cCanvasBorderMargin,                     cCanvasBorderMargin                    ), new Point(canvasSize.width - cCanvasBorderMargin, cCanvasBorderMargin                    ))),
        this.barriers.push(new Barrier(new Point(canvasSize.width - cCanvasBorderMargin,  cCanvasBorderMargin                    ), new Point(canvasSize.width - cCanvasBorderMargin, canvasSize.height - cCanvasBorderMargin)))
        this.barriers.push(new Barrier(new Point(canvasSize.width - cCanvasBorderMargin,  canvasSize.height - cCanvasBorderMargin), new Point(cCanvasBorderMargin,                    canvasSize.height - cCanvasBorderMargin))),
        this.barriers.push(new Barrier(new Point(cCanvasBorderMargin,                     canvasSize.height - cCanvasBorderMargin), new Point(cCanvasBorderMargin,                    cCanvasBorderMargin                    )))
    }

    public initialize(canvasSize: CanvasSize, systemRunParms: SystemRunParms): void {
        if (!systemRunParms)              throw Error("System.initialize(): missing systemExecParms.")

        this.stopIterating()
        this.worldSize = { ...canvasSize }
        this.barriers = []

        this.actGrps = []
        for (let cag of this.configActGrps) {
            const actors: Actor[] = cag.actors.map(ca => new Actor(ca.id, this.mappedConfigPointOntoCanvas(canvasSize, ca.p!), systemRunParms!))
            for (let ca of cag.actors) {
                const actor: Actor | undefined = actors.find(a => a.id == ca.id)
                if (!actor) throw Error(`system.initialize(): could not find ${ca.id} in actors`)
                const obs1 : Actor | undefined = actors.find(a => a.id == ca.observee1id)
                const obs2 : Actor | undefined = actors.find(a => a.id == ca.observee2id)
                if (!obs1 || !obs2) throw Error(`system.initialize(): missing observee(s) for actor ${ca.id}`)
                actor.assign2SpecificObservees(obs1, obs2)
            }
            const ag = new ActorGroup(cag.id, actors, cag.mode)
            this.actGrps.push(ag)
            this.colorSchemes = new ColorSchemes(this.actGrps.length)
            this.actGrps.forEach(ag => ag.applyColorScheme(this.colorSchemes.nextColorScheme()))
        }
        
        this.addCanvasBorders(canvasSize)

        // add any in-field barriers

      console.log("System.initialize(): this.configBarriers:")
      console.log(this.barriers)
        this.configBarriers?.forEach(cb =>this.barriers.push(new Barrier(this.mappedConfigPointOntoCanvas(canvasSize, cb.from), this.mappedConfigPointOntoCanvas(canvasSize, cb.to))))

        this.perfHistory       = []
        this.qualityHistory    = []
        this.kpiHistoryStride  = 1
        this.perfHistoryMax    = 0
        this.recordKpis(0)
        this.step.set(0)
    }

    public get dynamicActGrps(): ActorGroup[] {
        return this.actGrps.filter(ag => ag.mode == ActorGroupMode.dynamic)
    }

    private recordKpis(step: number): void {
        if (step % this.kpiHistoryStride != 0) return
        const perfs = this.dynamicActGrps.map(ag => ag.actGrpStats().performance)
        this.perfHistory.push(perfs)
        this.qualityHistory.push(this.dynamicActGrps.map(ag => ag.actGrpStats().avgTriangleQuality))
        this.perfHistoryMax = Math.max(this.perfHistoryMax, ...perfs)
        if (this.perfHistory.length > cMaxKpiHistorySamples) {
            this.perfHistory       = this.perfHistory.filter((_, i) => i % 2 == 0)
            this.qualityHistory    = this.qualityHistory.filter((_, i) => i % 2 == 0)
            this.kpiHistoryStride *= 2
        }
    }

    public updateRunParms(srp: SystemRunParms): void {
        this.maxIterations          = srp.maxIterations
        this.intervalMillisecs      = srp.intervalMillisecs
        Point.boundaryMode          = srp.boundaryMode      
        console.log(`system.updateRunParms(): Point.boundaryMode= ${Point.boundaryMode}`)
    }

// ---------------------------------------------------------------------------------------
//      run the system
// ---------------------------------------------------------------------------------------

    public stopIterating(): void {
        this.iterationMode = IterationMode.paused
        this.tactSubscription?.unsubscribe()
        this.tact$ = undefined
    }

    public runResumeIterating(): void {
        this.iterationMode = IterationMode.iterating
        
// ! //      if (this.actGrps[0].isFrozen()) throw(`${this.actGrps[0].id} is frozen.`)
        const tact$ = interval(this.intervalMillisecs)
        this.tactSubscription = tact$.subscribe((now) => {
            if (this.iterationMode != IterationMode.iterating || now > this.maxIterations!) { 
                this.tactSubscription?.unsubscribe()
                this.tact$ = undefined
                return
            }
            this.actGrps.forEach(ag => ag.calculateNewActorPositions(this.actGrps.filter(ag2 => ag2 != ag), this.barriers))
            this.actGrps.forEach(ag => ag.moveActors(this.barriers))
            this.recordKpis(this.step() + 1)
            this.step.update(s => s + 1)
        })
    }

    public get worldCenter(): Point | undefined {
        return this.worldSize ? new Point(this.worldSize.width / 2, this.worldSize.height / 2) : undefined
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
        return new Configuration(this.id!, 
                                 this.actGrps.map(ag => ConfigActorGroupDynamic.newFromSystem(ag)), 
                                 this.barriers.map(b => new ConfigBarrier(new ConfigPoint(b.base.x, b.base.y, CoordinateType.real), new ConfigPoint(b.p2.x, b.p2.y, CoordinateType.real))))
    }
}