// ****************************************************************************************
//      Geometry
// ****************************************************************************************

import { RgbColor } from "./color"
import { isBetween } from "./helpers"
import { Halo, cActorDotRadius } from "./actor"

const cTolerance = 0.001
export const cMinTriangleAltitude = 20


type  Infinite           = undefined
const infinite: Infinite = undefined
export interface CanvasObject {
    ctx: CanvasRenderingContext2D
    visualize(ctx: CanvasRenderingContext2D, color: RgbColor): void
    toString(): string
}

export class Point implements CanvasObject {
    constructor (public ctx: CanvasRenderingContext2D, public x: number, public y: number, public id: string = "") {}

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
        return this.addConfinedElastic(vec)
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
    public visualize(ctx: CanvasRenderingContext2D, color: RgbColor, halo: Halo = Halo.off): void {
        ctx.beginPath()
        ctx.arc(this.x, this.y, cActorDotRadius, 0, 2 * Math.PI)
        if (halo == Halo.off) {
            ctx.strokeStyle = color.rgbString
            ctx.stroke()
        }
        else {
//          if (halo == Halo.on) console.log(`visualizing point p= ${this}`)
            ctx.strokeStyle = new RgbColor(255, 0, 0).rgbString
            ctx.lineWidth = 10
            ctx.stroke()
            ctx.lineWidth = 1
            ctx.strokeStyle = color.rgbString
        }
        ctx.fillStyle = color.rgbString
        ctx.fill()
        ctx.closePath
    }
    public toString(): string {
        return `Point ${this.id}: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`
    }
}

export class Box implements CanvasObject {
    constructor(public ctx: CanvasRenderingContext2D, public id: string, public lowerLeft: Point, public upperRight: Point, public color: RgbColor) { }

    public visualize(): void {
        this.ctx.beginPath()
        this.ctx.moveTo(this.lowerLeft.x,  this.lowerLeft.y)
        this.ctx.lineTo(this.lowerLeft.x,  this.upperRight.y)
        this.ctx.lineTo(this.upperRight.x, this.upperRight.y)
        this.ctx.lineTo(this.upperRight.x, this.lowerLeft.y)
        this.ctx.lineTo(this.lowerLeft.x,  this.lowerLeft.y)
        this.ctx.strokeStyle = this.color.rgbString
        this.ctx.stroke();
        this.ctx.closePath()
    }
    public toString(): string {
        return `Box ${this.id}: spanned by ${this.lowerLeft} and ${this.upperRight})`
    }
}

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

export type IntersectionType = "none" | "point" | "cover"
export type Intersection     = { type:   IntersectionType,
                          p?:     Point,
                          p2?:    Point }

export class Line implements CanvasObject {
    static newLineFromPointAndVector(ctx: CanvasRenderingContext2D, p: Point, v: Vector, id: string = ""): Line {
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
        return Line.newLineFromPointAndVector(this.ctx, p, this.uv, id)
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
    public visualize(ctx: CanvasRenderingContext2D, color: RgbColor): void {
        ctx.beginPath()
        if (this.isVertical) {
            ctx.moveTo(this.base.x, 0)
            ctx.lineTo(this.base.x, ctx.canvas.height)
        } else
        if (this.isHorizontal) {
            ctx.moveTo(0, this.base.y)
            ctx.lineTo(ctx.canvas.width, this.base.y)
        }
        else {
            const lowerLine = new Line(this.ctx, new Point(this.ctx, 0, 0), new Point(this.ctx, ctx.canvas.width, 0), "lower")
            const upperLine = new Line(this.ctx, new Point(this.ctx, 0, ctx.canvas.height), new Point(this.ctx, ctx.canvas.width, ctx.canvas.height), "upper")
            const boundaryIntersectionLower  = this.intersects(lowerLine)                
            const boundaryIntersectionUpper  = this.intersects(upperLine) 
            ctx.moveTo(boundaryIntersectionLower.p!.x, boundaryIntersectionLower.p!.y)
            ctx.lineTo(boundaryIntersectionUpper.p!.x, boundaryIntersectionUpper.p!.y)
        }
        ctx.strokeStyle = color.rgbString
        ctx.stroke();
        ctx.closePath()
    }
    public toString(): string {
        return `Line ${this.id}: Base ${this.base}, ${this.uv})`
    }
}

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

    public override visualize(ctx: CanvasRenderingContext2D, color: RgbColor): void {
        ctx.beginPath()
        ctx.moveTo(this.base.x, this.base.y)
        ctx.lineTo(this.p2.x,   this.p2.y)
        ctx.strokeStyle = color.rgbString
        ctx.stroke();
        ctx.closePath()
    }
    public override toString(): string {
        return `Line segment ${this.id}: from ${this.base} to ${this.p2}, length= ${this.length.toFixed(1)}`
    }
}

