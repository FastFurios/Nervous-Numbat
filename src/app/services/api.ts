// ---------------------------------------------------------------------------------------
//      SYSTEM SETUP API
// ---------------------------------------------------------------------------------------

import { Point, Box } from "./geometry"
import { Actor } from "./actor"
import { ActorGroup, ActorGroupMode } from "./actorGroup"
import { RgbColor } from "./color"
import { randomInRange, isBetween, powerFunctionFactory, powerCurveBloatedList } from "../main-canvas/library/helpers"

export const cVirtalGridWidth  = 100
export const cVirtalGridHeight = 100

// --- CONFIG POINT ----------------------------------------------------------------------
export class ConfigPoint { // virtual grid 
    static new(pUpperRight: Point, p: Point): ConfigPoint {
        return new ConfigPoint(p.x / pUpperRight.x * cVirtalGridWidth, p.y / pUpperRight.y * cVirtalGridHeight)
    } 
    constructor (public x: number, public y: number) {
    if (!isBetween(x, 0, cVirtalGridWidth))  throw Error(`ConfigPoint.constructor(): x= ${x} out of range of virtual grid.`) 
    if (!isBetween(y, 0, cVirtalGridHeight)) throw Error(`ConfigPoint.constructor(): y= ${y} out of range of virtual grid.`) 
  }
  public toString(): string {
    return `[${this.x}/${this.y}]`
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
  public toString(): string {
    return `Actor ${this.id} p=${this.p} => ${this.observee1id} and ${this.observee2id}`
  }
} 

// --- abstract CONFIG ACTOR GROUP ----------------------------------------------------------------------
export abstract class ConfigActorGroup {
  abstract actors: ConfigActor[]
  constructor(public id: string, public mode: ActorGroupMode) {}
} 

// --- CONFIG ACTOR GROUP DYNAMIC ----------------------------------------------------------------------
export class ConfigActorGroupDynamic extends ConfigActorGroup {
  static new(pUpperRight: Point, ag: ActorGroup): ConfigActorGroupDynamic {
    return new ConfigActorGroupDynamic(ag.id, ag.actors.map(a => ConfigActor.new(pUpperRight, a)), ag.mode)
  }  
  static newRandomizedActGrp(id: string, numActors: number, clustering: number = 0, mode: ActorGroupMode, startBox?: ConfigBox): ConfigActorGroupDynamic {
    const cag = new ConfigActorGroupDynamic(id, [], mode, startBox)
    cag.randomizeActors(numActors, startBox)
    cag.assign2RandomObservees(powerCurveBloatedList(cag.actors, powerFunctionFactory(-clustering, cag.actors.length)))
    return cag
  }
 
  constructor(id: string, public actors: ConfigActor[], mode: ActorGroupMode, public startBox?: ConfigBox) {
    super(id, mode)
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
    public actors: ConfigActor[] = []

    constructor(id: string, obstableBox: ConfigBox) {
        super(id, ActorGroupMode.static) 
        this.actors = [
            new ConfigActor("lowerLeft",  obstableBox.lowerLeft.x,  obstableBox.lowerLeft.y ),
            new ConfigActor("upperLeft",  obstableBox.lowerLeft.x,  obstableBox.upperRight.y),
            new ConfigActor("upperRight", obstableBox.upperRight.x, obstableBox.upperRight.y),
            new ConfigActor("lowerRight", obstableBox.upperRight.x, obstableBox.lowerLeft.y )
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


// --- CONFIGURATION ----------------------------------------------------------------------
export class Configuration {
    constructor(public id: string, public actorGroups: ConfigActorGroup[]) { }
}
