import { Component, ViewChild, ElementRef, OnInit, AfterViewInit, signal, WritableSignal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { cGreyOut } from '../app'
import { System } from "../services/system"
import { BoundaryMode, Point } from "../services/geometry"
import { cIntervalMillisecs, cUpperMargin, cLowerMargin, cLeftMargin, cRightMargin } from "./library/parameters"
import { Subscription } from 'rxjs'

export type SystemExecParmsRun = {
  intervalMillisecs:  number
  maxIterations:      number
  maxMoveDistance:    number
  minTriangleQuality: number
  boundaryMode:       BoundaryMode
}
export type SystemExecParmsDisplay = {
  showActorId:                          boolean
  showTriangle:                         boolean
  showActorTriangleQuality:             boolean
  showActorObservees:                   boolean
  showActorGroupIdAndQuality:           boolean
  showActorJourney:                     boolean
  showOneActorOnlyWithTheGivenAgIndex:  number
//focusAndFollowActGrp0:                boolean
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

export interface SystemUiReferences {
    time: number,
    ctx:  CanvasRenderingContext2D | null
}

type RunResumeButtonLabel = "Run" | "Resume"

export enum WheelMotion {
  up,
  down
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

// ****************************************************************************************
//      MAIN CANVAS COMPONENT
// ****************************************************************************************

@Component({
  selector:     'main-canvas',
  imports:      [FormsModule, CommonModule],
  templateUrl:  './main-canvas.html',
  styleUrl:     './main-canvas.css',
})
export class MainCanvas implements OnInit, AfterViewInit {
  @ViewChild('myCanvas') canvasRef!:    ElementRef<HTMLCanvasElement>
  public  BoundaryMode                                                        = BoundaryMode 
  public  sysExecParms!:                SystemExecParms
  public  runResumeButtonLabel:         RunResumeButtonLabel                  = "Run"
  private canvas!:                      HTMLCanvasElement | null
  private ctx?:                         CanvasRenderingContext2D | null
  public  time                                                                = signal(0)
  public  timeSubscription?:            Subscription
  public  systemId:                     WritableSignal<string | undefined>    = signal(undefined)
  public  actionsPossible                                                     = signal(cActPosStart)
  public  greyOut                                                             = cGreyOut


//public  selectedBoundaryMode:         BoundaryMode= BoundaryMode.rebound                   

  constructor(public sys: System) {
    this.sysExecParms = {
      run: {
        intervalMillisecs:                      cIntervalMillisecs,
        maxIterations:                          1000000,
        maxMoveDistance:                        4,
        minTriangleQuality:                     1,
        boundaryMode:                           BoundaryMode.rebound
      },
      display: {
        showActorId:                            false,
        showTriangle:                           true,
        showActorTriangleQuality:               false,
        showActorObservees:                     false,
        showActorGroupIdAndQuality:             false,
        showActorJourney:                       false,
        showOneActorOnlyWithTheGivenAgIndex:    -1,
//      focusAndFollowActGrp0:                  false
      },
      strategy: {
        poorTriangleQualityThreshold:           0.5,
        aimAtFartherVertexOnEnduredPoorQuality: false
      }
    }
    this.actionsPossible.set(cActPosStart)
  }

  ngOnInit() {
    this.sysExecParms.run.boundaryMode = BoundaryMode.rebound
    this.updateExecParms()
}

  ngAfterViewInit() {
      if (!this.sys) throw Error("main-canvas.ngAfterViewInit(): this.sys is undefined.")
      this.canvas  = this.canvasRef.nativeElement
      if (!this.canvas) throw Error("main-canvas.ngAfterViewInit(): canvas is undefined.")
      this.ctx = this.canvas.getContext('2d')
      if (!this.ctx) throw Error('main-canvas.ngAfterViewInit(): could not get 2D context from canvas!')

      window.addEventListener("resize", this.ctxHandleCanvasResized.bind(this))
      this.ctxHandleCanvasResized()

      this.canvas.onmousedown = this.ctxHandleMouseDown.bind(this)
      this.canvas.addEventListener("wheel", this.ctxHandleWheelScroll.bind(this))
      window.addEventListener("resize", this.ctxHandleCanvasResized.bind(this))

      this.actionsPossible.set(cActPosStart)
      this.sys.initialize(this.ctx, this.sysExecParms)
      this.systemId.set(this.sys.id)
  }

  ngOnDestroy() {
      this.sys.stopIterating()
  }

  public numActorsOfActGrp(agIdx: number): number | undefined {
      return this.sys.actGrps[agIdx].actors.length
  }

  // ---------------------------------------------------------------------------------------
  // button handlers
  // ---------------------------------------------------------------------------------------

  public runResumeIterationsHandler() {
    this.updateExecParms()
    this.timeSubscription = this.sys.runResumeIterating()?.subscribe(() => {
      this.time.update(t => t + 1)
      this.actionsPossible.set(cActPosRunning)
    } )
  }

  /** stop button clicked */
  public stopIterationsHandler() {
    this.sys.stopIterating()
    this.timeSubscription?.unsubscribe()
    this.runResumeButtonLabel = "Resume"
    this.actionsPossible.set(cActPosStopped)
  }

  /** reset button clicked */
  public resetSystemHandler() {
    this.updateExecParms()
    this.sys.reset(this.sysExecParms)
    this.time.set(0)
    this.timeSubscription?.unsubscribe()
    this.runResumeButtonLabel = "Run"
    this.sys.initialize(this.ctx!, this.sysExecParms)
    this.actionsPossible.set(cActPosStart)
  }

  /** home button clicked */
  public onHome() {
    this.sys.home(this.ctx!)
  }

  /** home button clicked */
  public onFocusOnFirstActGrp() {
    this.sys.focusOnFirstActGrp(this.ctx!)
  }

  // ---------------------------------------------------------------------------------------
  // parameters inputs event handlers
  // ---------------------------------------------------------------------------------------

  /** update the system with the current execution parameters */
  public updateExecParms(): void {
    this.sys.updateExecParms(this.sysExecParms)
  }

  /** handle toggled boundary mode */
  public updateBoundaryMode(newBoundaryMode: BoundaryMode): void {
    this.sysExecParms.run.boundaryMode = newBoundaryMode
    this.sys.updateExecParms(this.sysExecParms)
  }

  // ---------------------------------------------------------------------------------------
  // canvas mouse event handlers
  // ---------------------------------------------------------------------------------------

  public ctxHandleMouseDown(event: MouseEvent): void {
      event.preventDefault()
      const clickedPointInReal = this.sys.mbrc!.canvasToReal(new Point(this.ctx!, event.offsetX, event.offsetY, "clicked"))
      if (this.sys.actorSelected(clickedPointInReal)) {
          this.canvas!.onmousemove = this.ctxHandleMouseMove.bind(this)
          this.canvas!.onmouseup   = this.ctxHandleMouseUp.bind(this)
          return
      }
      this.sys.centerOfView = clickedPointInReal
  }

  public ctxHandleMouseMove(event: MouseEvent): void {
      event.preventDefault()
      this.sys.handleActorMove(event.offsetX, event.offsetY)
  }

  public ctxHandleMouseUp(): void {
      this.sys.handleActorDrop()
      this.canvas!.onmousemove = null
      this.canvas!.onmouseup   = null
  }

  public ctxHandleWheelScroll(event: WheelEvent): void {
     this.sys.handleWheelMotion(event.deltaY < 0 ? WheelMotion.up : WheelMotion.down)
  }
  // ---------------------------------------------------------------------------------------
  // window event handlers
  // ---------------------------------------------------------------------------------------

  public ctxHandleCanvasResized(): void {
      this.ctx!.canvas.width  = window.innerWidth  - cLeftMargin  - cRightMargin
      this.ctx!.canvas.height = window.innerHeight - cUpperMargin - cLowerMargin
  }
}



