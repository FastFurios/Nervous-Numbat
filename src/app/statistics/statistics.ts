import { Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, Signal, Input, effect, signal } from '@angular/core'
import { System } from "../services/system"
import { cUpperMargin, cLowerMargin, cLeftMargin } from "../services/parameters"

// categorical series colors, assigned to the dynamic actor groups in fixed order (validated for CVD separation on a light surface)
const cSeriesColors     = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
const cInk              = "#1a1a19"
const cInkSecondary     = "#5f5e58"
const cGrid             = "#e4e3de"
const cSurface          = "#ffffff"
const cFont             = "11px Arial"
const cPad              = { top: 12, right: 72, bottom: 24, left: 48 }   // plot area insets; right one holds the end labels
const cMaxEndLabels     = 4    // direct labels at the line ends only for this many series or fewer; legend and tooltip carry the rest
const cEndLabelMinGap   = 12   // end labels closer than this (px) are skipped instead of stacked
const cChartHeightShare = 0.6  // share of the main canvas height the chart takes; the table goes below
const cRightSlack       = 20

export type Kpi = "quality" | "performance"

type TooltipRow = { id: string, color: string, value: string }
type Tooltip    = { x: number, alignRight: boolean, step: number, rows: TooltipRow[] }

export function compact(v: number): string {
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}K` : v.toFixed(0)
}

export function percent(v: number): string {
  return `${(v * 100).toFixed(0)}%`
}

/** a "nice" (1, 2, 5 x 10^n) tick distance for showing 0..max with about count ticks */
function niceTickStep(max: number, count: number = 5): number {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n   = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}

// ****************************************************************************************
//      STATISTICS COMPONENT
// ****************************************************************************************

@Component({
  selector: 'app-statistics',
  imports: [],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
})
export class Statistics implements AfterViewInit, OnDestroy {
  @ViewChild('perfCanvas') canvasRef!:  ElementRef<HTMLCanvasElement>
  @Input() public clock!:               Signal<number>
  @Input() public widgetWidth!:         Signal<number>

  public  kpi                                         = signal<Kpi>("performance")
  public  tooltip                                     = signal<Tooltip | undefined>(undefined)
  public  cssWidth                                    = signal(0)
  private ctx?:                         CanvasRenderingContext2D | null
  private cssHeight:                    number        = 0
  private hoverX?:                      number        // mouse x on the canvas in css px; undefined when not hovering
  private readonly onWindowResize                     = () => { this.resize(); this.draw() }

  constructor(public sys: System) {
    effect(() => {
      this.clock() // trigger for this effect
      if (this.ctx) this.draw()
    })
    effect(() => {
      this.widgetWidth() // trigger for this effect
      if (this.ctx) { this.resize(); this.draw() }
    })
  }

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')
    if (!this.ctx) throw Error(`Statistics.ngAfterViewInit(): could not get 2D context from canvas!`)
    window.addEventListener("resize", this.onWindowResize)
    this.resize()
    this.draw()
  }

  ngOnDestroy() {
    window.removeEventListener("resize", this.onWindowResize)
  }

  public seriesColor(groupIdx: number): string {
    return cSeriesColors[groupIdx % cSeriesColors.length]  // at most 8 actor groups can be configured, so no color repeats
  }

  public compact = compact
  public percent = percent

  public selectKpi(kpi: Kpi): void {
    this.kpi.set(kpi)
    this.draw()
  }

  // ---------------------------------------------------------------------------------------
  // mouse event handlers
  // ---------------------------------------------------------------------------------------

  public onMouseMove(event: MouseEvent): void {
    this.hoverX = event.offsetX
    this.draw()
  }

  public onMouseLeave(): void {
    this.hoverX = undefined
    this.draw()
  }

  // ---------------------------------------------------------------------------------------
  // drawing
  // ---------------------------------------------------------------------------------------

  private resize(): void {
    const canvas = this.canvasRef.nativeElement
    const dpr    = window.devicePixelRatio || 1
    this.cssWidth.set(Math.max(200, window.innerWidth * this.widgetWidth() / 100 - cLeftMargin - cRightSlack))
    this.cssHeight = Math.max(150, (window.innerHeight - cUpperMargin - cLowerMargin) * cChartHeightShare)
    canvas.width        = Math.round(this.cssWidth() * dpr)
    canvas.height       = Math.round(this.cssHeight  * dpr)
    canvas.style.width  = `${this.cssWidth()}px`
    canvas.style.height = `${this.cssHeight}px`
    this.ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)  // draw in css px, render sharp on high-dpi screens
  }

  private draw(): void {
    const ctx     = this.ctx!
    const w       = this.cssWidth()
    const h       = this.cssHeight
    const isPerf  = this.kpi() == "performance"
    const history = isPerf ? this.sys.perfHistory : this.sys.qualityHistory
    const format  = isPerf ? compact : percent
    const stride  = this.sys.kpiHistoryStride
    const groups  = this.sys.dynamicActGrps

    ctx.fillStyle = cSurface
    ctx.fillRect(0, 0, w, h)

    // axes: x shrinks so that all steps made so far fit; for performance y grows so that the biggest value so far fits, quality always spans 0..100%
    const xMax   = Math.max(this.clock(), 1)
    const yStep  = isPerf ? niceTickStep(this.sys.perfHistoryMax || 1) : 0.2
    const yMax   = isPerf ? Math.ceil((this.sys.perfHistoryMax || 1) / yStep) * yStep : 1
    const left   = cPad.left, right = w - cPad.right, top = cPad.top, bottom = h - cPad.bottom
    const xPos   = (step: number) => left   + step / xMax * (right - left)
    const yPos   = (v: number)    => bottom - v    / yMax * (bottom - top)

    ctx.font         = cFont
    ctx.lineWidth    = 1
    ctx.fillStyle    = cInkSecondary
    ctx.textAlign    = "right"
    ctx.textBaseline = "middle"
    for (let v = 0; v <= yMax + yStep / 2; v += yStep) {
      ctx.strokeStyle = cGrid
      ctx.beginPath()
      ctx.moveTo(left, Math.round(yPos(v)) + 0.5)
      ctx.lineTo(right, Math.round(yPos(v)) + 0.5)
      ctx.stroke()
      ctx.fillText(format(v), left - 6, yPos(v))
    }
    const xStep = Math.max(1, niceTickStep(xMax))
    ctx.textAlign    = "center"
    ctx.textBaseline = "top"
    for (let s = 0; s <= xMax; s += xStep) ctx.fillText(compact(s), xPos(s), bottom + 6)

    if (history.length == 0 || groups.length == 0) { this.tooltip.set(undefined); return }

    // one line per dynamic actor group
    ctx.lineWidth = 2
    ctx.lineJoin  = "round"
    groups.forEach((_, g) => {
      ctx.strokeStyle = this.seriesColor(g)
      ctx.beginPath()
      history.forEach((perfs, i) => i == 0 ? ctx.moveTo(xPos(0), yPos(perfs[g])) : ctx.lineTo(xPos(i * stride), yPos(perfs[g])))
      ctx.stroke()
    })

    // end dots with direct labels, skipping labels that would collide
    const lastIdx  = history.length - 1
    const ends     = groups.map((ag, g) => ({ id: ag.id, g, y: yPos(history[lastIdx][g]) })).sort((a, b) => a.y - b.y)
    let   prevY    = -Infinity
    ctx.textAlign    = "left"
    ctx.textBaseline = "middle"
    for (const e of ends) {
      this.drawDot(xPos(lastIdx * stride), e.y, this.seriesColor(e.g))
      if (groups.length > cMaxEndLabels || e.y - prevY < cEndLabelMinGap) continue
      ctx.fillStyle = cInk
      ctx.fillText(e.id, xPos(lastIdx * stride) + 8, e.y)
      prevY = e.y
    }

    // hover: crosshair at the nearest recorded step, dots on every line and a tooltip
    if (this.hoverX == undefined || this.hoverX < left || this.hoverX > right) { this.tooltip.set(undefined); return }
    const idx = Math.min(lastIdx, Math.max(0, Math.round((this.hoverX - left) / (right - left) * xMax / stride)))
    const x   = xPos(idx * stride)
    ctx.strokeStyle = cInkSecondary
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(Math.round(x) + 0.5, top)
    ctx.lineTo(Math.round(x) + 0.5, bottom)
    ctx.stroke()
    groups.forEach((_, g) => this.drawDot(x, yPos(history[idx][g]), this.seriesColor(g)))
    this.tooltip.set({
      x,
      alignRight: x > w / 2,
      step:       idx * stride,
      rows:       groups.map((ag, g) => ({ id: ag.id, color: this.seriesColor(g), value: format(history[idx][g]) }))
    })
  }

  /** dot of 8px diameter with a 2px surface ring, so it stays legible where lines cross */
  private drawDot(x: number, y: number, color: string): void {
    const ctx = this.ctx!
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fillStyle   = color
    ctx.fill()
    ctx.lineWidth   = 2
    ctx.strokeStyle = cSurface
    ctx.stroke()
  }
}
