import { Injectable } from '@angular/core';

import { SystemExecParms } from "../main-canvas/main-canvas"
import { Point, Box } from "./geometry"
import { ColorSchemes, RgbColor } from "./color"
import { Actor } from "./actor"
import { ActorGroup, ActorGroupDynamic, ActorGroupStaticBox } from "./actorGroup"
import { cActorPickMargin, cPoorTriangleQualityThreshold } from "./parameters"
import { randomInRange, isBetween, powerFunctionFactory, powerCurveBloatedListOf as powerCurveBloatedList } from "../main-canvas/library/helpers"

// ---------------------------------------------------------------------------------------
//      SYSTEM SETUP API
// ---------------------------------------------------------------------------------------

const cVirtalGridWidth  = 10000
const cVirtalGridHeight = 10000

export class ConfigPoint { // virtual grid 
  constructor (public x: number, public y: number) {
    if (!isBetween(x, 0, cVirtalGridWidth))  throw Error(`ConfigPoint.constructor(): x= ${x} out of range of virtual grid.`) 
    if (!isBetween(y, 0, cVirtalGridHeight)) throw Error(`ConfigPoint.constructor(): y= ${y} out of range of virtual grid.`) 
  }
}

export class ConfigBox {
  constructor(public lowerLeft: ConfigPoint, public upperRight: ConfigPoint) {
  }
}

export class ConfigActor {
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

export class ConfigActorGroup {
  static newRandomizedActGrp(id: string, numActors: number, powerCurveFactor: number = 0, startBox?: ConfigBox): ConfigActorGroup {
    const cag = new ConfigActorGroup(id, [], startBox)
    cag.randomizeActors(numActors, startBox)
    cag.assign2RandomObservees(powerCurveBloatedList(cag.actors, powerFunctionFactory(powerCurveFactor, cag.actors.length)))
    return cag
  }
//public actors: ConfigActor[] = []
 
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

export class Configuration {
    constructor(public id: string, public actorGroups: ConfigActorGroup[]) { }
}

enum IterationMode {
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
//  public  systemExecParms:    SystemExecParms | undefined             = undefined
    public  maxIterations!:     number
    public  intervalMillisecs!: number
    private showActorJourney!:  boolean
    public  doneIterations:     number                                  = 0
    private iterationMode:      IterationMode                           = IterationMode.paused
    public  pickedActor:        Actor | null | undefined                = undefined
    public  colorSchemes                                                = new ColorSchemes(1)  // 1 as default
    

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
        console.log(`system: setter configuration(): this.id= ${this.id}, this.configActGrps=`)
        console.log(this.configActGrps)
    }

    public initialize(ctx: CanvasRenderingContext2D, systemExecParms: SystemExecParms): void {
        if (this.configActGrps.length < 1) throw Error(`System.initialize(): too few actor groups (${this.configActGrps.length}).`)
        if (!systemExecParms)              throw Error("System.initialize(): missing systemExecParms.")
        if (!ctx)                          throw Error("System.initialize(): missing canvas context.")
        this.ctx = ctx

        this.actGrps = []
        for (let cag of this.configActGrps) {
//          console.log(`system.initialize(): Config Act Grp= ${cag.id}`)
            const actors: Actor[] = cag.actors.map(ca => new Actor(this.ctx!, ca.id, this.mappedConfigPointOntoCanvas(ca.p!), systemExecParms!))
            for (let ca of cag.actors) {
                const actor: Actor | undefined = actors.find(a => a.id == ca.id)
                if (!actor) throw Error(`system.initialize(): could not find ${ca.id} in actors`)
                const obs1 : Actor | undefined = actors.find(a => a.id == ca.observee1id)
                const obs2 : Actor | undefined = actors.find(a => a.id == ca.observee2id)
                if (!obs1 || !obs2) throw Error(`system.initialize(): missing observee(s) for actor ${ca.id}`)
                actor.assign2SpecificObservees(obs1, obs2)
            }
//          console.log(actors.map(a => `${a.p}`))
            const ag = new ActorGroupDynamic(this.ctx, cag.id, actors, systemExecParms)
            this.actGrps.push(ag)
            this.colorSchemes = new ColorSchemes(this.actGrps.length)
            this.actGrps.forEach(ag => ag.applyColorScheme(this.colorSchemes.nextColorScheme()))
            
        }
        this.visualize()
    }
/*
    public addActGrps(actGrps: ActorGroup[]): System {
        actGrps.forEach(ag => this.actGrps.push(ag))
        this.colorSchemes = new ColorSchemes(this.actGrps.length)
        actGrps.forEach(ag => ag.applyColorScheme(this.colorSchemes.nextColorScheme()))
        return this
    }
    public setCanvasContext(ctx: CanvasRenderingContext2D): System {
        if (ctx == undefined) throw Error("system.setCanvasContext(): ctx is undefined.")
        this.ctx = ctx
        return this
    }

    
    public set sysExecParms(sep: SystemExecParms) {
        this.systemExecParms = sep
    }
*/
    public updateExecParms(sep: SystemExecParms): void {
//      console.log(`system.updateParameter(): propagating update...`)
        this.maxIterations      = sep.run.maxIterations
        this.intervalMillisecs  = sep.run.intervalMillisecs
        this.showActorJourney   = sep.display.showActorJourney
        this.actGrps.forEach(ag => ag.updateParameters(sep))
    }

// ---------------------------------------------------------------------------------------
//      run the system
// ---------------------------------------------------------------------------------------

    public iterateOn(): void {
        if (this.doneIterations > this.maxIterations) throw("Iterations limit reached: stopped it!")
/*?*/   if (this.actGrps[0].isFrozen())           throw(`${this.actGrps[0].id} is frozen.`)
//      this.htmlElementNumIterations.textContent = `${this.doneIterations}`    
        this.actGrps.forEach(ag => ag.calculateNewActorPositions(this.actGrps.filter(ag2 => ag2 != ag), this.doneIterations))
        this.actGrps.forEach(ag => ag.moveActors())
        this.visualize()
        this.doneIterations++
//      throw Error("system.iterateOn(): manually aborted.")
        if (this.iterationMode == IterationMode.iterating)
            setTimeout(() => this.iterateOn(), this.intervalMillisecs)
    }

    public stopIterating(): void {
        this.iterationMode = IterationMode.paused
    }

    public runResumeIterating(): void {
        if (this.iterationMode == IterationMode.iterating) return
        this.iterationMode = IterationMode.iterating
        this.iterateOn()
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

    public visualize(): void {
        if (!this.showActorJourney) this.clearCanvas()
//      console.log(`system.visualize(): this.showActorJourney= ${this.showActorJourney}; having ${this.actGrps.length} actor groups`)
        this.actGrps.forEach(ag => ag.visualize())
    }
    
    public clearCanvas(): void {
        this.ctx!.clearRect(0, 0, this.ctx!.canvas.width, this.ctx!.canvas.height)
    }
// ---------------------------------------------------------------------------------------
//      handle UI events
// ---------------------------------------------------------------------------------------

    public handleActorSelect(x: number, y: number): void {
        this.pickedActor = this.closestActorInRange(new Point(this.ctx!, x, y), cActorPickMargin)
        if (!this.pickedActor) return
        this.pickedActor.turnHaloOn()
        this.visualize()
    }

    public handleActorMove(x: number, y: number): void {
        if (!this.pickedActor) return
        this.pickedActor.setPosition(new Point(this.ctx!, x, y))
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
}
