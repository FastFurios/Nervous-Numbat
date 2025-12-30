
// #########################################################################################
// Project: NERVOUS NUMBAT
// G.Lindorfer, from 2025-10 to ...
// #########################################################################################

// Exakte Flächenberechnung der Dreiecksgruppe: 
// $ npm install martinez-polygon-clipping (siehe ChatGPT für "Polygon Union")

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms'
import { MainCanvas } from "./main-canvas/main-canvas";

/** list of possible user actions */
type ActionsPossible = {
    login:              boolean,
    run:                boolean,
    downloadConfig:     boolean,
    downloadEvents:     boolean,
    discard:            boolean
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MainCanvas, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Nervous-Numbat');
  public configFilename: string | undefined
  public actionsPossible: ActionsPossible
  public greyOut = "color: lightgrey;"
  public pShowTriangles: boolean = true
//  public version                = environment.version

  constructor() {
    this.actionsPossible = {
          login:              true,
          run:                false,
          downloadConfig:     false,
          downloadEvents:     false,
          discard:            false
      }

  } 

  public onUpdateParameters(value: boolean): void {
    console.log(`app.onUpdateParameters(${value})`)
    this.pShowTriangles = value
  }

  //  public onShowTriangleChange(): void {
//  }
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