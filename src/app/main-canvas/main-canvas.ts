import { Component, ViewChild, ElementRef, AfterViewInit  } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { System } from "../services/system"
import { cIntervalMillisecs, cUpperMargin, cLowerMargin, cLeftMargin, cRightMargin } from "./library/parameters"

export type SystemExecParmsRun = {
  intervalMillisecs:  number
  maxIterations:      number
  maxMoveDistance:    number
  minTriangleQuality: number
}
export type SystemExecParmsDisplay = {
  showActorId:                          boolean
  showTriangle:                         boolean
  showActorTriangleQuality:             boolean
  showActorObservees:                   boolean
  showActorGroupIdAndQuality:           boolean
  showActorJourney:                     boolean
  showOneActorOnlyWithTheGivenAgIndex:  number
}
export type SystemExecParmsStrategy = {
  poorTriangleQualityThreshold:           number
  aimAtFartherVertexOnEnduredPoorQuality: boolean
}
export interface SystemExecParms {
  run:      SystemExecParmsRun 
  display:  SystemExecParmsDisplay
  strategy: SystemExecParmsStrategy
 }

type RunResumeButtonLabel = "Run" | "Resume"

// ****************************************************************************************
//      MAIN CANVAS COMPONENT
// ****************************************************************************************

@Component({
  selector:     'main-canvas',
  imports:      [FormsModule, CommonModule],
  templateUrl:  './main-canvas.html',
  styleUrl:     './main-canvas.css',
})
export class MainCanvas implements AfterViewInit {
  sysExecParms!: SystemExecParms
  public runResumeButtonLabel:            RunResumeButtonLabel  = "Run"
  public highestActorIndexInActorGroup_0: number                = 0
  @ViewChild('myCanvas') canvasRef!:      ElementRef<HTMLCanvasElement>
  private canvas!:                        HTMLCanvasElement | null
  private ctx!:                           CanvasRenderingContext2D | null

  constructor(private sys: System) {
//  console.log("Welcome from the MainCanvas component.")
    this.sysExecParms = {
      run: {
        intervalMillisecs:                      cIntervalMillisecs,
        maxIterations:                          1000000,
        maxMoveDistance:                        4,
        minTriangleQuality:                     1
      },
      display: {
        showActorId:                            false,
        showTriangle:                           true,
        showActorTriangleQuality:               false,
        showActorObservees:                     false,
        showActorGroupIdAndQuality:             false,
        showActorJourney:                       false,
        showOneActorOnlyWithTheGivenAgIndex:    -1
      },
      strategy: {
        poorTriangleQualityThreshold:           0.5,
        aimAtFartherVertexOnEnduredPoorQuality: true
      }
    }
//  this.highestActorIndexInActorGroup_0 = this.numActorsOfActGrp(0) || 0
  }

  ngAfterViewInit() {
    if (!this.sys) throw Error("main-canvas.ngAfterViewInit(): this.sys is undefined.")
    this.canvas  = this.canvasRef.nativeElement
    if (!this.canvas) throw Error("main-canvas.ngAfterViewInit(): canvas is undefined.")
    this.ctx = this.canvas.getContext('2d')
    if (!this.ctx) throw Error('main-canvas.ngAfterViewInit(): could not get 2D context from canvas!')
//  console.log(`main-canvas.ngAfterViewInit(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)

    window.addEventListener("resize", this.handleCanvasResized.bind(this))
    this.handleCanvasResized()

    this.canvas.onmousedown = this.handleMouseDown.bind(this)
    window.addEventListener("resize", this.handleCanvasResized.bind(this))

    this.sys.initialize(this.ctx, this.sysExecParms)
  }

  public get doneIterations(): number {
    return this.sys.doneIterations
  }
  

  // ??
  public numActorsOfActGrp(agIdx: number): number | undefined {
    return this.sys.actGrps[agIdx].actors.length
  }

  // ---------------------------------------------------------------------------------------
  // button handlers
  // ---------------------------------------------------------------------------------------

  /** update the system with the current execution parameters */
  public updateExecParms(): void {
//  console.log(`main-canvas.updateExecParms()`)
    this.sys.updateExecParms(this.sysExecParms)
  }
  /** run&resume button clicked */
  public runResumeIterationsHandler() {
//  console.log(`main-canvas.runResumeIterationsHandler()`)
    this.sys.runResumeIterating()
  }
    /* stop button clicked */
  public stopIterationsHandler() {
//  console.log(`main-canvas.stopIterationsHandler()`)
    this.sys.stopIterating()
    this.runResumeButtonLabel = "Resume"
  }
  /** reset button clicked */
  public resetSystemHandler() {
//  console.log(`main-canvas.resetSystemHandler()`)
    this.sys.reset(this.sysExecParms)
    this.runResumeButtonLabel = "Run"
  }

  // ---------------------------------------------------------------------------------------
  // canvas mouse event handlers
  // ---------------------------------------------------------------------------------------

  public handleMouseDown(event: MouseEvent): void {
      event.preventDefault()
      this.sys.handleActorSelect(event.offsetX, event.offsetY)
      this.canvas!.onmousemove = this.handleMouseMove.bind(this)
      this.canvas!.onmouseup   = this.handleMouseUp.bind(this)
  }
  public handleMouseMove(event: MouseEvent): void {
      event.preventDefault()
      this.sys.handleActorMove(event.offsetX, event.offsetY)
  }
  public handleMouseUp(): void {
      this.sys.handleActorDrop()
      this.canvas!.onmousemove = null
      this.canvas!.onmouseup   = null
  }

  // ---------------------------------------------------------------------------------------
  // window event handlers
  // ---------------------------------------------------------------------------------------

  public handleCanvasResized(): void {
      this.ctx!.canvas.width  = window.innerWidth  - cLeftMargin  - cRightMargin
      this.ctx!.canvas.height = window.innerHeight - cUpperMargin - cLowerMargin
  }
}



