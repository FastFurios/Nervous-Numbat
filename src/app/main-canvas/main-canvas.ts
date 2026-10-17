import { Component, ViewChild, ElementRef, AfterViewInit, Signal, Input, Output, EventEmitter, effect } from '@angular/core'
import { FormsModule  } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { System } from "../services/system"
import { RgbColor } from "../services/color"
import { Point, Box, canvasCenter, MapperBtwRealAndCanvas, mapperBtwRealAndCanvas  } from "../services/geometry"
import { Actor } from "../services/actor"
import { cUpperMargin, cLowerMargin, cLeftMargin, cRightMargin, cActorPickMargin, cControlPanelWidth } from "../services/parameters"
import { SystemDisplayParms, CanvasSize } from '../control-panel/control-panel'

const cZoomFactor = 1.1
const cHomeFitFactor = 0.95  // share of the canvas the world box fills after "home", leaves a small margin around the border barriers

type RunResumeButtonLabel = "Run" | "Resume"

enum WheelMotion {
  up,
  down
}

// ****************************************************************************************
//      MAIN CANVAS COMPONENT
// ****************************************************************************************

@Component({
  standalone: true,
  selector:     'app-main-canvas',
  imports:      [FormsModule, CommonModule],
  templateUrl:  './main-canvas.html',
  styleUrls:    ['./main-canvas.css']
})
export class MainCanvas implements AfterViewInit {
  @ViewChild('myCanvas') canvasRef!:    ElementRef<HTMLCanvasElement>
  @Input() public id:                   number                                = -1
  @Input() public hasCanvas:            boolean                               = false
  @Input() public isMainCanvas:         boolean                               = false
  @Input() public clock!:               Signal<number>  
  @Input() public widgetWidth!:         Signal<number>  
  @Output() canvasSizeDetermined                                              = new EventEmitter<CanvasSize>();
  
//public  BoundaryMode                                                        = BoundaryMode 
  public  sysDisplayParms!:             SystemDisplayParms
  public  runResumeButtonLabel:         RunResumeButtonLabel                  = "Run"
  private canvas!:                      HTMLCanvasElement | null
  private ctx?:                         CanvasRenderingContext2D | null
  private mbrc?:                        MapperBtwRealAndCanvas
  private centerOfView?:                Point                                   
  private zoom?:                        number  // zoom > 1: zoomed in ; z < 1: zommed out
  private pickedActor:                  Actor | null | undefined                = undefined
  public  readonly controlPanelWidth:   number                                  = cControlPanelWidth

  constructor(public sys: System) {
    this.sysDisplayParms = {
      showActorId:                            false,
      showTriangle:                           true,
      showActorTriangleQuality:               false,
      showActorObservees:                     false,
      showActorGroupIdAndQuality:             false,
      showActorJourney:                       false,
      showOneActorOnlyWithTheGivenAgIndex:    -1,
    }

    effect(() => {
//    console.log(`main-canvas #${this.id}.effect(#1): clock= ${this.clock()}; visualizing...`)
      this.clock() // trigger for this effect
      if (this.ctx) this.visualize()
    })

    effect(() => {
// const newCtx = this.canvasRef.nativeElement.getContext('2d')
      console.log(`main-canvas #${this.id}.effect(#2): widgetWith= ${this.widgetWidth()}; visualizing...`)

      this.widgetWidth() // trigger for this effect 
      if (this.ctx) {
        this.handleCanvasResized(false)
        this.home() // widget layout changed: fit the world box into the resized canvas again
        this.visualize()
      }
    })
  }

  ngAfterViewInit() {
      this.canvas = this.canvasRef.nativeElement
      this.ctx = this.canvas.getContext('2d')
      if (!this.ctx) throw Error(`main-canvas #${this.id}.ngAfterViewInit(): could not get 2D context from canvas!`)

      window.addEventListener("resize", this.handleCanvasResized.bind(this, false))
      this.handleCanvasResized(true)

      this.canvas.onmousedown = this.ctxHandleMouseDown.bind(this)
      this.canvas.addEventListener("wheel", this.ctxHandleWheelScroll.bind(this))

      this.home()
      console.log(`main-canvas #${this.id}.ngAfterViewInit(): clearing canvas...`)
      this.clearCanvas()
      this.visualize()
      console.log(`main-canvas #${this.id}.ngAfterViewInit(): done`)
  }

  /** fit the world box into the canvas */
  private home():void {
    const ws = this.sys.worldSize
    if (!ws) {
      this.centerOfView = canvasCenter(this.ctx!)
      this.zoom         = 1
    } else {
      this.centerOfView = this.sys.worldCenter!
      this.zoom         = cHomeFitFactor * Math.min(this.ctx!.canvas.width / ws.width, this.ctx!.canvas.height / ws.height)
    }
    this.setMapperBtwRealAndCanvas(this.ctx!)
  }

  public setMapperBtwRealAndCanvas(ctx: CanvasRenderingContext2D): void {
      this.mbrc = mapperBtwRealAndCanvas(ctx!, this.centerOfView!, this.zoom!, []) 
  }

  public clearCanvas(): void {
      this.ctx!.clearRect(0, 0, this.ctx!.canvas.width, this.ctx!.canvas.height)
  }

  public visualize(): void {
    if (!this.sysDisplayParms.showActorJourney) this.clearCanvas()
    this.visualizeCanvasInReal()
    this.sys.actGrps.forEach(ag => ag.visualize(this.ctx!, this.mbrc!.realToCanvas, this.sysDisplayParms))
    this.sys.barriers.map(b => b.visualize(this.ctx!, this.mbrc!.realToCanvas))
  }

  /** draws the world box, i.e. the area enclosed by the canvas border barriers; its size is fixed at system initialization and independent of this canvas' current size */
  public  visualizeCanvasInReal(): void {
      const worldSize        = this.sys.worldSize ?? { width: this.ctx!.canvas.width, height: this.ctx!.canvas.height }
      const canvasLowerLeft  = new Point(0, 0, "Canvas-lower-left")
      const canvasUpperRight = new Point(worldSize.width, worldSize.height, "Canvas-upper-right")
      const canvasBox = new Box("canvas", canvasLowerLeft, canvasUpperRight, new RgbColor(0, 0, 255))
      canvasBox.visualize(this.ctx!, this.mbrc!.realToCanvas)
  }

  public numActorsOfActGrp(agIdx: number): number | undefined {
      return this.sys.actGrps[agIdx].actors.length
  }

  /** home button clicked */
  public onHome() {
    this.home()
    this.visualize()
  }

  /** focus in first actor group button clicked */
  public onFocusOnFirstActGrp() {
    this.centerOfView = this.sys.actGrps[0].centerPoint()
    this.setMapperBtwRealAndCanvas(this.ctx!)
    this.visualize()
  }

  // ---------------------------------------------------------------------------------------
  // canvas mouse event handlers
  // ---------------------------------------------------------------------------------------

  public ctxHandleMouseDown(event: MouseEvent): void {
      console.log(`MainCanvas.ctxhandleMouseDown(event= ${event}): canvas= ${this.canvas}`)
      event.preventDefault()
      const clickedPointInReal = this.mbrc!.canvasToReal(new Point(event.offsetX, event.offsetY, "clicked"))
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
        this.pickedActor.setPosition(this.mbrc!.canvasToReal(new Point(x, y)), [])
        this.visualize()
    }

    public handleActorDrop(ctx: CanvasRenderingContext2D): void {
        this.pickedActor?.turnHaloOff()
        this.pickedActor = undefined
        this.visualize()
    }

      public handleWheelMotion(ctx: CanvasRenderingContext2D, motion: WheelMotion): void {
        this.zoom! *= motion == WheelMotion.up ? cZoomFactor : 1 / cZoomFactor
        this.setMapperBtwRealAndCanvas(ctx)
        this.clearCanvas()
        this.visualize()
    }

  // ---------------------------------------------------------------------------------------
  // other  event handlers
  // ---------------------------------------------------------------------------------------

  public handleCanvasResized(informControlPanel: boolean): void {
      this.ctx!.canvas.width  = window.innerWidth * this.widgetWidth() / 100 - cLeftMargin  - cRightMargin - cControlPanelWidth
      this.ctx!.canvas.height = window.innerHeight  - cUpperMargin - cLowerMargin
      if (informControlPanel) this.canvasSizeDetermined.emit(this.ctxCanvasSize)
      if (this.mbrc) this.setMapperBtwRealAndCanvas(this.ctx!) // mapper depends on the canvas center, so it is stale after a resize

  }

  private get ctxCanvasSize(): CanvasSize {
      return {
          width:  this.ctx!.canvas.width,
          height: this.ctx!.canvas.height 
      }
  }

  /** update the system with the current execution parameters */
  public updateDisplayParms(): void {
      this.visualize()
  }



}
