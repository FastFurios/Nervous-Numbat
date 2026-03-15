import { Injectable } from '@angular/core'
import { Observable, Subscription, interval } from 'rxjs'

import { SystemExecParms, WheelMotion } from "../main-canvas/main-canvas"
import { Point, Box, MapperBtwRealAndCanvas, mapperBtwRealAndCanvas, canvasCenter } from "./geometry"
import { ColorSchemes, RgbColor } from "./color"
import { Actor } from "./actor"
import { ActorGroup, ActorGroupDynamic } from "./actorGroup"
import { cActorPickMargin  } from "./parameters"
import { randomInRange, isBetween, powerFunctionFactory, powerCurveBloatedList } from "../main-canvas/library/helpers"
import { now } from "./helpers"

// ---------------------------------------------------------------------------------------
//      SYSTEM SETUP API
// ---------------------------------------------------------------------------------------

const cVirtalGridWidth  = 100
const cVirtalGridHeight = 100

// --- CONFIG POINT ----------------------------------------------------------------------
export class ConfigPoint { // virtual grid 
    static new(pUpperRight: Point, p: Point): ConfigPoint {
        return new ConfigPoint(p.x / pUpperRight.x * cVirtalGridWidth, p.y / pUpperRight.y * cVirtalGridHeight)
    } 
    constructor (public x: number, public y: number) {
    if (!isBetween(x, 0, cVirtalGridWidth))  throw Error(`ConfigPoint.constructor(): x= ${x} out of range of virtual grid.`) 
    if (!isBetween(y, 0, cVirtalGridHeight)) throw Error(`ConfigPoint.constructor(): y= ${y} out of range of virtual grid.`) 
  }
}

// --- CONFIG BOX ----------------------------------------------------------------------
export class ConfigBox {
  static new(pUpperRight: Point, b: Box): ConfigBox {
      return new ConfigBox(ConfigPoint.new(pUpperRight, b.lowerLeft), ConfigPoint.new(pUpperRight, b.upperRight))
  } 
  constructor(public lowerLeft: ConfigPoint, public upperRight: ConfigPoint) {
  }
}

// --- CONFIG ACTOR ----------------------------------------------------------------------
export class ConfigActor {
  static new(pUpperRight: Point, a: Actor): ConfigActor {
    return new ConfigActor(a.id, ConfigPoint.new(pUpperRight, a.p).x, ConfigPoint.new(pUpperRight, a.p).y, a.observee1?.id, a.observee2?.id)
  }
  static newRandomizedActor(id: string, startBox?: ConfigBox): ConfigActor {
    if (!startBox) 
      startBox = new ConfigBox(new ConfigPoint(0, 0), new ConfigPoint(cVirtalGridWidth, cVirtalGridHeight))
    const x = randomInRange(startBox.lowerLeft.x, startBox.upperRight.x) 
    const y = randomInRange(startBox.lowerLeft.y, startBox.upperRight.y) 
    return new ConfigActor(id, x, y)
  }
  public p:            ConfigPoint | undefined
  public observee1id:  string | undefined
  public observee2id:  string | undefined

  constructor(public id: string, x: number, y: number, observee1id?: string, observee2id?: string) {
    this.p = new ConfigPoint(x, y)
    this.observee1id = observee1id 
    this.observee2id = observee2id
  }
  public assign2RandomObservees(actors: ConfigActor[]): void {
      const restOfActors1 = actors.filter(a => a !== this)
      const observee1     = restOfActors1[randomInRange(0, restOfActors1.length)]
      const restOfActors2 = restOfActors1.filter(a => a !== observee1)
      const observee2     = restOfActors2[randomInRange(0, restOfActors2.length)]
      this.observee1id    = observee1.id
      this.observee2id    = observee2.id
  }
} 

// --- CONFIG ACTOR GROUP ----------------------------------------------------------------------
export class ConfigActorGroup {
  static new(pUpperRight: Point, ag: ActorGroup): ConfigActorGroup {
    return new ConfigActorGroup(ag.id, ag.actors.map(a => ConfigActor.new(pUpperRight, a)))
  }  
  static newRandomizedActGrp(id: string, numActors: number, powerCurveFactor: number = 0, startBox?: ConfigBox): ConfigActorGroup {
    const cag = new ConfigActorGroup(id, [], startBox)
    cag.randomizeActors(numActors, startBox)
    cag.assign2RandomObservees(powerCurveBloatedList(cag.actors, powerFunctionFactory(powerCurveFactor, cag.actors.length)))
    return cag
  }
 
  constructor(public id: string, public actors: ConfigActor[], public startBox?: ConfigBox) {}
 
  public addActor(actor: ConfigActor): void {
    this.actors.push(actor)
  }
  public randomizeActors(numActors: number, startBox?: ConfigBox): void {
      for (let i = 0; i < numActors; i++)
          this.addActor(ConfigActor.newRandomizedActor(`${this.id[0]}${i}`, startBox))
  }    
  public assign2RandomObservees(actors: ConfigActor[]): void {
    this.actors.forEach(a => a.assign2RandomObservees(actors))
  }
}

// --- CONFIGURATION ----------------------------------------------------------------------
export class Configuration {
    constructor(public id: string, public actorGroups: ConfigActorGroup[]) { }
}

// --------------------------------------------------------------------------------------
//     JSON Configuration   
// --------------------------------------------------------------------------------------

export type Creation_Mode = "automatic" | "explicit"

export interface JsonActor {
  id:         string
  x:          number
  y:          number
  observee1:  string
  observee2:  string
}

export interface JsonActorGroup {
  id:                 string
  creation_mode:      Creation_Mode
  topology:           JsonExplicitTopology | JsonAutomaticTopology      
}

export type JsonExplicitTopology = JsonActor[]

interface JsonPoint { 
  x: number
  y: number 
}

export interface JsonBox {
  lower_left:  JsonPoint
  upper_right: JsonPoint
}

export interface JsonAutomaticTopology {
  id:                   string
  number_actors:        number 
  power_curve_factor:   number
  start_box:            JsonBox
}

export interface JsonConfiguration {
  id: string
  actor_groups: JsonActorGroup[]
}

function configActorAsJson(ca: ConfigActor): JsonActor {
    return {
      id: ca.id,
      x:  ca.p!.x,
      y:  ca.p!.y,
      observee1: ca.observee1id!,
      observee2: ca.observee2id!
    }
}

function configActorGroupAsJson(cag: ConfigActorGroup): JsonActorGroup {
    return {
      id: cag.id,
      creation_mode: "explicit",
      topology: cag.actors.map(ca => configActorAsJson(ca))
    }
}

function configAsJson(c: Configuration): JsonConfiguration {
  return {
    id: c.id,
    actor_groups: c.actorGroups.map(ag => configActorGroupAsJson(ag))
  }
}

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
    private ctx:                    CanvasRenderingContext2D | undefined    = undefined
    public  maxIterations?:         number
    public  intervalMillisecs?:     number
    private showActorJourney?:      boolean
    private focusAndFollowActGrp0?: boolean
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

    private mappedConfigPointOntoCanvas(cp: ConfigPoint): Point {
        if (!this.ctx) throw Error("System.fitInto(): missing canvas context.")
        return new Point(this.ctx, this.ctx.canvas.width * cp.x / cVirtalGridWidth, this.ctx.canvas.height * cp.y / cVirtalGridHeight) 
    }

    public set configuration(configuration: Configuration) {
        this.id = configuration.id
        this.configActGrps = configuration.actorGroups
    }

    public initialize(ctx: CanvasRenderingContext2D, systemExecParms: SystemExecParms): void {
        if (this.configActGrps.length < 1) throw Error(`System.initialize(): too few actor groups (${this.configActGrps.length}).`)
        if (!systemExecParms)              throw Error("System.initialize(): missing systemExecParms.")
        if (!ctx)                          throw Error("System.initialize(): missing canvas context.")
        this.ctx          = ctx

        this.actGrps = []
        for (let cag of this.configActGrps) {
            const actors: Actor[] = cag.actors.map(ca => new Actor(this.ctx!, ca.id, this.mappedConfigPointOntoCanvas(ca.p!), systemExecParms!))
            for (let ca of cag.actors) {
                const actor: Actor | undefined = actors.find(a => a.id == ca.id)
                if (!actor) throw Error(`system.initialize(): could not find ${ca.id} in actors`)
                const obs1 : Actor | undefined = actors.find(a => a.id == ca.observee1id)
                const obs2 : Actor | undefined = actors.find(a => a.id == ca.observee2id)
                if (!obs1 || !obs2) throw Error(`system.initialize(): missing observee(s) for actor ${ca.id}`)
                actor.assign2SpecificObservees(obs1, obs2)
            }
            const ag = new ActorGroupDynamic(this.ctx, cag.id, actors, systemExecParms)
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
        this.focusAndFollowActGrp0  = sep.display.focusAndFollowActGrp0 
        if (this.focusAndFollowActGrp0) this.centerOfView = this.actGrps[0].centerPoint()
        this.actGrps.forEach(ag => ag.updateParameters(sep, this.mbrc!.realToCanvas))
        this.clearCanvas()
        this.visualize()
    }
    private setMapperBtwRealAndCanvas(): void {
        this.mbrc = mapperBtwRealAndCanvas(this.ctx!, this.centerOfView!, this.zoom!) 
    }

// ---------------------------------------------------------------------------------------
//      run the system
// ---------------------------------------------------------------------------------------

    public stopIterating(): void {
        this.iterationMode = IterationMode.paused
    }

    public runResumeIterating(): Observable<number> | undefined {
        if (this.iterationMode == IterationMode.iterating) return undefined
        this.iterationMode = IterationMode.iterating
        if (this.actGrps[0].isFrozen()) throw(`${this.actGrps[0].id} is frozen.`)
        const time$ = interval(this.intervalMillisecs)
        this.timeSubscription = time$.subscribe((now) => {
            if (this.iterationMode != IterationMode.iterating || now > this.maxIterations!) { 
                this.timeSubscription?.unsubscribe()
                this.time$ = undefined
            }
            this.actGrps.forEach(ag => ag.calculateNewActorPositions(this.actGrps.filter(ag2 => ag2 != ag), now))
            this.actGrps.forEach(ag => ag.moveActors(this.mbrc!.realToCanvas))
            this.setMapperBtwRealAndCanvas()
            this.visualize()
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

    private visualizeCanvasInReal(): void {
        const canvasLowerLeft  = new Point(this.ctx!, 0, 0, "Canvas-lower-left")
        const canvasUpperRight = new Point(this.ctx!, this.ctx!.canvas.width, this.ctx!.canvas.height, "Canvas-upper-right")//      const canvasBoxScaled = new Box(this.ctx!, "canvas-scaled", canvasLowerLeftScaled, canvasUpperRightScaled, new RgbColor(0, 0, 255))
        const canvasBox = new Box(this.ctx!, "canvas", canvasLowerLeft, canvasUpperRight, new RgbColor(0, 0, 255))
        canvasBox.visualize(this.mbrc!.realToCanvas)
    }

    public visualize(): void {
        if (!this.showActorJourney) this.clearCanvas()
        this.visualizeCanvasInReal()
        this.actGrps.forEach(ag => ag.visualize(this.mbrc!.realToCanvas))
    }
    
    public clearCanvas(): void {
        this.ctx!.clearRect(0, 0, this.ctx!.canvas.width, this.ctx!.canvas.height)
    }

    public home(ctx: CanvasRenderingContext2D): void {
        this.centerOfView = canvasCenter(ctx)
        this.zoom         = 1
        this.setMapperBtwRealAndCanvas()
        this.visualize()
    }

    public focusOnFirstActGrp(ctx: CanvasRenderingContext2D): void {
        this.centerOfView = this.actGrps[0].centerPoint()
        this.setMapperBtwRealAndCanvas()
        this.visualize()
    }
// ---------------------------------------------------------------------------------------
//      export the system and it's state
// ---------------------------------------------------------------------------------------

    private exportedAsConfiguration(): Configuration {
        return new Configuration(this.id!, this.actGrps.map(ag => ConfigActorGroup.new(new Point(this.ctx!, this.ctx!.canvas.width, this.ctx!.canvas.height), ag)))
    }

    /** write system configuration to json file in the download folder */
    private downloadToFile(blob: Blob, fileExtension: string, configurationId: string): void {
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${configurationId}_${now()}.${fileExtension}`
        link.click()
        link.remove()
    }

    /** download system configuration to json file */
    public onSaveFile(): void {
        const configuration = this.exportedAsConfiguration()
        if (!configuration) {
            alert("system.onSaveFile(): no configuration.")
            return
        }
        if (!this.id) { 
            alert("system.onSaveFile(): no configuration id!")
            return
        }
        console.log("system.onSaveFile(): const configuration = ")
        console.log(configuration)
        const fileContent = configAsJson(configuration)
        const blob = new Blob([JSON.stringify(fileContent, null, "\t")], { type: "application/json" })
        this.downloadToFile(blob, "json", configuration.id)
    }

// ---------------------------------------------------------------------------------------
//      handle canvas UI events
// ---------------------------------------------------------------------------------------

    public actorSelected(rp: Point): Actor | undefined {  // x, y are real Points 
        this.pickedActor = this.closestActorInRange(rp, cActorPickMargin / this.zoom!)
        if (this.pickedActor) {
            this.pickedActor.turnHaloOn() // actor selected, turn halo on, do not change center of view
            this.visualize()
            return this.pickedActor
        }
        this.centerOfView = rp // no actor selected, so set center of view to the clicked point
        return undefined
    }

    public handleActorMove(x: number, y: number): void {
        if (!this.pickedActor) return
        this.pickedActor.setPosition(this.mbrc!.canvasToReal(new Point(this.ctx!, x, y)))
        this.visualize()
    }

    public handleActorDrop(): void {
        this.pickedActor?.turnHaloOff()
        this.pickedActor = undefined
        this.visualize()
    }

    public reset(systemExecParms: SystemExecParms): void {
        this.clearCanvas()
    }

    public handleWheelMotion(motion: WheelMotion): void {
        this.zoom! *= motion == WheelMotion.up ? 2 : 0.5
        this.setMapperBtwRealAndCanvas()
        this.visualize()
    }
}