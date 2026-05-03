import { Component, ViewChild, ElementRef, OnInit, AfterViewInit, signal, WritableSignal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { cGreyOut } from '../app'
import { System } from "../services/system"
import { RgbColor } from "../services/color"
import { BoundaryMode, Point, Box, canvasCenter, MapperBtwRealAndCanvas, mapperBtwRealAndCanvas  } from "../services/geometry"
import { Actor } from "../services/actor"
import { cIntervalMillisecs, cUpperMargin, cLowerMargin, cLeftMargin, cRightMargin, cActorPickMargin } from "./library/parameters"

import { Subscription } from 'rxjs'

// ---------------------------------------------------------------------------------------
//      SYSTEM EXECUTION PARAMETERS
// ---------------------------------------------------------------------------------------

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
  public  mbrc?:                        MapperBtwRealAndCanvas
  public  centerOfView?:                Point                                   
  public  zoom?:                        number  // zoom > 1: zoomed in ; z < 1: zommed out
  public  pickedActor:                  Actor | null | undefined                = undefined



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
    this.sys.updateExecParms(this.sysExecParms)
    this.time.set(0)
    this.timeSubscription?.unsubscribe()
    this.runResumeButtonLabel = "Run"
    this.actionsPossible.set(cActPosStart)
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

      this.sys.initialize(this.ctx, this.sysExecParms)
      this.systemId.set(this.sys.id)
      this.home()
      this.clearCanvas()
      this.visualize()
      this.actionsPossible.set(cActPosStart)
  }

  ngOnDestroy() {
      this.sys.stopIterating()
  }

  private home():void {
    this.centerOfView = canvasCenter(this.ctx!)
    this.zoom         = 1
    this.setMapperBtwRealAndCanvas(this.ctx!)
  }

  public setMapperBtwRealAndCanvas(ctx: CanvasRenderingContext2D): void {
      this.mbrc = mapperBtwRealAndCanvas(ctx!, this.centerOfView!, this.zoom!) 
  }

  public clearCanvas(): void {
      this.ctx!.clearRect(0, 0, this.ctx!.canvas.width, this.ctx!.canvas.height)
  }

  public visualize(): void {
    if (!this.sysExecParms.display.showActorJourney) this.clearCanvas()
    this.visualizeCanvasInReal()
    this.sys.actGrps.forEach(ag => ag.visualize(this.mbrc!.realToCanvas))
    this.sys.barrierSet?.visualize(this.mbrc!.realToCanvas)
  }

  public  visualizeCanvasInReal(): void {
      const canvasLowerLeft  = new Point(this.ctx!, 0, 0, "Canvas-lower-left")
      const canvasUpperRight = new Point(this.ctx!, this.ctx!.canvas.width, this.ctx!.canvas.height, "Canvas-upper-right")//      const canvasBoxScaled = new Box(ctx!, "canvas-scaled", canvasLowerLeftScaled, canvasUpperRightScaled, new RgbColor(0, 0, 255))
      const canvasBox = new Box(this.ctx!, "canvas", canvasLowerLeft, canvasUpperRight, new RgbColor(0, 0, 255))
      canvasBox.visualize(this.mbrc!.realToCanvas)
  }

  public numActorsOfActGrp(agIdx: number): number | undefined {
      return this.sys.actGrps[agIdx].actors.length
  }

  // ---------------------------------------------------------------------------------------
  // button handlers
  // ---------------------------------------------------------------------------------------

  public runResumeIterationsHandler() {
    this.updateExecParms()
    this.timeSubscription = this.sys.runResumeIterating(this.ctx!)?.subscribe(() => {
      this.time.update(t => t + 1)
      this.visualize()
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
    this.reset()
    this.time.set(0)
    this.timeSubscription?.unsubscribe()
    this.runResumeButtonLabel = "Run"
    this.sys.initialize(this.ctx!, this.sysExecParms)
    this.visualize()
    this.actionsPossible.set(cActPosStart)
  }

  /** home button clicked */
  public onHome() {
    this.home()
    this.visualize()
  }

  /** home button clicked */
  public onFocusOnFirstActGrp() {
    this.centerOfView = this.sys.actGrps[0].centerPoint()
    this.setMapperBtwRealAndCanvas(this.ctx!)
    this.visualize()
  }

  // ---------------------------------------------------------------------------------------
  // parameters inputs event handlers
  // ---------------------------------------------------------------------------------------

  /** update the system with the current execution parameters */
  public updateExecParms(): void {
    this.sys.actGrps.forEach(ag => ag.updateParameters(this.sysExecParms))
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
      const clickedPointInReal = this.mbrc!.canvasToReal(new Point(this.ctx!, event.offsetX, event.offsetY, "clicked"))
      if (this.actorSelected(this.ctx!, clickedPointInReal)) {
          this.canvas!.onmousemove = this.ctxHandleMouseMove.bind(this)
          this.canvas!.onmouseup   = this.ctxHandleMouseUp.bind(this)
          return
      }
      this.centerOfView = clickedPointInReal
  }

  public ctxHandleMouseMove(event: MouseEvent): void {
      event.preventDefault()
      this.handleActorMove(this.ctx!, event.offsetX, event.offsetY)
  }

  public ctxHandleMouseUp(): void {
      this.handleActorDrop(this.ctx!)
      this.canvas!.onmousemove = null
      this.canvas!.onmouseup   = null
  }

  public ctxHandleWheelScroll(event: WheelEvent): void {
     this.handleWheelMotion(this.ctx!, event.deltaY < 0 ? WheelMotion.up : WheelMotion.down)
  }
// ---------------------------------------------------------------------------------------
//      handle canvas UI events
// ---------------------------------------------------------------------------------------

    public actorSelected(ctx: CanvasRenderingContext2D, rp: Point): Actor | undefined {  // x, y are real Points 
        this.pickedActor = this.sys.closestActorInRange(rp, cActorPickMargin / this.zoom!)
        if (this.pickedActor) {
            this.pickedActor.turnHaloOn() // actor selected, turn halo on, do not change center of view
            this.visualize()
            return this.pickedActor
        }
        this.centerOfView = rp // no actor selected, so set center of view to the clicked point
        return undefined
    }

    public handleActorMove(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        if (!this.pickedActor) return
        this.pickedActor.setPosition(this.mbrc!.canvasToReal(new Point(ctx!, x, y)))
        this.visualize()
    }

    public handleActorDrop(ctx: CanvasRenderingContext2D): void {
        this.pickedActor?.turnHaloOff()
        this.pickedActor = undefined
        this.visualize()
    }

    public reset(): void {
        this.clearCanvas()
    }

    public handleWheelMotion(ctx: CanvasRenderingContext2D, motion: WheelMotion): void {
        this.zoom! *= motion == WheelMotion.up ? 2 : 0.5
        this.setMapperBtwRealAndCanvas(ctx)
        this.visualize()
    }

  // ---------------------------------------------------------------------------------------
  // window event handlers
  // ---------------------------------------------------------------------------------------

  public ctxHandleCanvasResized(): void {
      this.ctx!.canvas.width  = window.innerWidth  - cLeftMargin  - cRightMargin
      this.ctx!.canvas.height = window.innerHeight - cUpperMargin - cLowerMargin
  }
}
