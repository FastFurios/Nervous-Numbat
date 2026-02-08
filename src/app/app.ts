
// #########################################################################################
// Project: NERVOUS NUMBAT
// G.Lindorfer, from 2025-10 to ...
// #########################################################################################

import { Component, signal, WritableSignal } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { now } from './services/helpers'
import { MainCanvas } from './main-canvas/main-canvas'
import { System, ConfigPoint, ConfigBox, ConfigActor, ConfigActorGroup, Configuration } from "./services/system"

// --------------------------------------------------------------------------------------
//     Buttons activate / deactivate  
// --------------------------------------------------------------------------------------

/** list of possible user actions */
type ActionsPossible = {
    setupSystem:        WritableSignal<boolean>,
    downloadConfig:     WritableSignal<boolean>,
    discard:            WritableSignal<boolean>
}

// --------------------------------------------------------------------------------------
//     System Strcuture Parameters  
// --------------------------------------------------------------------------------------

export interface SystemStructParms {
  numActGrps:         number
  numActorsPerActGrp: number
  powerCurveFactor:   number
  startBoxMarginPct:  number  // 0..100 in %
}

// --------------------------------------------------------------------------------------
//     JSON Configuration   
// --------------------------------------------------------------------------------------

type Creation_Mode = "automatic" | "explicit"

interface JsonActor {
  id:         string
  x:          number
  y:          number
  observee1:  string
  observee2:  string
}

interface JsonActorGroup {
  id:                 string
  creation_mode:      Creation_Mode
  topology:           JsonExplicitTopology | JsonAutomaticTopology      
}

type JsonExplicitTopology = JsonActor[]

interface JsonPoint { 
  x: number
  y: number 
}

interface JsonBox {
  lower_left:  JsonPoint
  upper_right: JsonPoint
}

interface JsonAutomaticTopology {
  id:                   string
  number_actors:        number 
  power_curve_factor:   number
  start_box:            JsonBox
}

interface JsonConfiguration {
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
  public actorGroups: ConfigActorGroup[]  = []
  public configuration: WritableSignal<Configuration | undefined> = signal(undefined)
  public systemStructParms: SystemStructParms = {
    numActGrps:         1,
    numActorsPerActGrp: 15,
    powerCurveFactor:   1,
    startBoxMarginPct:  10
  }
  //public configAsJson: 
  public configFilename:  string | undefined
  public configurationId: string | undefined
  public greyOut = "background-color: lightgrey; border-color: lightgrey;"
///public version                = environment.version

  constructor(private sys: System) { } 

// --------------------------------------------------------------------------------------
//     System Setup   
// --------------------------------------------------------------------------------------

  public onSetupSystem(): void {
    this.sys.id = this.configurationId
    this.sys.configActGrps = this.configuration()!.actorGroups
    this.showCanvas = !this.showCanvas
  }

  // --------------------------------------------------------------------------------------
  //     Discarding Configuration  
  // --------------------------------------------------------------------------------------

  /** discard system in the backend and delete the system configuration in the frontend i.e. in the configuration file service; log to the application event service; signal to the appliation state transition service  */
  public onDiscard(): void {
    this.configuration.set(undefined)
    this.configurationId = ""
    this.showCanvas      = false
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
      }
      catch (error) {
        alert(`app.onConfigFileSelected(): JSON parsing error: ${error}`) 
      }
    }
  }
  
  private configurationFrom(jsonConfig: JsonConfiguration): Configuration {
    const configActGrps = jsonConfig.actor_groups.map((jag, i) => this.configActorGroupFrom(jag, i))
    if (configActGrps.find(cag => cag == undefined)) {
      alert("A JSON file actor_group is invalid.")
    }  
    return new Configuration(jsonConfig.id, configActGrps.filter(cag => cag != undefined))
  }

  private configActorGroupFrom(jag: JsonActorGroup, idx: number): ConfigActorGroup | undefined {
    switch (jag.creation_mode) {
      case "automatic" : { 
        this.systemStructParms.numActorsPerActGrp = (<JsonAutomaticTopology>jag.topology).number_actors
        this.systemStructParms.powerCurveFactor   = (<JsonAutomaticTopology>jag.topology).power_curve_factor
        const startBox = new ConfigBox((<JsonAutomaticTopology>jag.topology).start_box.lower_left, (<JsonAutomaticTopology>jag.topology).start_box.upper_right)  
        return ConfigActorGroup.newRandomizedActGrp(`Explorers${idx}`, this.systemStructParms.numActorsPerActGrp, this.systemStructParms.powerCurveFactor, startBox); 
      }
      case "explicit" : {
        const cas = (<JsonExplicitTopology>jag.topology).map(ja => new ConfigActor(ja.id, ja.x, ja.y, ja.observee1, ja.observee2)) 
        return new ConfigActorGroup(jag.id, cas)
      } 
      default: alert("JSON file invalid creation_mode.")
    }
    return undefined
  }

  // --------------------------------------------------------------------------------------
  //     Randomize a Configuration  
  // --------------------------------------------------------------------------------------

  public onConfigurationByRandom(): void {
    this.actorGroups = []
    for (let i = 0, sbs = this.startBoxesForNumGrps(this.systemStructParms.numActGrps); i < this.systemStructParms.numActGrps; i++) {
      this.actorGroups.push(ConfigActorGroup.newRandomizedActGrp(`Random${i}`, this.systemStructParms.numActorsPerActGrp, this.systemStructParms.powerCurveFactor, sbs[i]))
    }
    this.configuration.set(new Configuration("random", this.actorGroups))
    this.configurationId = this.configuration()!.id
  }

  // --------------------------------------------------------------------------------------
  //     Downloading a Configuration  
  // --------------------------------------------------------------------------------------

  /** write system configuration to json file in the download folder */
  private downloadToFile(blob: Blob, fileExtension: string): void {
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${this.configuration()?.id}_${now()}.${fileExtension}`
    link.click()
    link.remove()
  }

  /** download system configuration to json file */
  public onSaveFile(): void {
    this.configuration.set(this.sys.exportedAsConfiguration())
    if (!this.configuration()) {
      alert("app.onSaveFile(): no configuration.")
      return
    }
    if (!this.configurationId) { 
      alert("app.onSaveFile(): enter a configuration id!")
      return
    }
    this.configuration()!.id = this.configurationId 

    const fileContent = configAsJson(this.configuration()!)
    const blob = new Blob([JSON.stringify(fileContent, null, "\t")], { type: "application/json" })
    this.downloadToFile(blob, "json")
  }

  // --------------------------------------------------------------------------------------
  //     Start boxes  
  // --------------------------------------------------------------------------------------

  private startBoxesForNumGrps(n: number): ConfigBox[] {
    if (n  < 1) return []  // error

    if (n == 1) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0), new ConfigPoint(100,  100)))]

    if (n == 2) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0), new ConfigPoint( 50,  100))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50,  0), new ConfigPoint(100,  100)))]
      
    if (n <= 4) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0), new ConfigPoint( 50,   50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50,  0), new ConfigPoint(100,   50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint( 0, 50), new ConfigPoint( 50,  100))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50, 50), new ConfigPoint(100,  100)))]

    if (n <= 6) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0), new ConfigPoint( 33,  50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(33,  0), new ConfigPoint( 67,  50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(67,  0), new ConfigPoint(100,  50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint( 0, 50), new ConfigPoint( 33, 100))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(33, 50), new ConfigPoint( 67, 100))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(67, 50), new ConfigPoint(100, 100)))]

    if (n <= 8) return [this.configBoxWithin(new ConfigBox(new ConfigPoint( 0,  0), new ConfigPoint( 25,  50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(25,  0), new ConfigPoint( 50,  50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50,  0), new ConfigPoint( 75,  50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(75,  0), new ConfigPoint(100,  50))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint( 0, 50), new ConfigPoint( 25, 100))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(25, 50), new ConfigPoint( 50, 100))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(50, 50), new ConfigPoint( 75, 100))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(75, 50), new ConfigPoint(100, 100)))]
    return []  // error
  }

  private configBoxWithin(area: ConfigBox): ConfigBox {
//  console.log(`app.configBoxWithin(): area= [(${area.lowerLeft.x}, ${area.lowerLeft.y}) / (${area.upperRight.x}, ${area.upperRight.y})]`)
    const boxWidth    = area.upperRight.x - area.lowerLeft.x
    const boxHeight   = area.upperRight.y - area.lowerLeft.y
    const xMargin     = boxWidth  * this.systemStructParms.startBoxMarginPct / 100
    const yMargin     = boxHeight * this.systemStructParms.startBoxMarginPct / 100
    const lowerLeft   = new ConfigPoint(area.lowerLeft.x  + xMargin, area.lowerLeft.y  + yMargin)
    const upperRight  = new ConfigPoint(area.upperRight.x - xMargin, area.upperRight.y - yMargin)
    return new ConfigBox(lowerLeft, upperRight)
  }

}


