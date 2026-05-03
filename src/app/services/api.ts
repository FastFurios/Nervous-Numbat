// ---------------------------------------------------------------------------------------
//      SYSTEM SETUP API
// ---------------------------------------------------------------------------------------

import { Point, Box } from "./geometry"
import { Actor } from "./actor"
import { ActorGroup, ActorGroupMode } from "./actorGroup"
import { BarrierSet } from "./barrier"
import { randomInRange, isBetween, powerFunctionFactory, powerCurveBloatedList } from "../main-canvas/library/helpers"
import { JsonPoint } from "./json"

export const cVirtalGridWidth  = 100
export const cVirtalGridHeight = 100

export enum CoordinateType {
  relative = "relative",
  real     = "real"   
}

export enum BarrierOrientation {
  vertical    = "vertical",
  horizontal  = "horizontal"   
}

// --- CONFIG POINT ----------------------------------------------------------------------

export class ConfigPoint { // virtual grid 
/*
  static newPercent(pUpperRight: Point, p: Point): ConfigPoint {
      return new ConfigPoint(p.x / pUpperRight.x * cVirtalGridWidth, p.y / pUpperRight.y * cVirtalGridHeight)
  } 
  static newReal(p: Point): ConfigPoint {
      return new ConfigPoint(p.x, p.y)
  } 
*/
  static newFromJson(jp: JsonPoint, coordType: CoordinateType): ConfigPoint {
    return new ConfigPoint(jp.x, jp.y, coordType)
  } 

  constructor (public x: number, public y: number, public coordType: CoordinateType) {
  }
  public toString(): string {
    return `[${this.x}/${this.y}]`
  }
}

// --- CONFIG BOX ----------------------------------------------------------------------
export class ConfigBox {
/*
  static newPercent(pUpperRight: Point, b: Box): ConfigBox {
      return new ConfigBox(ConfigPoint.newPercent(pUpperRight, b.lowerLeft), ConfigPoint.newPercent(pUpperRight, b.upperRight))
  } 
  static newReal(pUpperRight: Point, b: Box): ConfigBox {
      return new ConfigBox(ConfigPoint.newPercent(pUpperRight, b.lowerLeft), ConfigPoint.newPercent(pUpperRight, b.upperRight))
  } 
*/
  constructor(public lowerLeft: ConfigPoint, public upperRight: ConfigPoint) {
  }
}

// --- CONFIG ACTOR ----------------------------------------------------------------------
export class ConfigActor {
  static newFromSystem(a: Actor): ConfigActor {
    return new ConfigActor(a.id, a.p.x, a.p.y, CoordinateType.real, a.observee1?.id, a.observee2?.id)
  }
  static newRandomizedActor(id: string, startBox?: ConfigBox): ConfigActor {
    if (!startBox) 
      startBox = new ConfigBox(new ConfigPoint(0, 0, CoordinateType.relative), new ConfigPoint(cVirtalGridWidth, cVirtalGridHeight, CoordinateType.relative))
    const x = randomInRange(startBox.lowerLeft.x, startBox.upperRight.x) 
    const y = randomInRange(startBox.lowerLeft.y, startBox.upperRight.y) 
    return new ConfigActor(id, x, y, CoordinateType.relative)
  }
  public p:            ConfigPoint | undefined
  public observee1id:  string | undefined
  public observee2id:  string | undefined

  constructor(public id: string, x: number, y: number, coordType: CoordinateType, observee1id?: string, observee2id?: string) {
    this.p = new ConfigPoint(x, y, coordType)
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
  public toString(): string {
    return `Actor ${this.id} p=${this.p} => ${this.observee1id} and ${this.observee2id}`
  }
} 

// --- abstract CONFIG ACTOR GROUP ----------------------------------------------------------------------
export abstract class ConfigActorGroup {
  constructor(public id: string, public actors: ConfigActor[], public mode: ActorGroupMode, public coordType: CoordinateType) {}
} 

// --- CONFIG ACTOR GROUP DYNAMIC ----------------------------------------------------------------------
export class ConfigActorGroupDynamic extends ConfigActorGroup {
/*
  static new(pUpperRight: Point, ag: ActorGroup, coordType: CoordinateType): ConfigActorGroupDynamic {
    return new ConfigActorGroupDynamic(ag.id, ag.actors.map(a => ConfigActor.newFromSystem(a)), ag.mode, coordType)
  }
*/
  static newFromSystem(ag: ActorGroup): ConfigActorGroupDynamic {
    return new ConfigActorGroupDynamic(ag.id, ag.actors.map(a => ConfigActor.newFromSystem(a)), ag.mode, CoordinateType.real)
  }
  static newRandomizedActGrp(id: string, numActors: number, clustering: number = 0, mode: ActorGroupMode, startBox?: ConfigBox): ConfigActorGroupDynamic {
    const cag = new ConfigActorGroupDynamic(id, [], mode, CoordinateType.relative, startBox)
    cag.randomizeActors(numActors, startBox)
    cag.assign2RandomObservees(powerCurveBloatedList(cag.actors, powerFunctionFactory(-clustering, cag.actors.length)))
    return cag
  }
 
  constructor(id: string, actors: ConfigActor[], mode: ActorGroupMode, coordType: CoordinateType, public startBox?: ConfigBox) {
    super(id, actors, mode, coordType)
  }
 
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

// --- CONFIG ACTOR GROUP STATIC i.e. a obstacle box ----------------------------------------------------------------------
export class ConfigActorGroupStaticBox extends ConfigActorGroup  {

    constructor(id: string, coordType: CoordinateType, obstableBox: ConfigBox) {
        super(id, [], ActorGroupMode.static, coordType) 
        this.actors = [
            new ConfigActor("lowerLeft",  obstableBox.lowerLeft.x,  obstableBox.lowerLeft.y,  coordType),
            new ConfigActor("upperLeft",  obstableBox.lowerLeft.x,  obstableBox.upperRight.y, coordType),
            new ConfigActor("upperRight", obstableBox.upperRight.x, obstableBox.upperRight.y, coordType),
            new ConfigActor("lowerRight", obstableBox.upperRight.x, obstableBox.lowerLeft.y,  coordType)
        ]
        this.actors[0].observee1id = this.actors[1].id
        this.actors[0].observee2id = this.actors[3].id
        this.actors[1].observee1id = this.actors[0].id
        this.actors[1].observee2id = this.actors[2].id
        this.actors[2].observee1id = this.actors[1].id
        this.actors[2].observee2id = this.actors[3].id
        this.actors[3].observee1id = this.actors[0].id
        this.actors[3].observee2id = this.actors[2].id

        console.log("api.ConfigActorGroupStaticBox.constructor(): this.actors=")
        console.log(this.actors)
    }
}

// --- CONFIG BARRIERS ----------------------------------------------------------------------
export class ConfigBarrier {
    constructor(public orientation: BarrierOrientation, public at: number, public from: number, public to: number) { }
}

export class ConfigBarrierSet {
    static newFromSystem(bs: BarrierSet | undefined): ConfigBarrierSet | undefined {
      if (!bs) return undefined
      const horizontalBarriers = bs.barriers.filter(b => b.base.y == b.p2.y)
      const verticalBarriers   = bs.barriers.filter(b => b.base.x == b.p2.x)
      const horizontalConfigBarriers = horizontalBarriers.map(hb => new ConfigBarrier(BarrierOrientation.horizontal, hb.base.y, hb.base.x, hb.p2.x))  
      const verticalConfigBarriers   = verticalBarriers.map(hb => new ConfigBarrier(BarrierOrientation.vertical, hb.base.x, hb.base.y, hb.p2.y))  
      return new ConfigBarrierSet(CoordinateType.real, horizontalConfigBarriers.concat(verticalConfigBarriers))
    }

    constructor(public coordType: CoordinateType, public barriers: ConfigBarrier[]) { }
}
// --- CONFIGURATION ----------------------------------------------------------------------
export class Configuration {
    constructor(public id: string, public actorGroups: ConfigActorGroup[], public barrierSet?: ConfigBarrierSet) { }
}
