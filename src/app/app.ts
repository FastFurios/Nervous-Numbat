
// #########################################################################################
// Project: NERVOUS NUMBAT
// G.Lindorfer, from 2025-10 to ...
// #########################################################################################

import { Component, signal } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { MainCanvas } from './main-canvas/main-canvas'
import { System, ConfigPoint, ConfigBox, ConfigActor, ConfigActorGroup, Configuration } from "./services/system"
import { cPowerCurveFactor } from "./main-canvas/library/parameters"

// --------------------------------------------------------------------------------------
//     Configuration Geometry  
// --------------------------------------------------------------------------------------

/** list of possible user actions */
type ActionsPossible = {
    login:              boolean,
    run:                boolean,
    downloadConfig:     boolean,
    downloadEvents:     boolean,
    discard:            boolean
}

export interface SystemStructParms {
  numActGrps:         number
  numActorsPerActGrp: number
  powerCurveFactor:   number
  startBoxMarginPct:  number  // 0..100 in %
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
  public configuration: Configuration | undefined
  public systemStructParms: SystemStructParms = {
                                                  numActGrps: 1,
                                                  numActorsPerActGrp: 15,
                                                  powerCurveFactor: 1,
                                                  startBoxMarginPct: 10
                                                }


  public configFilename: string | undefined
/*
  public actionsPossible: ActionsPossible
  public greyOut = "color: lightgrey;"
  public pShowTriangles: boolean = true
//  public version                = environment.version
*/
  constructor(private sys: System) {
/*
    this.actionsPossible = {
          login:              true,
          run:                false,
          downloadConfig:     false,
          downloadEvents:     false,
          discard:            false
      }
*/
  } 

  public onSystemSetup(): void {
    this.actorGroups = []
    for (let i = 0, sbs = this.startBoxesForNumGrps(this.systemStructParms.numActGrps); i < this.systemStructParms.numActGrps; i++) {
      this.actorGroups.push(ConfigActorGroup.newRandomizedActGrp(`Explorers${i}`, this.systemStructParms.numActorsPerActGrp, this.systemStructParms.powerCurveFactor, sbs[i]))
    }
    this.sys.configuration = new Configuration("Explorers", this.actorGroups)
    this.showCanvas = !this.showCanvas
  }

  private startBoxesForNumGrps(n: number): ConfigBox[] {
    if (n  < 1) return []  // error

    if (n == 1) return [this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,     0), new ConfigPoint(10000,  10000)))]

    if (n == 2) return [this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,     0), new ConfigPoint( 5000,  10000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(5000,     0), new ConfigPoint(10000,  10000)))]
      
    if (n <= 4) return [this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,     0), new ConfigPoint( 5000,   5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(5000,     0), new ConfigPoint(10000,   5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,  5000), new ConfigPoint( 5000,  10000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(5000,  5000), new ConfigPoint(10000,  10000)))]

    if (n <= 6) return [this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,     0), new ConfigPoint( 3333,  5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(3334,     0), new ConfigPoint( 6666,  5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(6667,     0), new ConfigPoint(10000,  5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,  5000), new ConfigPoint( 3333, 10000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(3334,  5000), new ConfigPoint( 6666, 10000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(6667,  5000), new ConfigPoint(10000, 10000)))]

    if (n <= 8) return [this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,     0), new ConfigPoint( 2500,  5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(2500,     0), new ConfigPoint( 5000,  5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(5000,     0), new ConfigPoint( 7500,  5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(7500,     0), new ConfigPoint(10000,  5000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(   0,  5000), new ConfigPoint( 2500, 10000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(2500,  5000), new ConfigPoint( 5000, 10000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(5000,  5000), new ConfigPoint( 7500, 10000))),
                        this.configBoxWithin(new ConfigBox(new ConfigPoint(7500,  5000), new ConfigPoint(10000, 10000)))]
    return []  // error
  }

  private configBoxWithin(area: ConfigBox): ConfigBox {
    console.log(`app.configBoxWithin(): area= [(${area.lowerLeft.x}, ${area.lowerLeft.y}) / (${area.upperRight.x}, ${area.upperRight.y})]`)
    const boxWidth    = area.upperRight.x - area.lowerLeft.x
    const boxHeight   = area.upperRight.y - area.lowerLeft.y
    const xMargin     = boxWidth  * this.systemStructParms.startBoxMarginPct / 100
    const yMargin     = boxHeight * this.systemStructParms.startBoxMarginPct / 100
    const lowerLeft   = new ConfigPoint(area.lowerLeft.x  + xMargin, area.lowerLeft.y  + yMargin)
    const upperRight  = new ConfigPoint(area.upperRight.x - xMargin, area.upperRight.y - yMargin)
    return new ConfigBox(lowerLeft, upperRight)
  }

/*
  // --------------------------------------------------------------------------------------
  //     Discarding Configuration and also the Backend system instance  
  // --------------------------------------------------------------------------------------

  /** discard system in the backend and delete the system configuration in the frontend i.e. in the configuration file service; log to the application event service; signal to the appliation state transition service  */
  public onDiscard(): void {
    console.log(`app.onDiscard()`)
  }

  // --------------------------------------------------------------------------------------
  //     Uploading a Configuration  
  // --------------------------------------------------------------------------------------

  /** upload system configuration json file into the configuration file service */
  public onConfigFileSelected(e: Event): void { 
    console.log(`app.onConfigFileSelected()`)
    const file: File = (<any>e.target).files[0] 
    this.configFilename = file.name
//  if (this.cfs.configAsJson()) this.bas.dropSystem()

    const reader = new FileReader()
    reader.readAsText(file)
  //  reader.onerror = (error) => this.ess.add(EventsService.applicationEventFrom("reading config json file", file.name, EventTypeId.configFileLoadError, EventSeverity.fatal))
    reader.onload = () => {
      (<HTMLInputElement>e.target).value = "" // clear the event input to allow event detection of re-selection of same file
      if (!reader.result) {
//      this.ess.add(EventsService.applicationEventFrom("reading config json file", file.name, EventTypeId.configFileLoadError, EventSeverity.fatal))
        return
      }
/*
      try {
        this.cfs.storeConfigAsJson(JSON.parse(reader.result.toString())) 
        this.ess.add(EventsService.applicationEventFrom("parsing JSON from config file", file.name, EventTypeId.configFileLoaded, EventSeverity.info))
      } catch (error) {
        this.ess.add(EventsService.applicationEventFrom("parsing JSON from config file", file.name, EventTypeId.configJsonError, EventSeverity.fatal))
      }
      this.ass.frontendEventsSubject$.next("config-uploaded")
*/
  }
}
  

  // --------------------------------------------------------------------------------------
  //     Downloading a Configuration  
  // --------------------------------------------------------------------------------------

  /** write system configuration to json file in the download folder */
  private downloadToFile(blob: Blob, fileExtension: string): void {
    console.log(`app.downloadToFile()`)
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
//  if (!this.configAsJson) return
    const now = new Date()
//  link.download = `${this.configAsJson()?.system_id}_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}_${now.getHours().toString().padStart(2, "0")}-${now.getMinutes().toString().padStart(2, "0")}.${fileExtension}`
    link.click()
    link.remove()
//  this.ess.add(EventsService.applicationEventFrom("Downloaded config", "/download", EventTypeId.configDownloaded, EventSeverity.info))
  }

  /** download system configuration to json file */
  public onSaveFile(): void {
    console.log(`app.onSaveFile()`)
/*
    const fileContent = this.cfs.configAsJson()
    const blob = new Blob([JSON.stringify(fileContent, null, "\t")], { type: "application/json" })
    this.downloadToFile(blob, "json")
*/
  }


}