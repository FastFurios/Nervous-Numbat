
// #########################################################################################
// Project: NERVOUS NUMBAT
// G.Lindorfer, from 2025-10 to ...
// #########################################################################################

import { Component, signal, WritableSignal } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { MainCanvas } from './main-canvas/main-canvas'
import { System } from "./services/system"
import { ActorGroupMode } from "./services/actorGroup"
import { configAsJson } from "./services/json"
import { now, randomInRange } from "./services/helpers"

import { JsonConfiguration, JsonActorGroup, JsonAutomaticTopology, JsonExplicitTopology } from "./services/json"
import { ConfigPoint, ConfigBox, ConfigActor, ConfigActorGroupDynamic, ConfigActorGroupStaticBox, ConfigBarrier, Configuration, cVirtualGridWidth, cVirtualGridHeight, CoordinateType } from "./services/api"

// --------------------------------------------------------------------------------------
//     Buttons activate / deactivate  
// --------------------------------------------------------------------------------------

/** list of possible user actions */
type ActionsPossible = {
    upload:             boolean,
    ramdomize:          boolean,
    setupSystem:        boolean,
    downloadConfig:     boolean,
    discard:            boolean
}

const cActPosStart: ActionsPossible = {
    upload:             true,
    ramdomize:          true,
    setupSystem:        false,
    downloadConfig:     false,
    discard:            false
} 

const cActPosHasConfig: ActionsPossible = {
    upload:             false,
    ramdomize:          false,
    setupSystem:        true,
    downloadConfig:     true,
    discard:            true
} 

const cActPosConfigIsSetUp: ActionsPossible = {
    upload:             false,
    ramdomize:          false,
    setupSystem:        false,
    downloadConfig:     true,
    discard:            true
} 

// --------------------------------------------------------------------------------------
//     System Strcuture Parameters  
// --------------------------------------------------------------------------------------

export interface SystemStructParms {
  numActGrps:         number
  numActorsPerActGrp: number
  clustering:         number
  startBoxMarginPct:  number  // 0..100 in %
}

// --- button grey-out ---------------------
export const cGreyOut = "background-color: lightgrey; border-color: lightgrey;"

// ****************************************************************************************
//      APP COMPONENT
// ****************************************************************************************

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MainCanvas, FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Nervous-Numbat');
  public showCanvas : boolean             = false
  public actorGroups: ConfigActorGroupDynamic[]  = []
  public configuration: WritableSignal<Configuration | undefined> = signal(undefined)
  public systemStructParms: SystemStructParms = {
                                                    numActGrps:         1,
                                                    numActorsPerActGrp: 25,
                                                    clustering:         0,
                                                    startBoxMarginPct:  10
                                                }
  public actionsPossible = signal(cActPosStart)
  public configFilename:  string | undefined
  public configurationId: string | undefined
  public greyOut = cGreyOut
///public version                = environment.version

  constructor(private sys: System) { 
    this.actionsPossible.set(cActPosStart)
  } 

// --------------------------------------------------------------------------------------
//     System Setup   
// --------------------------------------------------------------------------------------

  public onSetupSystem(): void {
    this.sys.id = this.configurationId
    this.sys.configActGrps    = this.configuration()!.actorGroups
    this.sys.configBarriers   = this.configuration()!.barriers
    this.showCanvas = true
    this.actionsPossible.set(cActPosConfigIsSetUp)
  }

  // --------------------------------------------------------------------------------------
  //     Discarding Configuration  
  // --------------------------------------------------------------------------------------

  /** discard system in the backend and delete the system configuration in the frontend i.e. in the configuration file service; log to the application event service; signal to the appliation state transition service  */
  public onDiscard(): void {
    this.configuration.set(undefined)
    this.configurationId = ""
    this.showCanvas      = false
    this.actionsPossible.set(cActPosStart)
  }

  // --------------------------------------------------------------------------------------
  //     Uploading a Configuration  
  // --------------------------------------------------------------------------------------

  /** upload system configuration json file */
  public onConfigFileSelected(e: Event): void { 
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length == 0) { console.warn('No file selected.'); return }
    const file = input.files[0]
    this.configFilename = file.name
    const reader = new FileReader()
    reader.readAsText(file)

    reader.onload = () => {
      (<HTMLInputElement>e.target).value = "" // clear the event input to allow event detection of re-selection of same file
      if (!reader.result) return
      try {
        const jsonConfig = JSON.parse(reader.result.toString())
        this.configuration.set(this.configurationFrom(jsonConfig)) 
        this.configurationId = this.configuration()!.id
        this.actionsPossible.set(cActPosHasConfig)
      }
      catch (error) {
        alert(`app.onConfigFileSelected(): JSON parsing error: ${error}`) 
      }
    }
  }
  
  private configurationFrom(jsonConfig: JsonConfiguration): Configuration {
    console.log(`app.configurationFrom() entered. `)
    const configActGrps = jsonConfig.actor_groups.map((jag, i) => this.configActorGroupFrom(jag, i))
//  console.log("app.onConfigFileSelected(): configActGrps=")
//  console.log(configActGrps)
    if (configActGrps.find(cag => cag == undefined)) {
        alert("A JSON file actor_group is invalid.")
    }  
    const maybeConfigBarriers: ConfigBarrier[] | undefined = jsonConfig.barrier_set?.barriers.map(jb => 
          new ConfigBarrier(new ConfigPoint(jb.from.x, jb.from.y, jsonConfig.barrier_set!.coordinate_type),
                            new ConfigPoint(jb.to.x,   jb.to.y,   jsonConfig.barrier_set!.coordinate_type)))
    console.log("app.configurationFrom(): Barriers:")
    console.log(maybeConfigBarriers)
    return new Configuration(jsonConfig.id, configActGrps.filter(cag => cag != undefined), maybeConfigBarriers)
  }

  private configActorGroupFrom(jag: JsonActorGroup, idx: number): ConfigActorGroupDynamic | ConfigActorGroupStaticBox | undefined {
    switch (jag.creation_mode) {
      case "automatic" : { 
        this.systemStructParms.numActorsPerActGrp = (<JsonAutomaticTopology>jag.topology).number_actors
        this.systemStructParms.clustering   = (<JsonAutomaticTopology>jag.topology).clustering
        const startBox = new ConfigBox(
            ConfigPoint.newFromJson((<JsonAutomaticTopology>jag.topology).start_box.lower_left, jag.coordinate_type), 
            ConfigPoint.newFromJson((<JsonAutomaticTopology>jag.topology).start_box.upper_right, jag.coordinate_type))  
        return ConfigActorGroupDynamic.newRandomizedActGrp(`Explorers${idx}`, 
                                                           this.systemStructParms.numActorsPerActGrp, 
                                                           this.systemStructParms.clustering, 
                                                           ActorGroupMode.dynamic, 
                                                           startBox); 
      }
      case "explicit" : {
        console.log(`app.configActorGroupFrom(): jag.topology[0].id= ${(<JsonExplicitTopology>jag.topology)[0].id}`)
        const cas = (<JsonExplicitTopology>jag.topology).map(ja => 
          new ConfigActor(ja.id, 
                          ja.x || randomInRange(0, cVirtualGridWidth), 
                          ja.y || randomInRange(0, cVirtualGridHeight), 
                          jag.coordinate_type, 
                          ja.observee1, 
                          ja.observee2)) 
        return new ConfigActorGroupDynamic(jag.id, cas, jag.iteration_mode, jag.coordinate_type)
      } 
      case "obstacle" : {
        return new ConfigActorGroupStaticBox(jag.id, 
                                             jag.coordinate_type, 
                                             new ConfigBox(new ConfigPoint(jag.obstacle!.lower_left.x, jag.obstacle!.lower_left.y, jag.coordinate_type), 
                                                           new ConfigPoint(jag.obstacle!.upper_right.x, jag.obstacle!.upper_right.y, jag.coordinate_type)))
      } 
      default: alert("JSON file invalid creation_mode.")
    }
    return undefined
  }

  // --------------------------------------------------------------------------------------
  //     Downloading a Configuration  
  // --------------------------------------------------------------------------------------

  private downloadToFile(blob: Blob, fileExtension: string, configurationId: string): void {
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `${configurationId}_${now()}.${fileExtension}`
      link.click()
      link.remove()
  }
    
  /** download configuration json file for the current system */
  public onDownload(): void { 
    const configuration = this.sys.exportedAsConfiguration()
    if (!configuration) {
        alert("system.onSaveFile(): no configuration.")
        return
    }
    if (!configuration.id) { 
        alert("system.onSaveFile(): no configuration id!")
        return
    }
    console.log("app.onDownload(): const configuration = ")
    console.log(configuration)
    const fileContent = configAsJson(configuration)
    const blob = new Blob([JSON.stringify(fileContent, null, "\t")], { type: "application/json" })
    this.downloadToFile(blob, "json", configuration.id)
  }

  // --------------------------------------------------------------------------------------
  //     Randomize a Configuration  
  // --------------------------------------------------------------------------------------

  public onConfigurationByRandom(): void {
    this.actorGroups = []
    for (let i = 0, sbs = this.startBoxesForNumGrps(this.systemStructParms.numActGrps); i < this.systemStructParms.numActGrps; i++) {
      this.actorGroups.push(ConfigActorGroupDynamic.newRandomizedActGrp(`Random${i}`, this.systemStructParms.numActorsPerActGrp, this.systemStructParms.clustering, ActorGroupMode.dynamic, sbs[i]))
    }
    this.configuration.set(new Configuration("random", this.actorGroups, undefined))
    this.configurationId = this.configuration()!.id
    this.actionsPossible.set(cActPosHasConfig)
  }

  // --------------------------------------------------------------------------------------
  //     Start boxes  
  // --------------------------------------------------------------------------------------

  private startBoxesForNumGrps(n: number): ConfigBox[] {
    if (n  < 1) return []  // error

    if (n == 1) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0, CoordinateType.relative), new ConfigPoint(100,  100, CoordinateType.relative)))]

    if (n == 2) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0, CoordinateType.relative), new ConfigPoint( 50,  100, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50,  0, CoordinateType.relative), new ConfigPoint(100,  100, CoordinateType.relative)))]
      
    if (n <= 4) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0, CoordinateType.relative), new ConfigPoint( 50,   50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50,  0, CoordinateType.relative), new ConfigPoint(100,   50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint( 0, 50, CoordinateType.relative), new ConfigPoint( 50,  100, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50, 50, CoordinateType.relative), new ConfigPoint(100,  100, CoordinateType.relative)))]

    if (n <= 6) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0, CoordinateType.relative), new ConfigPoint( 33,  50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(33,  0, CoordinateType.relative), new ConfigPoint( 67,  50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(67,  0, CoordinateType.relative), new ConfigPoint(100,  50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint( 0, 50, CoordinateType.relative), new ConfigPoint( 33, 100, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(33, 50, CoordinateType.relative), new ConfigPoint( 67, 100, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(67, 50, CoordinateType.relative), new ConfigPoint(100, 100, CoordinateType.relative)))]

    if (n <= 8) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0, CoordinateType.relative), new ConfigPoint( 25,  50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(25,  0, CoordinateType.relative), new ConfigPoint( 50,  50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50,  0, CoordinateType.relative), new ConfigPoint( 75,  50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(75,  0, CoordinateType.relative), new ConfigPoint(100,  50, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint( 0, 50, CoordinateType.relative), new ConfigPoint( 25, 100, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(25, 50, CoordinateType.relative), new ConfigPoint( 50, 100, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50, 50, CoordinateType.relative), new ConfigPoint( 75, 100, CoordinateType.relative))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(75, 50, CoordinateType.relative), new ConfigPoint(100, 100, CoordinateType.relative)))]
    return []  // error
  }

  private configBoxWithin(area: ConfigBox): ConfigBox {
//  console.log(`app.configBoxWithin(): area= [(${area.lowerLeft.x}, ${area.lowerLeft.y}) / (${area.upperRight.x}, ${area.upperRight.y})]`)
    const boxWidth    = area.upperRight.x - area.lowerLeft.x
    const boxHeight   = area.upperRight.y - area.lowerLeft.y
    const xMargin     = boxWidth  * this.systemStructParms.startBoxMarginPct / 100
    const yMargin     = boxHeight * this.systemStructParms.startBoxMarginPct / 100
    const lowerLeft   = new ConfigPoint(area.lowerLeft.x  + xMargin, area.lowerLeft.y  + yMargin, CoordinateType.relative)
    const upperRight  = new ConfigPoint(area.upperRight.x - xMargin, area.upperRight.y - yMargin, CoordinateType.relative)
    return new ConfigBox(lowerLeft, upperRight)
  }
}


