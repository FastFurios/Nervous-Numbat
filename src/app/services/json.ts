// --------------------------------------------------------------------------------------
//     JSON Configuration   
// --------------------------------------------------------------------------------------
import { ActorGroupMode } from "./actorGroup"
import { Configuration, ConfigActorGroup, ConfigActor, CoordinateType } from "./api"

export type Creation_Mode = "automatic" | "explicit" | "obstacle"

export interface JsonActor {
  id:         string
  x:          number
  y:          number
  observee1:  string
  observee2:  string
}

export type JsonObstacle         = JsonBox
export type JsonExplicitTopology = JsonActor[]

export interface JsonActorGroup {
  id:                 string
  creation_mode:      Creation_Mode
  iteration_mode:     ActorGroupMode
  coordinate_type:    CoordinateType,   // either % of iniial canvas or absolute, real coordinates 
  topology?:          JsonExplicitTopology | JsonAutomaticTopology
  obstacle?:          JsonObstacle       
}

export interface JsonPoint { 
  x:      number
  y:      number 
}

export interface JsonBox {
  lower_left:  JsonPoint
  upper_right: JsonPoint
}

export interface JsonAutomaticTopology {
  id:                   string
  number_actors:        number 
  clustering:           number
  start_box:            JsonBox
}

export interface JsonConfiguration {
  id: string
  actor_groups: JsonActorGroup[]
}

export function configActorAsJson(ca: ConfigActor): JsonActor {
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
      coordinate_type: cag.coordType,
      iteration_mode: cag.mode,
      topology: cag.actors.map(ca => configActorAsJson(ca)),
      obstacle: undefined
    }
}

export function configAsJson(c: Configuration): JsonConfiguration {
  console.log("json.configAsJson(c)")
  console.log(c)
  return {
    id: c.id, 
    actor_groups: c.actorGroups.map(ag => configActorGroupAsJson(ag))
  }
}
