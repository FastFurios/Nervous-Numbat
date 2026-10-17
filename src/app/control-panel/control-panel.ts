import { Component, OnInit, signal, Signal, WritableSignal, computed, ViewChildren, QueryList } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

import { cGreyOut } from '../app'
import { System } from "../services/system"
import { BoundaryMode } from "../services/geometry"
import { cIntervalMillisecs, cControlPanelWidth } from "../services/parameters"
import { MainCanvas } from '../main-canvas/main-canvas'
import { Statistics } from '../statistics/statistics'

// ---------------------------------------------------------------------------------------
//      SYSTEM EXECUTION PARAMETERS
// ---------------------------------------------------------------------------------------

export type SystemRunParms = {
  intervalMillisecs:                    number
  maxIterations:                        number
  maxMoveDistance:                      number
  minTriangleQuality:                   number
  boundaryMode:                         BoundaryMode
  poorTriangleQualityThreshold:         number
  aimAtFartherVertexOnEnduredPoorQuality:boolean
}

export type SystemDisplayParms = {
  showActorId:                          boolean
  showTriangle:                         boolean
  showActorTriangleQuality:             boolean
  showActorObservees:                   boolean
  showActorGroupIdAndQuality:           boolean
  showActorJourney:                     boolean
  showOneActorOnlyWithTheGivenAgIndex:  number
}

// ---------------------------------------------------------------------------------------
//      USER CONTROLS
// ---------------------------------------------------------------------------------------

/** list of possible user actions */
type ActionsPossible = {
    run_resume:         boolean,
    stop:               boolean,
    reset:              boolean,
    download:           boolean
}
const cActPosStart: ActionsPossible = {
    run_resume:         true,
    stop:               false,
    reset:              false,
    download:           true
} 

const cActPosRunning: ActionsPossible = {
    run_resume:         false,
    stop:               true,
    reset:              false,
    download:           false
} 

const cActPosStopped: ActionsPossible = {
    run_resume:         true,
    stop:               false,
    reset:              true,
    download:           true
} 

// ---------------------------------------------------------------------------------------
//      more 
// ---------------------------------------------------------------------------------------


class DisplayPanel  {
  constructor(public id: number, public hasCanvas: boolean, public isMainCanvas: boolean) { }
}

export abstract class Visualizable {
    abstract visualize(sdp: SystemDisplayParms): void
    abstract reset():                            void
}

export type CanvasSize = {
  width:  number,
  height: number
}

enum SecondaryWidget {
  none        = "none",
  canvas      = "canvas",
  statistics  = "statistics"
}

type RunResumeButtonLabel = "Run" | "Resume"

// ****************************************************************************************
//      CONTROL PANEL
// ****************************************************************************************

@Component({
  selector: 'app-control-panel',
  imports: [FormsModule, CommonModule, MainCanvas, Statistics],
  templateUrl: './control-panel.html',
  styleUrl: './control-panel.css',
})
export class ControlPanel implements OnInit {
//@ViewChildren(MainCanvas) canvasList!: QueryList<MainCanvas>                // lists all canvases of the child components; required to determine the main component canvas which is then used to translate relative to real coordinates at system initialization
  public  mainCanvasSize?:      CanvasSize
  public  clock!:               Signal<number>                                // = sys.step: views redraw after each completed iteration step
  public  primaryWidgetWidth:   WritableSignal<number>                        = signal(100) // %
  public  secondaryWidgetWidth: Signal<number>                                = computed(() => 100 - this.primaryWidgetWidth())

  public  BoundaryMode                                                        = BoundaryMode 
  public  sysRunParms!:         SystemRunParms
  public  runResumeButtonLabel: RunResumeButtonLabel                          = "Run"
  
  public  systemId:             WritableSignal<string | undefined>            = signal(undefined)
  public  actionsPossible                                                     = signal(cActPosStart)
  public  greyOut                                                             = cGreyOut
  public  displayPanels:        DisplayPanel[]                                = []
  public  secondaryWidget:      SecondaryWidget                               = SecondaryWidget.none 
  public  SecondaryWidget                                                     = SecondaryWidget 
  public  readonly controlPanelWidth:    number                               = cControlPanelWidth

  constructor(public sys: System) {
    this.clock = sys.step
    this.sysRunParms = {
        intervalMillisecs:                      cIntervalMillisecs,
        maxIterations:                          1000000,
        maxMoveDistance:                        4,
        minTriangleQuality:                     1,
        boundaryMode:                           BoundaryMode.inelastic,
        poorTriangleQualityThreshold:           0.5,
        aimAtFartherVertexOnEnduredPoorQuality: false
    }
  }

  ngOnInit() {
    this.sys.updateRunParms(this.sysRunParms)
    this.runResumeButtonLabel = "Run"
    this.actionsPossible.set(cActPosStart)
//  console.log(`ControlPanel.ngOnit(): done.`)
  }
/*
  ngAfterViewInit() {
    window.addEventListener("resize", this.handleCanvasResized.bind(this))
//  console.log(`ControlPanel.ngAfterViewInit(): done.`)
  }
*/
  ngOnDestroy() {
      this.sys.stopIterating()
      this.sys.actGrps    = []
      this.sys.barriers   = []
      this.sys.tact$      = undefined
      this.mainCanvasSize = undefined
//    console.log(`ControlPanel.ngOnDestroy(): done.`)
  }

/*
  private visualize(): void {
    this.canvasList.forEach(cl => cl.visualize())
  }
*/
  // ---------------------------------------------------------------------------------------
  // button handlers
  // ---------------------------------------------------------------------------------------

  public runResumeIterationsHandler() {
    this.updateRunParms()
    this.sys.runResumeIterating()
    this.actionsPossible.set(cActPosRunning)
//  console.log(`ControlPanel.runResumeIterationsHandler(): done.`)
  }

  /** stop button clicked */
  public stopIterationsHandler() {
    this.sys.stopIterating()
    this.runResumeButtonLabel = "Resume"
    this.actionsPossible.set(cActPosStopped)
//  console.log(`ControlPanel.stopIterationsHandler(): done.`)
  }

  /** reset button clicked */
  public resetSystemHandler() {
//  console.log(`ControlPanel.resetSystemHandler(): starting ...`)
    this.updateRunParms()
    this.sys.initialize(this.mainCanvasSize!, this.sysRunParms) // resets sys.step, which triggers visualizing in kids via effect there
    this.runResumeButtonLabel = "Run"
//  this.visualize()
    this.actionsPossible.set(cActPosStart)
//  console.log(`ControlPanel.resetSystemHandler(): done.`)
  }

  // ---------------------------------------------------------------------------------------
  // parameters inputs event handlers
  // ---------------------------------------------------------------------------------------

  /** update the system with the current execution parameters */
  public updateRunParms(): void {
    this.sys.actGrps.forEach(ag => ag.updateRunParameters(this.sysRunParms))
  }

  /** handle toggled boundary mode */
  public updateBoundaryMode(): void {
    this.sys.updateRunParms(this.sysRunParms)
  }

  // ---------------------------------------------------------------------------------------
  // window and children event handlers
  // ---------------------------------------------------------------------------------------

/*
  public handleCanvasResized(): void {
      if (!this.mainCanvasSize) {
        console.log(`ControlPanel.handleCanvasResized(): this.mainCanvasSize() is not defined`)
        return
      }
      const ctx: CanvasRenderingContext2D | null = this.mainCanvasSize()!.getContext('2d') 
      if (!ctx) {
        console.log(`ControlPanel.handleCanvasResized(): ctx is not defined`)
        return
      }

      this.mainCanvas()!.getContext('2d')!.canvas.width  = window.innerWidth  - cLeftMargin  - cRightMargin
      this.mainCanvas()!.getContext('2d')!.canvas.height = window.innerHeight - cUpperMargin - cLowerMargin
  }
*/

  public handleSecondaryWidgetDisplay(): void {
    console.log(`ControlPanel.handleSecondaryWidgetDisplay(): switched to secondary widget= ${this.secondaryWidget}`)
    if (this.secondaryWidget == SecondaryWidget.none)   
      this.primaryWidgetWidth.set(90)
    else if (this.secondaryWidget == SecondaryWidget.canvas) 
      this.primaryWidgetWidth.set(50)
    else
      this.primaryWidgetWidth.set(70)
    this.secondaryWidgetWidth = computed(() => 100 - this.primaryWidgetWidth())
  }


  public handleChildCanvasSizeEvent(cs: CanvasSize): void {
    this.mainCanvasSize = cs
    this.sys.initialize(this.mainCanvasSize, this.sysRunParms)
//  console.log(`ControlPanel.handleChildCanvasSizeEvent(): this.mainCanvasSize = ${this.mainCanvasSize.width} x  ${this.mainCanvasSize.height}`)
  }
}
