// ****************************************************************************************
//      Geometry
// ****************************************************************************************

// Exakte Flächenberechnung der Dreiecksgruppe: 
// $ npm install martinez-polygon-clipping (siehe ChatGPT für "Polygon Union")

import { cDefaultColor, RgbColor } from "./color"
import { isBetween } from "./helpers"
import { Halo, cActorDotRadius } from "./actor"
import { cTextOffset } from "./parameters"

const cTolerance = 0.001
export const cMinTriangleAltitude = 20


type  Infinite           = undefined
const infinite: Infinite = undefined
export interface CanvasObject {
    ctx: CanvasRenderingContext2D
    visualize(m2c: MapperRealToCanvas, color?: RgbColor): void
    toString(): string
}

// "real": means a real coordinate as it lives in the geometry before being mapped onto the canvas for display 
export type MapperRealToCanvas = (rp: Point) => Point
export type MapperCanvasToReal = (cp: Point) => Point
export type MapperBtwRealAndCanvas = { 
    realToCanvas: MapperRealToCanvas,  // maps a real Point of the systen onto a Point on the canvas 
    canvasToReal: MapperCanvasToReal   // maps a canvas Point onto a real Point in the system
}
export function mapperBtwRealAndCanvasStraight(): MapperBtwRealAndCanvas {
    return {
        realToCanvas: (rp: Point): Point => rp,
        canvasToReal: (cp: Point): Point => cp
    }
}


// --------------------------------------------------------------------------------------
//     POINT  
// --------------------------------------------------------------------------------------
export class Point implements CanvasObject {
    constructor (public ctx: CanvasRenderingContext2D, public x: number, public y: number, public id: string = "") {
//      console.log(`Point(${this.x.toFixed(0)} / ${this.y.toFixed(0)}).constructor(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
    }

    public addFree(vec: Vector): Point {
        return new Point(this.ctx, this.x + vec.dx, this.y + vec.dy)
    }
    private addConfinedElastic(vec: Vector): Point {  // result is within the canvas boundaries
        const pGross = this.addFree(vec)
        const xNet =    pGross.x < 0
                            ? - pGross.x
                            : pGross.x < this.ctx.canvas.width 
                                ? pGross.x
                                : 2 * this.ctx.canvas.width - pGross.x
        const yNet =    pGross.y < 0
                            ? - pGross.y
                            : pGross.y < this.ctx.canvas.height 
                                ? pGross.y
                                : 2 * this.ctx.canvas.height - pGross.y
        const aux = new Point(this.ctx, xNet, yNet)
        return aux 
    }
    private addConfinedUnelastic(vec: Vector): Point {  // result is within the canvas boundaries
        const pGross = this.addFree(vec)
        const xNet   = pGross.x < 0 ? 0 : pGross.x > this.ctx.canvas.width  ? this.ctx.canvas.width  : pGross.x
        const yNet   = pGross.y < 0 ? 0 : pGross.y > this.ctx.canvas.height ? this.ctx.canvas.height : pGross.y
        const aux = new Point(this.ctx, xNet, yNet)
        return aux 
    }
    public add(vec: Vector): Point {  // alias
//      return this.addConfinedUnelastic(vec)
        return this.addFree(vec)
    }
    public vectorTo(p: Point): Vector {
        return new Vector(p.x - this.x, p.y - this.y)
    }
    public distanceTo(p: Point): number {
        return this.vectorTo(p).length
    }
    public nearby(p: Point, margin: number): boolean {
        return this.distanceTo(p) < margin
    }
    public isInBox(p1: Point, p2: Point): boolean {
        const xMin = Math.min(p1.x, p2.x)
        const xMax = Math.max(p1.x, p2.x)
        const yMin = Math.min(p1.y, p2.y)
        const yMax = Math.max(p1.y, p2.y)
        return isBetween(this.x, xMin, xMax) && isBetween(this.y, yMin, yMax)
    }
    public closerTo(toPoints: [Point, Point]): Point {
        return this.distanceTo(toPoints[0]) < this.distanceTo(toPoints[1]) ? toPoints[0] : toPoints[1] 
    }
    public fartherTo(toPoints: [Point, Point]): Point {
        return this.closerTo(toPoints) == toPoints[0] ? toPoints[1] : toPoints[0]
    }
    public equalsTo(p: Point): boolean {
        return Math.abs(p.x - this.x) < cTolerance && Math.abs(p.y - this.y) < cTolerance
    }
    public scaledBy(factor: number): Point {
        return new Point(this.ctx, this.x * factor, this.y * factor, this.id)
    }
    public visualize(m2c: MapperRealToCanvas, color: RgbColor, halo: Halo = Halo.off, label?: string): void {
//      console.log(`Point(${this.x.toFixed(0)} / ${this.y.toFixed(0)}).visualize(): ctx dimension is ${this.ctx.canvas.width} x ${this.ctx.canvas.height}`)
        this.ctx.beginPath()
        const cp = m2c(this)
        this.ctx.arc(cp.x, cp.y, cActorDotRadius, 0, 2 * Math.PI)
        if (halo == Halo.off) {
            this.ctx.strokeStyle = color.rgbString
            this.ctx.stroke()
        }
        else {
//          if (halo == Halo.on) console.log(`visualizing point p= ${this}`)
            this.ctx.strokeStyle = new RgbColor(255, 0, 0).rgbString
            this.ctx.lineWidth = 10
            this.ctx.stroke()
            this.ctx.lineWidth = 1
            this.ctx.strokeStyle = color.rgbString
        }
        this.ctx.fillStyle = color.rgbString
        this.ctx.fill()
        this.ctx.closePath
        if (label != "") {
            this.ctx.font = "12px Arial"
            this.ctx.fillText(`${label} (${this.x.toFixed(0)}/${this.y.toFixed(0)})`, this.x, this.y + cTextOffset)
        }
    }
    public toString(): string {
        return `Point ${this.id}: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`
    }
}

// --------------------------------------------------------------------------------------
//     BOX  
// --------------------------------------------------------------------------------------
export class Box implements CanvasObject {
    static fromCanvas(ctx: CanvasRenderingContext2D): Box {
        return new Box(ctx, "canvas", new Point(ctx, 0, 0), new Point(ctx, ctx.canvas.width, ctx.canvas.height), cDefaultColor)
    }

    constructor(public ctx: CanvasRenderingContext2D, public id: string, public lowerLeft: Point, public upperRight: Point, public color: RgbColor) { }

    public get width(): number {
        return this.upperRight.x - this.lowerLeft.x
    }
    public get height(): number {
        return this.upperRight.y - this.lowerLeft.y
    }
    public center(): Point {
        return new Point(this.ctx, this.lowerLeft.x + (this.width / 2), this.upperRight.y - (this.height / 2) )
    }
    public scaleToFitInto(b: Box): number { // scaling factor to be applied to this box in order to fit into b
        const xScaling = b.width  / this.width
        const yScaling = b.height / this.height
        return xScaling < yScaling ? xScaling : yScaling
    }
    public scaledBy(factor: number): Box {
        return new Box(this.ctx, this.id, this.lowerLeft.scaledBy(factor), this.upperRight.scaledBy(factor), this.color)
    }
/*
    public scaleToFitIntoCanvas(): number { // scaling factor to be applied to this box in order to fit into the canvas
        const canvas = Box.fromCanvas(this.ctx)
        return this.scaleToFitInto(canvas)
    }
*/
    public visualize(m2c: MapperRealToCanvas): void {
        const lowerLeft  = m2c(this.lowerLeft)
        const upperRight = m2c(this.upperRight)
        this.ctx.beginPath()
        this.ctx.moveTo(lowerLeft.x,  lowerLeft.y)
        this.ctx.lineTo(lowerLeft.x,  upperRight.y)
        this.ctx.lineTo(upperRight.x, upperRight.y)
        this.ctx.lineTo(upperRight.x, lowerLeft.y)
        this.ctx.lineTo(lowerLeft.x,  lowerLeft.y)
        this.ctx.strokeStyle = this.color.rgbString
        this.ctx.stroke();
        this.ctx.closePath()
    }
    public toString(): string {
        return `Box ${this.id}: spanned by ${this.lowerLeft} and ${this.upperRight})`
    }
}

// --------------------------------------------------------------------------------------
//     VECTOR  
// --------------------------------------------------------------------------------------
export class Vector { 
    static newVectorfromUnitVectorAndDistance(uv: UnitVector, distance: number): Vector {
        return new Vector(uv.dx * distance, uv.dy * distance)
    }
    static newRandomVector(length: number): Vector {
        const dx = 2 * Math.random() - 1
        const dy = 2 * Math.random() - 1
        return new Vector(dx, dy).scale(length)
    }
    constructor (public dx: number, public dy: number, public id: string = "") {}

    public scale(factor: number): Vector {
        return new Vector(this.dx * factor, this.dy * factor)
    }
    get length(): number {
        return Math.sqrt(this.dx**2 + this.dy**2)
    }
    get inverted(): Vector {
        return new Vector (-this.dx, -this.dy)
    }
    get perpendicular(): Vector {
        return new Vector(this.dy, -this.dx)
    }
    public toString(): string {
        return `Vector (${this.dx.toFixed(0)}, ${this.dy.toFixed(0)}), length= ${this.length.toFixed(0)}}`
    }
}

// --------------------------------------------------------------------------------------
//     UNIT VECTOR  
// --------------------------------------------------------------------------------------
export class UnitVector extends Vector {
    static newFromVector(v: Vector): UnitVector {
        return new UnitVector(v.dx, v.dy)
    }
    constructor(dx: number, dy: number) {
        const s = 1 / Math.sqrt(dx**2 + dy**2)
        super(s * dx, s * dy)
    }
    override get length(): number {
//      return Math.sqrt(this.dx**2 + this.dy**2) // 1
        return 1
    }
    override get inverted(): UnitVector {
        return UnitVector.newFromVector(new Vector(-this.dx, -this.dy).inverted)
    }
    override get perpendicular(): UnitVector {
        return UnitVector.newFromVector(new Vector(this.dx, this.dy).perpendicular)
    }
    public isEqual(uv: UnitVector): boolean {
        return Math.abs(uv.dx - this.dx) < cTolerance && Math.abs(uv.dy - this.dy) < cTolerance 
    }
    public isEqualInOneOfBothDirection(uv: UnitVector): boolean {
        return uv.isEqual(this) || uv.inverted.isEqual(this) 
    }
    public override toString(): string {
        return `UnitVector= (${this.dx.toPrecision(2)}, ${this.dy.toPrecision(2)})`
    }
}

// --------------------------------------------------------------------------------------
//     LINE  
// --------------------------------------------------------------------------------------
export type IntersectionType = "none" | "point" | "cover"
export type Intersection     = { type:   IntersectionType,
                          p?:     Point,
                          p2?:    Point }

export class Line implements CanvasObject {
    static fromPointAndVector(ctx: CanvasRenderingContext2D, p: Point, v: Vector, id: string = ""): Line {
        return new Line(ctx, p, p.addFree(v), id)
    }
    public uv: UnitVector

    constructor(public ctx: CanvasRenderingContext2D, public base: Point, p2: Point, public id: string = "") {
        this.uv = UnitVector.newFromVector(new Vector(p2.x - base.x, p2.y - base.y))
    }
    get perpendicular(): UnitVector {
        return this.uv.perpendicular
    }
    public parallel(p: Point, id: string = ""): Line {
        return Line.fromPointAndVector(this.ctx, p, this.uv, id)
    }
    public isParallel(l: Line): boolean {
        return this.uv.isEqualInOneOfBothDirection(l.uv)
    }
    public touches(p: Point): boolean {
        return UnitVector.newFromVector(p.vectorTo(this.base)).isEqualInOneOfBothDirection(this.uv)
    }
    get isVertical(): boolean {
        return Math.abs(this.uv.dx) < cTolerance
    }
    get isHorizontal(): boolean {
        return Math.abs(this.uv.dy) < cTolerance
    }
    public intersects(l: Line): Intersection  {
        if (l.uv.isEqualInOneOfBothDirection(this.uv))  // is a parallel line 
            if (this.touches(l.base)) // one on the other
                return { type: "cover" }
            else
                return { type: "none"}
        if (this.isVertical)
            return { type: "point", p: l.base.addFree(l.uv.scale((this.base.x - l.base.x) / l.uv.dx)) }
        if (this.isHorizontal)
            return { type: "point", p: l.base.addFree(l.uv.scale((this.base.y - l.base.y) / l.uv.dy)) }
        // from here on we know that this this line is neither vertical nor horizontal and l is not parallel 
        const kx = (l.base.x - this.base.x) / this.uv.dx
        const ky = (l.base.y - this.base.y) / this.uv.dy
        const qx = l.uv.dx / this.uv.dx
        const qy = l.uv.dy / this.uv.dy
        return { type: "point", p: l.base.addFree(l.uv.scale((ky - kx) / (qx - qy))) }
    }
    public visualize(m2c: MapperRealToCanvas, color: RgbColor): void {
        const cbase = m2c(this.base)
        this.ctx.beginPath()
        if (this.isVertical) {
            this.ctx.moveTo(cbase.x, 0)
            this.ctx.lineTo(cbase.x, this.ctx.canvas.height)
        } else
        if (this.isHorizontal) {
            this.ctx.moveTo(0, cbase.y)
            this.ctx.lineTo(this.ctx.canvas.width, cbase.y)
        }
        else {
            const lowerLine = new Line(this.ctx, new Point(this.ctx, 0, 0), new Point(this.ctx, this.ctx.canvas.width, 0), "lower")
            const upperLine = new Line(this.ctx, new Point(this.ctx, 0, this.ctx.canvas.height), new Point(this.ctx, this.ctx.canvas.width, this.ctx.canvas.height), "upper")
            const boundaryIntersectionLower  = Line.fromPointAndVector(this.ctx, m2c(this.base), this.uv).intersects(lowerLine)                
            const boundaryIntersectionUpper  = Line.fromPointAndVector(this.ctx, m2c(this.base), this.uv).intersects(upperLine) 
            this.ctx.moveTo(boundaryIntersectionLower.p!.x, boundaryIntersectionLower.p!.y)
            this.ctx.lineTo(boundaryIntersectionUpper.p!.x, boundaryIntersectionUpper.p!.y)
        }
        this.ctx.strokeStyle = color.rgbString
        this.ctx.stroke();
        this.ctx.closePath()
    }
    public toString(): string {
        return `Line ${this.id}: Base ${this.base}, ${this.uv})`
    }
}

// --------------------------------------------------------------------------------------
//     LINE SEGMENT  
// --------------------------------------------------------------------------------------
export class LineSegment extends Line {
    constructor(ctx: CanvasRenderingContext2D, base: Point, public p2: Point, id: string = "") {
        super(ctx, base, p2, id)
    }
    get length(): number {
        return this.base.vectorTo(this.p2).length
    }
    get middle(): Point {
        return new Point(this.ctx, (this.base.x + this.p2.x) / 2, (this.base.y + this.p2.y) / 2)
    }
    public override touches(p: Point): boolean {
        return super.touches(p) && p.isInBox(this.base, this.p2)       
    }
    public override intersects(l: Line): Intersection {
        const lineIntersection = super.intersects(l)
        if (lineIntersection.type == "none") 
            return  { type: "none" }
        if (lineIntersection.type == "point")
            if (UnitVector.newFromVector(lineIntersection.p!.vectorTo(this.base).inverted).isEqual(
                UnitVector.newFromVector(lineIntersection.p!.vectorTo(this.p2))))
                return lineIntersection // the line cut within the boundaries of the line segment 
            else
                return { type: "none" } // the line misses the line segment
        return { type: "cover", p: this.base, p2: this.p2} // the line segment resides on the line 
    }
    get equilateralVertices(): [Point, Point] {
        const altitude = Math.sqrt(3)/2 * this.length
        if (this.isVertical) 
            return [this.middle.add(new Vector(altitude, 0)), this.middle.add(new Vector(-altitude, 0))]  
        if (this.isHorizontal)
            return [this.middle.add(new Vector(0, altitude)), this.middle.add(new Vector(0, -altitude))]  
        const v0 = this.middle.add(this.perpendicular.scale( Math.max(altitude, cMinTriangleAltitude)))
        const v1 = this.middle.add(this.perpendicular.scale(-Math.max(altitude, cMinTriangleAltitude)))
        return [v0, v1]
    }

    public override visualize(m2c: MapperRealToCanvas, color: RgbColor): void {
        const cbase = m2c(this.base)
        const cp2   = m2c(this.p2)
        this.ctx.beginPath()
        this.ctx.moveTo(cbase.x, cbase.y)
        this.ctx.lineTo(cp2.x,   cp2.y)
        this.ctx.strokeStyle = color.rgbString
        this.ctx.stroke();
        this.ctx.closePath()
    }
    public override toString(): string {
        return `Line segment ${this.id}: from ${this.base} to ${this.p2}, length= ${this.length.toFixed(1)}`
    }
}

