import { Injectable } from '@angular/core'
import { Observable, Subscription, interval } from 'rxjs'

import { SystemExecParms, WheelMotion } from "../main-canvas/main-canvas"
import { Point, Box, Line, UnitVector, Vector,  MapperBtwRealAndCanvas, mapperBtwRealAndCanvasStraight } from "./geometry"
import { ColorSchemes, RgbColor } from "./color"
import { Actor } from "./actor"
import { ActorGroup, ActorGroupDynamic } from "./actorGroup"
import { cActorPickMargin  } from "./parameters"
import { now  } from "./helpers"
import { randomInRange, isBetween, powerFunctionFactory, powerCurveBloatedList } from "../main-canvas/library/helpers"

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


// --- ACTOR GROUP OBSERVERS HISTOGRAMM ----------------------------------------------------------------------
type HistSegment = {
    from:   number
    to:     number
    count:  number
}

type NumObserversOfActor = {
    actor:          Actor,
    numObservers:   number
}

class ActGrpObserversHistogram {
    public segments: HistSegment[] = []
    constructor(public actGrp: ActorGroup, numSegments: number) { 
        //console.log(`ActGrpObserverHIstogram: actGrp.actors.length= ${actGrp.actors.length}`)
        for (let i = 0, from = 0, span = Math.ceil((actGrp.actors.length) / numSegments), to = span; 
                 i < actGrp.actors.length / span; 
                 i++, from += span, to = from + span) {
            this.segments[i] = {
                from:   from,
                to:     to,
                count:  0
            } 
        }
        let numObserversOfActors: NumObserversOfActor[] = [] 
        for (let a of actGrp.actors) {
            let numObservers = 0
            for (let obs of actGrp.actors) if (obs.observee1 == a || obs.observee2 == a) numObservers++ 
            numObserversOfActors.push({actor: a, numObservers: numObservers})
        }
        for (let noa of numObserversOfActors)
            for (let seg of this.segments)
                if (noa.numObservers >= seg.from && noa.numObservers < seg.to) { 
                    seg.count++
                    break
                }
    }
    public toCsvHeader(): string {
        return `time; actor group; ${this.segments.map(seg => `count; to`).join("; ")}`
    }
    public toCsv(): string {
        return `${now()}; ${this.actGrp.id}; ${this.segments.map(seg => `${seg.count}; ${seg.to}`).join("; ")}`                 //seg => `${seg.count}; ${seg.to}; `)}` 
    }
    public toString(): string {
        return `${this.actGrp.id}: ${this.segments.map(seg => `[${seg.from}-<${seg.to}]: ${seg.count}`)}` 
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
    public  id:                 string | undefined                      = undefined
    public  configActGrps:      ConfigActorGroup[]                      = []
    public  actGrps:            ActorGroup[]                            = []
    private ctx:                CanvasRenderingContext2D | undefined    = undefined
    public  maxIterations?:     number
    public  intervalMillisecs?: number
    private showActorJourney?:  boolean
    public  time$?:             Observable<void>
    private timeSubscription?:  Subscription 
    public  doneIterations:     number                                  = 0
    private iterationMode:      IterationMode                           = IterationMode.paused
    public  pickedActor:        Actor | null | undefined                = undefined
    public  colorSchemes                                                = new ColorSchemes(1)  // 1 as default
    private mbrc:               MapperBtwRealAndCanvas                  = mapperBtwRealAndCanvasStraight() // default
    private manualScaling:      number                                  = 1
    
    constructor() { }

// ---------------------------------------------------------------------------------------
//      create the system
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
        this.ctx = ctx

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
//          const hist = new ActGrpObserversHistogram(ag, 5)
//          console.log(hist.toString())
//          console.log(hist.toCsvHeader())
//          console.log(hist.toCsv())
        }
        console.log(`system.initialize(): this.id= ${this.id}`)  

        this.mbrc = this.actGrps[0].mapperBtwRealAndCanvas(this.manualScaling)
        this.visualize()

        console.log(`system.initialize(): Test mappers: ${this.mbrc.canvasToReal(this.mbrc.realToCanvas(new Point(this.ctx, 10, 10)))}`)
    }

    public updateExecParms(sep: SystemExecParms): void {
        this.maxIterations      = sep.run.maxIterations
        this.intervalMillisecs  = sep.run.intervalMillisecs
        this.showActorJourney   = sep.display.showActorJourney
        this.actGrps.forEach(ag => ag.updateParameters(sep, this.mbrc.realToCanvas))
        this.clearCanvas()
        this.visualize()
    }

// ---------------------------------------------------------------------------------------
//      run the system
// ---------------------------------------------------------------------------------------

    public stopIterating(): void {
        this.iterationMode = IterationMode.paused
        //console.log(`ActorGroup #0 Q-log= ${(<ActorGroupDynamic>this.actGrps[0]).log}`)
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
            this.actGrps.forEach(ag => ag.moveActors(this.mbrc.realToCanvas))
            this.mbrc = this.actGrps[0].mapperBtwRealAndCanvas(this.manualScaling)
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


    private visualizeGrid(): void {
        const canvasLowerLeft  = new Point(this.ctx!, 0, 0, "Canvas-lower-left")
        const canvasUpperRight = new Point(this.ctx!, this.ctx!.canvas.width, this.ctx!.canvas.height, "Canvas-lower-left")
        const canvasLowerLeftScaled:  Point = this.mbrc.realToCanvas(canvasLowerLeft)
        const canvasUpperRightScaled: Point = this.mbrc.realToCanvas(canvasUpperRight)
        const canvasBoxScaled = new Box(this.ctx!, "canvas-scaled", canvasLowerLeftScaled, canvasUpperRightScaled, new RgbColor(0, 0, 255))
        canvasBoxScaled.visualize(this.mbrc.realToCanvas)

        for (let i=-10, offset = i * canvasBoxScaled.height; i <= 10; i++, offset += canvasBoxScaled.height) {
            const horizontalLine: Line = Line.fromPointAndVector(this.ctx!, canvasLowerLeftScaled.add(new Vector(0, offset)), new UnitVector(1, 0))
            horizontalLine.visualize(this.mbrc.realToCanvas, new RgbColor(230, 230, 230))
        }
        for (let i=-10, offset = i * canvasBoxScaled.width;  i <= 10; i++, offset += canvasBoxScaled.width) {
            const verticalLine: Line   = Line.fromPointAndVector(this.ctx!, canvasLowerLeftScaled.add(new Vector(offset, 0)), new UnitVector(0, 1))
            verticalLine.visualize(this.mbrc.realToCanvas, new RgbColor(230, 230, 230))
        }
    }

    public visualize(): void {
        if (!this.showActorJourney) this.clearCanvas()
//      console.log(`system.visualize(): this.showActorJourney= ${this.showActorJourney}; having ${this.actGrps.length} actor groups`)
        this.visualizeGrid()
        this.actGrps.forEach(ag => ag.visualize(this.mbrc.realToCanvas))
    }
    
    public clearCanvas(): void {
        this.ctx!.clearRect(0, 0, this.ctx!.canvas.width, this.ctx!.canvas.height)
    }

// ---------------------------------------------------------------------------------------
//      export the system and it's state
// ---------------------------------------------------------------------------------------

    public exportedAsConfiguration(): Configuration {
        if (!this.ctx) alert("system.exportedAsConfiguration(): canvas context ctx is undefined.")
        return new Configuration(this.id!, this.actGrps.map(ag => ConfigActorGroup.new(new Point(this.ctx!, this.ctx!.canvas.width, this.ctx!.canvas.height), ag)))
    }

// ---------------------------------------------------------------------------------------
//      handle UI events
// ---------------------------------------------------------------------------------------

    public handleActorSelect(x: number, y: number): void {  // x, y are Points on the canvas
        this.pickedActor = this.closestActorInRange(this.mbrc.canvasToReal(new Point(this.ctx!, x, y)), cActorPickMargin)
        if (!this.pickedActor) return
        this.pickedActor.turnHaloOn()
        this.visualize()
    }

    public handleActorMove(x: number, y: number): void {
        if (!this.pickedActor) return
        this.pickedActor.setPosition(this.mbrc.canvasToReal(new Point(this.ctx!, x, y)))
        this.visualize()
    }

    public handleActorDrop(): void {
        this.pickedActor?.turnHaloOff()
        this.pickedActor = undefined
        this.visualize()
    }

    public reset(systemExecParms: SystemExecParms): void {
        // rebuild system from latest system setup data, may it be a JSON pojo or setup parameters
        this.clearCanvas()
        this.initialize(this.ctx!,  systemExecParms)
    }

    public handleWheelMotion(motion: WheelMotion): void {
        this.manualScaling *= motion == WheelMotion.up ? 2 : 0.5
        this.mbrc = this.actGrps[0].mapperBtwRealAndCanvas(this.manualScaling)
        console.log(`system.handleWheelMotion(): this.manualScaling= ${this.manualScaling}`)
        this.visualize()
    }
}