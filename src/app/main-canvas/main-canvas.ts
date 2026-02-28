import { Component, ViewChild, ElementRef, AfterViewInit, signal, WritableSignal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

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
  focusAndFollowActGrp0:                boolean
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
  @ViewChild('myCanvas') canvasRef!:    ElementRef<HTMLCanvasElement>
  public  BoundaryMode                                        = BoundaryMode 
  public  sysExecParms!:                SystemExecParms
  public  runResumeButtonLabel:         RunResumeButtonLabel  = "Run"
  private canvas!:                      HTMLCanvasElement | null
  private ctx?:                         CanvasRenderingContext2D | null
  public  time                                                = signal(0)
  public  timeSubscription?:            Subscription
  public  systemId:                     WritableSignal<string | undefined>    = signal(undefined)
//public  selectedBoundaryMode:         BoundaryMode= BoundaryMode.rebound                   

  constructor(private sys: System) {
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
        focusAndFollowActGrp0:                  false
      },
      strategy: {
        poorTriangleQualityThreshold:           0.5,
        aimAtFartherVertexOnEnduredPoorQuality: true
      }
    }
  }

  ngAfterViewInit() {
      if (!this.sys) throw Error("main-canvas.ngAfterViewInit(): this.sys is undefined.")
      this.canvas  = this.canvasRef.nativeElement
      if (!this.canvas) throw Error("main-canvas.ngAfterViewInit(): canvas is undefined.")
      this.ctx = this.canvas.getContext('2d')
      if (!this.ctx) throw Error('main-canvas.ngAfterViewInit(): could not get 2D context from canvas!')

      window.addEventListener("resize", this.handleCanvasResized.bind(this))
      this.handleCanvasResized()

      this.canvas.onmousedown = this.handleMouseDown.bind(this)
      this.canvas.addEventListener("wheel", this.handleWheelScroll.bind(this))
      window.addEventListener("resize", this.handleCanvasResized.bind(this))

      this.sys.initialize(this.ctx, this.sysExecParms)
      this.systemId.set(this.sys.id)
  }

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
  /** handle toggled boundary mode */
  public updateBoundaryMode(newBoundaryMode: BoundaryMode): void {
//  console.log(`main-canvas.updateExecParms()`)
    this.sysExecParms.run.boundaryMode = newBoundaryMode
    this.sys.updateExecParms(this.sysExecParms)
  }
  public runResumeIterationsHandler() {
//  console.log(`main-canvas.runResumeIterationsHandler()`)
    this.timeSubscription = this.sys.runResumeIterating()?.subscribe(() => {
      this.time.update(t => t + 1)
//    console.log(`main-canvas: subscriber triggered; new time is ${this.time}`)
    } )
  }
    /* stop button clicked */
  public stopIterationsHandler() {
//  console.log(`main-canvas.stopIterationsHandler()`)
    this.sys.stopIterating()
    this.timeSubscription?.unsubscribe()
    this.runResumeButtonLabel = "Resume"
  }
  /** reset button clicked */
  public resetSystemHandler() {
//  console.log(`main-canvas.resetSystemHandler()`)
    this.sys.reset(this.sysExecParms)
    this.time.set(0)
    this.timeSubscription?.unsubscribe()
    this.runResumeButtonLabel = "Run"
  }

  // ---------------------------------------------------------------------------------------
  // canvas mouse event handlers
  // ---------------------------------------------------------------------------------------

  public handleMouseDown(event: MouseEvent): void {
      event.preventDefault()
      const clickedPointInReal = this.sys.mbrc!.canvasToReal(new Point(this.ctx!, event.offsetX, event.offsetY))
      if (this.sys.actorSelected(clickedPointInReal)) {
          this.canvas!.onmousemove = this.handleMouseMove.bind(this)
          this.canvas!.onmouseup   = this.handleMouseUp.bind(this)
          return
      }
      this.sys.centerOfView = clickedPointInReal
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
  public handleWheelScroll(event: WheelEvent): void {
     this.sys.handleWheelMotion(event.deltaY < 0 ? WheelMotion.up : WheelMotion.down)
  }
  // ---------------------------------------------------------------------------------------
  // window event handlers
  // ---------------------------------------------------------------------------------------

  public handleCanvasResized(): void {
      this.ctx!.canvas.width  = window.innerWidth  - cLeftMargin  - cRightMargin
      this.ctx!.canvas.height = window.innerHeight - cUpperMargin - cLowerMargin
  }
}



