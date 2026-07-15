// ****************************************************************************************
//      Geometry
// ****************************************************************************************

// Exakte Flächenberechnung der Dreiecksgruppe: 
// $ npm install martinez-polygon-clipping (siehe ChatGPT für "Polygon Union")

import { cDefaultColor, RgbColor } from "./color"
import { isBetween } from "./helpers"
import { Halo, cActorDotRadius, DebugTrail } from "./actor"
import { cTextOffset } from "./parameters"
import { Barrier } from "./barrier"
import { SystemDisplayParms } from "../control-panel/control-panel"

const cTolerance = 0.01
const cMinBarrierOffset = 2
const cMinRebound       = 5
export const cMinTriangleAltitude = 20


type  Infinite           = undefined
const infinite: Infinite = undefined

export type FromToPoints = {
    from: Point
    to:   Point
}

export interface CanvasObjectBasic {
    visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, color: RgbColor, debugTrail: DebugTrail):   void
    toString(): string
}

export interface CanvasObjectDisplayParms {
    visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, sdp: SystemDisplayParms, color?: RgbColor):   void
    toString(): string
}

export interface Boxable {
    boxAround(): Box
}


// "real": means a real coordinate as it lives in the geometry before being mapped onto the canvas for display 
export type MapperRealToCanvas = (rp: Point) => Point
export type MapperCanvasToReal = (cp: Point) => Point
export type MapperBtwRealAndCanvas = { 
    realToCanvas: MapperRealToCanvas,  // maps a real Point of the systen onto a Point on the canvas 
    canvasToReal: MapperCanvasToReal   // maps a canvas Point onto a real Point in the system
}
export function canvasCenter(ctx: CanvasRenderingContext2D): Point {
    return new Point(ctx.canvas.width / 2, ctx.canvas.height / 2)
}

export function mapperBtwRealAndCanvas(ctx: CanvasRenderingContext2D, center: Point, scaleFactor: number, debugTrail: DebugTrail): MapperBtwRealAndCanvas {
    const shiftVector: Vector = center.scaledBy(scaleFactor).vectorTo(canvasCenter(ctx)) 
    return {
        realToCanvas: (rp: Point) => rp.scaledBy(scaleFactor).addFree(shiftVector, debugTrail), 
        canvasToReal: (cp: Point) => cp.addFree(shiftVector.inverted, debugTrail).scaledBy(1 / scaleFactor)
    }
}

export enum BoundaryMode {
  inelastic = "inelastic",
  rebound   = "rebound",
  boundless = "boundless"
} 

function xMin(p1: Point, p2: Point): number { return p1.x < p2.x ? p1.x : p2.x }
function xMax(p1: Point, p2: Point): number { return p1.x > p2.x ? p1.x : p2.x }
function yMin(p1: Point, p2: Point): number { return p1.y < p2.y ? p1.y : p2.y }
function yMax(p1: Point, p2: Point): number { return p1.y > p2.y ? p1.y : p2.y }
 
type _Collision = {
    barrier:        Barrier,
    intersecType:   IntersectionType
    point?:         Point,
    distance?:      number
}

class Collision {
    constructor (public barrier:        Barrier,
                 public intersecType:   IntersectionType,
                 public point?:         Point,
                 public distance?:      number) {}

    public toString(): string {
        return `Collision ${this.intersecType} into ${this.barrier} at ${this.point} ${this.distance} away)`
    }           
}

// --------------------------------------------------------------------------------------
//     COORDINATE  
// --------------------------------------------------------------------------------------
export class Coordinate {
    constructor(public x: number, public y: number) { }

    public toPoint(ctx: CanvasRenderingContext2D, id?: string): Point {
        return new Point(this.x, this.y, id)
    }
}

// --------------------------------------------------------------------------------------
//     POINT  
// --------------------------------------------------------------------------------------
export class Point extends Coordinate implements CanvasObjectBasic, Boxable {
    static boundaryMode: BoundaryMode = BoundaryMode.rebound

    constructor (x: number, y: number, public id: string = "") { 
        super(x, y)
    }

    private barrierCollision(b: Barrier, pGross: Point, debugTrail: DebugTrail): Collision {
        const iSec: Intersection = b.intersectsLineSegment(new LineSegment(this, pGross), debugTrail)
        const aux =  new Collision(
            b,
            iSec.type,
            iSec.p,
            iSec.p ? this.distanceTo(iSec.p) : undefined
        )
//      debugTrail.push(`__Geometry.Point.barrierCollision() for pGross= ${pGross}:  ${aux}`)
        return aux
    }

    private nearestCollisionPoint(bs: Barrier[], pGross: Point, debugTrail: DebugTrail): Collision | undefined {
        // barriers in the neigborhood: 
        const nearbyBarriers: Barrier[] = bs .filter(
            (b => !(
                   xMax(b.base, b.p2) < xMin(this, pGross)
                || xMin(b.base, b.p2) > xMax(this, pGross)
                || yMax(b.base, b.p2) < yMin(this, pGross)
                || yMin(b.base, b.p2) > yMax(this, pGross)
            )))  // all barriers that aren't entirely beyond the box area of this and pGross
//      debugTrail.push(`__Geometry.Point.nearestCollisionPoint(): nearbyBarriers= ${nearbyBarriers}`)

        // check nearby barriers and see if they are in our way:
        const barriersCollisions: Collision[] = nearbyBarriers
            .map(b => this.barrierCollision(b, pGross, debugTrail))
            .filter((bc: Collision) => bc.intersecType != "none")
        if (barriersCollisions.length < 1) { 
//          debugTrail.push(`__Geometry.Point.nearestCollisionPoint(): no barriersCollisions`)
            return undefined
        }
        // we have at least one barrier collision. Find the closest one. That's the point we are going to be deflected from.    
        
        const nearestBarrierCollision = barriersCollisions.reduce((bc1: Collision, bc2: Collision) => bc1.distance! < bc2.distance! ? bc1 : bc2)
        // now we know from which barrier at what point we are going to deflect    
//     debugTrail.push(`__Geometry.Point.nearestCollisionPoint(): nearestBarrierCollision= ${nearestBarrierCollision}`)
        return nearestBarrierCollision    
    }

    public addFree(vec: Vector, debugTrail: DebugTrail): Point {
        return new Point(this.x + vec.dx, this.y + vec.dy)
    }

    private addBarrierSensitive(vec: Vector, bs: Barrier[], boundaryMode: BoundaryMode, debugTrail: DebugTrail): Point {  // result is within the canvas boundaries
        const pGross = this.addFree(vec, debugTrail)  // if we had no barriers in our way
//      debugTrail.push(`__Geometry.Point.addBarrierSensitive(${vec}): pGross= ${pGross}`)

        const nearestCollision = this.nearestCollisionPoint(bs, pGross, debugTrail) // where do we hit into the first barrier on our way?
        if (!nearestCollision) { // our way is free
//          debugTrail.push(`__Geometry.Point.addBarrierSensitive(): no collision detected`)
            return pGross
        }
        // from here on we know we hit a barrier
//      debugTrail.push(`__Geometry.Point.addBarrierSensitive(): collision detected at ${nearestCollision.point}`)

        let aux: Point | undefined

        if (nearestCollision!.barrier.isVertical) {
//           debugTrail.push(`__Geometry.Point.addBarrierSensitive(): vertical barrier hit`)
             aux = boundaryMode == BoundaryMode.inelastic 
                ? nearestCollision!.point!.addFree(Vector.newVectorfromUnitVectorAndDistance(new UnitVector(-vec.dx, 0), cMinBarrierOffset), debugTrail) // rebound just a little bit from the collision point so the new point is not on the barrier but nearby 
                : nearestCollision!.point!.addBarrierSensitive(Vector.newVectorfromUnitVectorAndDistance(new UnitVector(-vec.dx, vec.dy), Math.max(vec.length - nearestCollision.distance!, cMinRebound)), bs, BoundaryMode.inelastic, debugTrail)
        } else if (nearestCollision!.barrier.isHorizontal) {
//           debugTrail.push(`__Geometry.Point.addBarrierSensitive(): horizontal barrier hit`)
             aux =  boundaryMode == BoundaryMode.inelastic 
                ? nearestCollision!.point!.addFree(Vector.newVectorfromUnitVectorAndDistance(new UnitVector(0, -vec.dy), cMinBarrierOffset), debugTrail) // rebound just a little bit from the collision point so the new point is not on the barrier but nearby
                : nearestCollision!.point!.addBarrierSensitive(Vector.newVectorfromUnitVectorAndDistance(new UnitVector(vec.dx, -vec.dy), Math.max(vec.length - nearestCollision.distance!, cMinRebound)), bs, BoundaryMode.inelastic, debugTrail)        
        } else throw Error(`__Geometry.Point.addBarrierElastic(): barrier ${nearestCollision!.barrier} is neither vertical nor horizontal`)

        return aux!
    }
    
    public add(vec: Vector, bs: Barrier[], debugTrail: DebugTrail): Point {  // alias
        if (Point.boundaryMode == BoundaryMode.boundless) { 
//          debugTrail.push(`__Geometry.Point ${this}.add(vec= ${vec}): returning p-new= ${this.addFree(vec, debugTrail)}`)
            return this.addFree(vec, debugTrail)
        }
//      debugTrail.push(`__Geometry.Point ${this}.add(vec= ${vec}): returning p-new= ${this.addBarrierSensitive(vec, bs, Point.boundaryMode, debugTrail)}`)
        return this.addBarrierSensitive(vec, bs, Point.boundaryMode, debugTrail)
    }
    public vectorTo(c: Coordinate): Vector {
        return new Vector(c.x - this.x, c.y - this.y)
    }
    public distanceTo(c: Coordinate): number {
        return this.vectorTo(c).length
    }
    public nearby(c: Coordinate, margin: number): boolean {
        return this.distanceTo(c) < margin
    }
    public boxAround(): Box {
        return new Box(`Box of ${this.id}`, new Point(this.x, this.y), new Point(this.x, this.y))
    }
    public isIn(b: Box): boolean {
        return isBetween(this.x, b.lowerLeft.x, b.upperRight.x) && isBetween(this.y, b.lowerLeft.y, b.upperRight.y)
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
        return new Point(this.x * factor, this.y * factor, this.id)
    }
    public visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, color: RgbColor, debugTrail: DebugTrail, halo: Halo = Halo.off, label?: string): void {
        ctx.beginPath()
        const cp = m2c(this)
        ctx.arc(cp.x, cp.y, cActorDotRadius, 0, 2 * Math.PI)
        if (halo == Halo.off) {
            ctx.strokeStyle = color.rgbString
            ctx.stroke()
        }
        else {
            ctx.strokeStyle = new RgbColor(255, 0, 0).rgbString
            ctx.lineWidth = 10
            ctx.stroke()
            ctx.lineWidth = 1
            ctx.strokeStyle = color.rgbString
        }
        ctx.fillStyle = color.rgbString
        ctx.fill()
        ctx.closePath
        if (label != "") {
            ctx.font = "12px Arial"
            const textPos = new Point(this.x, this.y)
            ctx.fillText(`${label} (${this.x.toFixed(0)}/${this.y.toFixed(0)})`, m2c(textPos).x, m2c(textPos).y + cTextOffset)
        }
    }
    public override toString(): string {
        return `Point ${this.id}: (${this.x.toFixed(2)}, ${this.y.toFixed(2)})`
    }
}

// --------------------------------------------------------------------------------------
//     BOX  
// --------------------------------------------------------------------------------------
export class Box implements CanvasObjectBasic, Boxable {
    static fromCanvas(ctx: CanvasRenderingContext2D): Box {
        return new Box("canvas", new Point(0, 0), new Point(ctx.canvas.width, ctx.canvas.height), cDefaultColor)
    }

    constructor(public id: string, public lowerLeft: Point, public upperRight: Point, public color: RgbColor = new RgbColor(0, 0, 0)) { }

    public get width(): number {
        return this.upperRight.x - this.lowerLeft.x
    }
    public get height(): number {
        return this.upperRight.y - this.lowerLeft.y
    }
    public boxAround(): Box {
        return this
    }
    public overlaps(b: Box): boolean {
        const bUpperLeft  = new Point(b.lowerLeft.x, b.upperRight.y)
        const bLowerRight = new Point(b.upperRight.x, b.lowerLeft.y)
        return b.lowerLeft.isIn(b) || b.upperRight.isIn(b) || bUpperLeft.isIn(b) || bLowerRight.isIn(b)
    }
    public center(): Point {
        return new Point(this.lowerLeft.x + (this.width / 2), this.upperRight.y - (this.height / 2) )
    }
    public scaleToFitInto(b: Box): number { // scaling factor to be applied to this box in order to fit into b
        const xScaling = b.width  / this.width
        const yScaling = b.height / this.height
        return xScaling < yScaling ? xScaling : yScaling
    }
    public scaledBy(factor: number): Box {
        return new Box(this.id, this.lowerLeft.scaledBy(factor), this.upperRight.scaledBy(factor), this.color)
    }
    public visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas): void {
        const lowerLeft  = m2c(this.lowerLeft)
        const upperRight = m2c(this.upperRight)
        ctx.beginPath()
        ctx.moveTo(lowerLeft.x,  lowerLeft.y)
        ctx.lineTo(lowerLeft.x,  upperRight.y)
        ctx.lineTo(upperRight.x, upperRight.y)
        ctx.lineTo(upperRight.x, lowerLeft.y)
        ctx.lineTo(lowerLeft.x,  lowerLeft.y)
        ctx.strokeStyle = this.color.rgbString
        ctx.stroke();
        ctx.closePath()
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
    static newVectorfrom2Points(from: Point, to: Point): Vector {
        return new Vector(to.x - from.x, to.y - from.y)
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
        return `Vector (${this.dx.toFixed(2)}, ${this.dy.toFixed(2)}), length= ${this.length.toFixed(2)}}`
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
        return 1
    }

    override get inverted(): UnitVector {
        return UnitVector.newFromVector(super.inverted)
    }
    private deflectedAtVerticalBarrier(): UnitVector {
        return new UnitVector(-this.dx, this.dy)
    }
    private deflectedAtHorizontalBarrier(): UnitVector {
        return new UnitVector(this.dx, -this.dy)
    }
    public deflectedAtHorizOrVertiBarrier(ls: LineSegment): UnitVector | undefined {
        if (ls.isVertical)   return this.deflectedAtVerticalBarrier()
        if (ls.isHorizontal) return this.deflectedAtHorizontalBarrier()
        console.log(`ERROR: geometry.deflectedAtHorizOrVertiBarrier(ls: lineSegment): neither horizontal nor vertical!`)
        return undefined    
    }
    override get perpendicular(): UnitVector {
        return UnitVector.newFromVector(new Vector(this.dx, this.dy).perpendicular)
    }
    public isEqual(uv: UnitVector, tolerance: number): boolean {
        return Math.abs(uv.dx - this.dx) < tolerance && Math.abs(uv.dy - this.dy) < tolerance 
    }
    public isEqualInOneOfBothDirection(uv: UnitVector, tolerance: number): boolean {
        return uv.isEqual(this, tolerance) || uv.inverted.isEqual(this, tolerance) 
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

export class Line implements CanvasObjectBasic {
    static fromPointAndVector(p: Point, v: Vector, id: string = "", debugTrail: DebugTrail): Line {
        return new Line(p, p.addFree(v, debugTrail), id)
    }
    public uv: UnitVector

    constructor(public base: Point, p2: Point, public id: string = "") {
        this.uv = UnitVector.newFromVector(new Vector(p2.x - base.x, p2.y - base.y))
    }
    get perpendicular(): UnitVector {
        return this.uv.perpendicular
    }
    public parallel(p: Point, id: string = "", debugTrail: DebugTrail): Line {
        return Line.fromPointAndVector(p, this.uv, id, debugTrail)
    }
    public isParallel(l: Line): boolean {
        return this.uv.isEqualInOneOfBothDirection(l.uv, 0)
    }
    public touches(p: Point, tolerance: number): boolean {
        const aux = UnitVector.newFromVector(p.vectorTo(this.base)).isEqualInOneOfBothDirection(this.uv, tolerance)
        return aux 
    }
    get isVertical(): boolean {
        return Math.abs(this.uv.dx) < cTolerance
    }
    get isHorizontal(): boolean {
        return Math.abs(this.uv.dy) < cTolerance
    }
    public intersects(l: Line, debugTrail: DebugTrail): Intersection  {
        if (l.uv.isEqualInOneOfBothDirection(this.uv, 0))  // is a parallel line 
            if (this.touches(l.base, 0)) // one on the other
                return { type: "cover" }
            else
                return { type: "none"}
        if (this.isVertical)
            return { type: "point", p: l.base.addFree(l.uv.scale((this.base.x - l.base.x) / l.uv.dx), debugTrail) }
        if (this.isHorizontal)
            return { type: "point", p: l.base.addFree(l.uv.scale((this.base.y - l.base.y) / l.uv.dy), debugTrail) }
        // from here on we know that this this line is neither vertical nor horizontal and l is not parallel 
        const kx = (l.base.x - this.base.x) / this.uv.dx
        const ky = (l.base.y - this.base.y) / this.uv.dy
        const qx = l.uv.dx / this.uv.dx
        const qy = l.uv.dy / this.uv.dy
        return { type: "point", p: l.base.addFree(l.uv.scale((ky - kx) / (qx - qy)), debugTrail) }
    }
    public visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, color: RgbColor, debugTrail: DebugTrail): void {
        const cbase = m2c(this.base)
        ctx.beginPath()
        if (this.isVertical) {
            ctx.moveTo(cbase.x, 0)
            ctx.lineTo(cbase.x, ctx.canvas.height)
        } else
        if (this.isHorizontal) {
            ctx.moveTo(0, cbase.y)
            ctx.lineTo(ctx.canvas.width, cbase.y)
        }
        else {
            const lowerLine = new Line(new Point(0, 0), new Point(ctx.canvas.width, 0), "lower")
            const upperLine = new Line(new Point(0, ctx.canvas.height), new Point(ctx.canvas.width, ctx.canvas.height), "upper")
            const boundaryIntersectionLower  = Line.fromPointAndVector(m2c(this.base), this.uv, undefined, debugTrail).intersects(lowerLine, debugTrail)                
            const boundaryIntersectionUpper  = Line.fromPointAndVector(m2c(this.base), this.uv, undefined, debugTrail).intersects(upperLine, debugTrail) 
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

// --------------------------------------------------------------------------------------
//     LINE SEGMENT  
// --------------------------------------------------------------------------------------
export class LineSegment extends Line implements Boxable {
    constructor(base: Point, public p2: Point, id: string = "") {
        super(base, p2, id)
    }
    get length(): number {
        return this.base.vectorTo(this.p2).length
    }
    get middle(): Point {
        return new Point((this.base.x + this.p2.x) / 2, (this.base.y + this.p2.y) / 2)
    }
    private stretchToInteger(from: Point, to: Point): FromToPoints {
    return {
        from: new Point(from.x < to.x ? Math.floor(from.x) : Math.ceil(from.x),
                        from.y < to.y ? Math.floor(from.y) : Math.ceil(from.y)),
        to:   new Point(from.x < to.x ? Math.ceil(from.x)  : Math.floor(from.x),
                        from.y < to.y ? Math.ceil(from.y)  : Math.floor(from.y))
    }
}
    public boxAround(): Box {
        const xMin = Math.min(this.base.x, this.p2.x)
        const xMax = Math.max(this.base.x, this.p2.x)
        const yMin = Math.min(this.base.y, this.p2.y)
        const yMax = Math.max(this.base.y, this.p2.y)
        const lowerLeft  = new Point(xMin, yMin)
        const upperRight = new Point(xMax, yMax)
        return new Box(`${this.id}`, lowerLeft, upperRight)
    }
    
    public override touches(p: Point): boolean {
        return (UnitVector.newFromVector(p.vectorTo(this.base).inverted).isEqual(
                UnitVector.newFromVector(p.vectorTo(this.p2)), cTolerance))
    }
    
    public override intersects(l: Line, debugTrail: DebugTrail): Intersection {
        const lineIntersection = super.intersects(l, debugTrail)
        if (lineIntersection.type == "none") {
            return  { type: "none" }
        }
        if (lineIntersection.type == "point") {
            if (this.touches(lineIntersection.p!)) {
                return lineIntersection // the line cuts within the boundaries of this line segment 
            }
            else {
                return { type: "none" } // the line misses the line segment
            }
        }
        return { type: "cover", p: this.base, p2: this.p2} // the line segment resides on the line 
    }

    public intersectsLineSegment(ls: LineSegment, debugTrail: DebugTrail): Intersection {
        const lineIntersection = this.intersects(ls, debugTrail) // see if the line on which ls resides cuts this line segment 
//      debugTrail.push(`__Geometry.LineSegment ${this} .intersectsLineSegment(ls= ${ls}): lineIntersection.type= ${lineIntersection.type}`)
        if (lineIntersection.type == "none") 
            return  { type: "none" }
        if (lineIntersection.type == "point")
            if (ls.touches(lineIntersection.p!))
                return lineIntersection // the line ls cuts within the boundaries of this line segment 
            else
                return { type: "none" } // the line misses this line segment
        // intersection covers: ignore this super rare case     
        return { type: "none" }
    }
    
    equilateralVertices(debugTrail: DebugTrail): [Point, Point] {
        const altitude = Math.sqrt(3)/2 * this.length
        if (this.isVertical) 
            return [this.middle.addFree(new Vector(altitude, 0), debugTrail), this.middle.addFree(new Vector(-altitude, 0), debugTrail)]  
        if (this.isHorizontal)
            return [this.middle.addFree(new Vector(0, altitude), debugTrail), this.middle.addFree(new Vector(0, -altitude), debugTrail)]  
        const v0: Point = this.middle.addFree(this.perpendicular.scale( Math.max(altitude, cMinTriangleAltitude)), debugTrail)
        const v1: Point = this.middle.addFree(this.perpendicular.scale(-Math.max(altitude, cMinTriangleAltitude)), debugTrail)
        return [v0, v1]
    }

    public override visualize(ctx: CanvasRenderingContext2D, m2c: MapperRealToCanvas, color: RgbColor): void {
        const cbase = m2c(this.base)
        const cp2   = m2c(this.p2)
        ctx.beginPath()
        ctx.moveTo(cbase.x, cbase.y)
        ctx.lineTo(cp2.x,   cp2.y)
        ctx.strokeStyle = color.rgbString
        ctx.stroke();
        ctx.closePath()
    }
    public override toString(): string {
        return `Line segment ${this.id}: from ${this.base} to ${this.p2}, length= ${this.length.toFixed(1)}`
    }
}

