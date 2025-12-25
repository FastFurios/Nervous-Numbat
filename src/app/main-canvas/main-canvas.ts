import { Component } from '@angular/core';

@Component({
  selector: 'main-canvas',
  imports: [],
  templateUrl: './main-canvas.html',
  styleUrl: './main-canvas.css',
})
export class MainCanvas {
  public system: NervousNumbatSystem | undefined = undefined
/*
  private numActGrpsInput: HTMLInputElement
  private numActorsInput:  HTMLInputElement
*/
  constructor() {
    console.log("Welcome from the MainCanvas component.")
/*    
    this.numActGrpsInput = document.getElementById("numActGrps") as HTMLInputElement
    this.numActorsInput  = document.getElementById("numActors")  as HTMLInputElement
    console.log(`#numActorsInput= ${this.numActorsInput.valueAsNumber}`)
    const setupButton = document.getElementById("buildAndStartSystem") as HTMLButtonElement
//  setupButton.addEventListener('click', () => this.systemSetupHandler())
    this.systemSetupHandler()
*/

  }
 
  public systemSetupHandler(): void {
    console.log(`systemSetupHandler()`)
/*
    let numActGrps: number = this.numActGrpsInput.value == "" ? 1 : Math.min(this.numActGrpsInput.valueAsNumber, 8)  
//  let numActors:  number = !numActorsInput.value || numActGrpsInput.value == "" ? cNumberActorsInActGrp : Math.min(parseInt(numActGrpsInput.value), 8)  
    let numActors:  number = Math.min(this.numActorsInput.valueAsNumber, 500)  

    console.log(`#numActors= ${numActors}`)
*/
    const numActGrps = 1
    const numActors = 60

    this.system?.stopIterating()
    this.system = new NervousNumbatSystem(cIntervalMillisecs)

    const actGrps: ActorGroup[] = []

    for (let i = 0; i < numActGrps; i++) {
        actGrps.push(ActorGroupDynamic.newRandomizedActGrp(
                        this.system.ctx, 
                        `Explorers-${i}`, 
                        numActors, 
                        new Box(this.system.ctx, "startBox", 
                                new Point(this.system.ctx,  (i + 1) * 300,  (i + 1) * 100), 
                                new Point(this.system.ctx,  (i + 2) * 300,  (i + 2) * 100), 
                                new RgbColor(0, 0, 0)),
                        i % 2 == 0 ? cPowerCurveFactor : 0)  // apply the cPowerCurveFactor to every actor group with even id
                    )
    }            
    this.system.addActGrps(actGrps).iterate()
  }
}


// #########################################################################################
// Project: NERVOUS NUMBAT
// G.Lindorfer, from 2025-10 to ...
// #########################################################################################

// Exakte Flächenberechnung der Dreiecksgruppe: 
// $ npm install martinez-polygon-clipping (siehe ChatGPT für "Polygon Union")

// ****************************************************************************************
//      Geometry
// ****************************************************************************************

type  Infinite           = undefined
const infinite: Infinite = undefined
interface CanvasObject {
    ctx: CanvasRenderingContext2D
    visualize(ctx: CanvasRenderingContext2D, color: RgbColor): void
    toString(): string
}

class Point implements CanvasObject {
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

class Box implements CanvasObject {
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

class Vector { 
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

class UnitVector extends Vector {
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

type IntersectionType = "none" | "point" | "cover"
type Intersection     = { type:   IntersectionType,
                          p?:     Point,
                          p2?:    Point }

class Line implements CanvasObject {
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

class LineSegment extends Line {
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

// ****************************************************************************************
//      COLOR
// ****************************************************************************************
const cOpacity = 0.1
const cActorDotRadius = 3
const cTextOffset = 10
const cContextMargin = 0.4

type NumberRange      = [number, number]
type OneRgbColorRange = NumberRange
type ColorScheme      = [OneRgbColorRange, OneRgbColorRange, OneRgbColorRange]    

class RgbColor {
    static newRandomColor(colorScheme: ColorScheme = [[0, 255], [0, 255], [0, 250]]): RgbColor {
        return new RgbColor(randomInRange(...colorScheme[0]), randomInRange(...colorScheme[1]), randomInRange(...colorScheme[2]))
    }

    constructor(public red: number, public green: number, public blue: number) {}

    private get rgbInnerString(): string {
        return `${this.red}, ${this.green}, ${this.blue}`
    }
    get rgbString(): string {
        return `rgb(${this.rgbInnerString})`
    }
    get rgbWithOpacityString(): string {
        return `rgba(${this.rgbInnerString}, ${cOpacity})`
    }
}

class ColorSchemes {
    private colorSchemes:           ColorScheme[] = []
    private nextColorSchemeIndex:   number

    constructor(numSchemes: number) {
        this.segmentColorSchemes(numSchemes)
        this.nextColorSchemeIndex = 0
    }
    private segmentColorSchemes(numSchemes: number): void {
//      console.log(`ColorSCheme.segmentColorSchemes(${numSchemes})`)
        this.colorSchemes = []
        if (numSchemes <= 1) {
            this.colorSchemes.push(
               [[0, 255], [0, 255], [0, 255]])
            return
        }
        if (numSchemes == 2) {
            this.colorSchemes.push(
               [[0,   127], [0, 255], [0, 255]],  
               [[128, 255], [0, 255], [0, 255]])
            return
        }
        // provide 8 schemes for more than 4 ActorGroups
        this.colorSchemes.push(
            [[0,   127], [0,   127], [0,   127]],  
            [[0,   127], [0,   127], [128, 255]],  
            [[0,   127], [128, 255], [0,   255]],  
            [[0,   127], [128, 255], [128, 255]],  
            [[128, 255], [0,   127], [0,   127]],  
            [[128, 255], [0,   127], [128, 255]],  
            [[128, 255], [128, 255], [0,   255]],  
            [[128, 255], [128, 255], [128, 255]], 
        )
        this.colorSchemes = reshuffle<ColorScheme>(this.colorSchemes)
    }
    public nextColorScheme(): ColorScheme {
        const colScheme =  this.colorSchemes[this.nextColorSchemeIndex]
        this.nextColorSchemeIndex = (this.nextColorSchemeIndex + 1) % this.colorSchemes.length
        return colScheme
    }
    public toString(): string {
        return `ColorScheme: ${this.colorSchemes.map(cs => `[${cs}]`)}`
    }
}

// ****************************************************************************************
//      LOG
// ****************************************************************************************

class Log {
    public  log: number[] = []
    private pos: number   = -1 // no element

    constructor(private maxLen: number = cLogLengthDefault) {} 

    public push(quality: number): void {
        if (this.log.length < this.maxLen) {
            this.log.push(quality)
            this.pos = this.log.length - 1    
        } else {
            this.pos = (this.pos + 1) % this.log.length
            this.log[this.pos] = quality 
        }
    }
    public get lastLoggedQuality(): number | undefined {
        return this.pos >= 0 ? this.log[this.pos] : undefined
    }
    public areTooManyLoggedQualitiesBelow(threshold: number): boolean {
        if (this.log.length < this.maxLen) return false
        return this.log.map(le => le < threshold).reduce((b1, b2) => b1 && b2, true)
    }
    public get avgStandardDeviation(): number {
        if (this.log.length < cLogLengthDefault) return 1
        const mean     = this.log.reduce((v1, v2) => v1 + v2, 0) / this.log.length
        const variance = this.log.map(v => Math.pow(v - mean, 2)).reduce((v1, v2) => v1 + v2, 0)
        return Math.sqrt(variance / this.log.length)
    }
    public toString(): string {
        return `log = ${this.log.map(le => le.toFixed(2))}`
    }
}

// ****************************************************************************************
//      ACTOR
// ****************************************************************************************

enum Halo {
    on  = "on",
    off = "off"
}

enum Mode {
    stickToCloserVertex = "stick to closer vertex",
    aimForFartherVertex = "aim for farther vertex"
}

class Actor implements CanvasObject {
    public  p:                  Point 
    public  observee1:          Actor | undefined
    public  observee2:          Actor | undefined

    private triangleQualityLog: Log = new Log()
    private halo                    = Halo.off
    private mode                    = Mode.stickToCloserVertex

    static newRandomizedActor(ctx: CanvasRenderingContext2D, id: string, startBox: Box, color: RgbColor = cDefaultColor): Actor {
        const x = randomInRange(startBox.lowerLeft.x, startBox.upperRight.x) 
        const y = randomInRange(startBox.lowerLeft.y, startBox.upperRight.y) 
        return new Actor(ctx, id, x, y, color)
    }

    constructor(public ctx: CanvasRenderingContext2D, public id: string, x: number,y: number, public color: RgbColor = cDefaultColor) {
        this.p = new Point(ctx, x, y) 
    }
    private get twoDefinedObservees(): boolean {
        return this.observee1 != undefined && this.observee2 != undefined
    }
    private get observeesEdge(): LineSegment {
        if (!this.twoDefinedObservees) throw(`## Actor ${this.id} is missing defined obervees`)
        return new LineSegment(this.ctx, this.observee1!.p, this.observee2!.p)
    }
    private newPositionTowardsVertex(otherActGrps: ActorGroup[]): Point {
        let targetVertex: Point
        if (this.observee1!.p.equalsTo(this.observee2!.p))
            targetVertex = this.observee1!.p
        else {
            const twoVertices   = this.observeesEdge.equilateralVertices
            const closestVertex = this.p.closerTo(twoVertices)
            const fartherVertex = closestVertex == twoVertices[0] ? twoVertices[1] : twoVertices[0]
            targetVertex = this.mode == Mode.aimForFartherVertex
                        || otherActGrps.map(ag => ag.covers(this.p)).reduce((d, e) => d || e, false) // detection of collision with other actor group
                                ? fartherVertex 
                                : closestVertex  
        }
        const vectorToVertex   = new Vector(targetVertex.x - this.p.x, targetVertex.y - this.p.y)
        const scaleFactor      = vectorToVertex.length <= cMaxMoveDistance ? 1 : cMaxMoveDistance / vectorToVertex.length  
        const targetP          = this.p.add(vectorToVertex.scale(scaleFactor))
        const wayToTargetP     = new LineSegment(this.ctx, this.p, targetP)
        const wayIntersectsObserveesEdge = wayToTargetP.intersects(this.observeesEdge)
        if (wayIntersectsObserveesEdge.type != "none") { // my move crosses the observees line
//          if (this == firstPoorQualityTriangle) console.log(`Actor ${this.id}: observees= ${this.observee1?.p} and ${this.observee2?.p}: Going from ${this.p} to ${targetP}: Way to target point crosses observees edge at ${wayIntersectsObserveesEdge.p}, switching mode from "${this.mode}" to ...`)
            this.mode = Mode.stickToCloserVertex
//          if (this == firstPoorQualityTriangle)  console.log(`...to "${this.mode}`)
        }
        return targetP
    }
    public newPosition(otherActGrps: ActorGroup[]): Point {
        if (cAimAtFartherVertexOnEnduredPoorQuality && this.triangleQualityLog.areTooManyLoggedQualitiesBelow(cPoorTriangleQualityThreshold)) {
//          if(!firstPoorQualityTriangle) firstPoorQualityTriangle = this
            this.mode = Mode.aimForFartherVertex 
//           console.log(`${this.id} enduring low quality with max= ${Math.max(...this.triangleQualityLog.log)}, switching to mode= ${this.mode}`)
            this.triangleQualityLog = new Log()
         } 
        return this.newPositionTowardsVertex(otherActGrps)
    }
    public setPosition(p: Point): void {
        this.triangleQualityLog.push(this.triangleQuality)
        this.p = p 
    }  
    public assign2SpecificObservees(a1: Actor, a2: Actor): void {
        this.observee1      = a1
        this.observee2      = a2
    }
    public assign2RandomObservees(actors: Actor[]): void {
        const restOfActors1 = actors.filter(a => a !== this)
        this.observee1      = restOfActors1[randomInRange(0, restOfActors1.length)]
        const restOfActors2 = restOfActors1.filter(a => a !== this.observee1)
        this.observee2      = restOfActors2[randomInRange(0, restOfActors2.length)]
        console.log(`${this.id}: just assigned observees ${this.observee1.id} and ${this.observee2.id}}`)
    }
    public isFrozen(): boolean {
//      return this.triangleQualityLog.avgStandardDeviation < 0.01 // cStandardDeviationThreshold
        return this.triangleQualityLog.lastLoggedQuality ? this.triangleQualityLog.lastLoggedQuality > 0.98 : false
    }
    public turnHaloOn(): void {
        this.halo = Halo.on
    }
    public turnHaloOff(): void {
        this.halo = Halo.off
    }
    public haloStatus(): Halo {
        return this.halo
    }
    private visualizeEdgesAndFillTriangle(ctx: CanvasRenderingContext2D): void {
        if (!this.observee1 || !this.observee2) return
//      if (this != firstPoorQualityTriangle) return
/*?*/   if (true || this.mode == Mode.aimForFartherVertex) { 
            ctx.beginPath()
            ctx.moveTo(this.observee1.p.x, this.observee1.p.y)
            ctx.lineTo(this.p.x, this.p.y)
             ctx.lineTo(this.observee2.p.x, this.observee2.p.y)

            if (this.mode == Mode.aimForFartherVertex) ctx.setLineDash([10, 5]) // [line length, space length]
//          ctx.lineDashOffset = 0

            ctx.strokeStyle = this.color.rgbString
            ctx.stroke();
            ctx.setLineDash([])
            ctx.closePath()
            ctx.font = "12px Arial"
//          ctx.fillText(`${this.id}`, this.p.x + cTextOffset, this.p.y)
    /**/
            if (cShowActorId) {
                ctx.font = "12px Arial"
                ctx.fillText(`${this.id}: ${cShowActorTriangleQuality ? (this.triangleQuality *100).toFixed(0) : ""}%, ${cShowActorMode ? this.mode : ""}`, this.p.x + cTextOffset, this.p.y)
            }
            if (cShowActorObservees) {
                ctx.font = "8px Arial"
                ctx.fillText(`=> ${this.observee1.id} and ${this.observee2.id}`, this.p.x, this.p.y + cTextOffset)
            }
    /**/
            ctx.fillStyle = this.color.rgbWithOpacityString
            ctx.fill();
        }
    }
    get triangleEdges(): [LineSegment, LineSegment, LineSegment]{
        if (!this.twoDefinedObservees) throw(`## Actor ${this.id} is missing defined obervees`)
        return [new LineSegment(this.ctx, this.p,            this.observee1!.p),
                new LineSegment(this.ctx, this.observee1!.p, this.observee2!.p),
                new LineSegment(this.ctx, this.observee2!.p, this.p)]
    }
    public covers(p: Point): boolean {
        if (!this.observee1 || !this.observee2) return false
        const verticalThruP = Line.newLineFromPointAndVector(this.ctx, new Point(this.ctx, p.x, 0), new Vector(0, 1))
        const edgeIntersecs: Intersection[] = []
        for (let e of this.triangleEdges) {
            const is: Intersection = e.intersects(verticalThruP)
            if (is.type == "point") edgeIntersecs.push(is)  // && is.p?.isInBox(e.base, e.p2) 
        }
        if (edgeIntersecs.length != 2) return false
        const isYmin = Math.min(...edgeIntersecs.map(is => is.p!.y))  
        const isYmax = Math.max(...edgeIntersecs.map(is => is.p!.y))  
        return  isYmin < p.y && p.y < isYmax
    }
    get triangleQuality(): number {
        if (!this.observee1 || !this.observee2) return 0
        const lenAtoB = new LineSegment(this.ctx, this.p,           this.observee1.p).length
        const lenBtoC = new LineSegment(this.ctx, this.observee1.p, this.observee2.p).length
        const lenCtoA = new LineSegment(this.ctx, this.observee2.p, this.p).length
        const sumLen = lenAtoB + lenBtoC + lenCtoA
        if (sumLen == 0) return 0 // no real triangle any longer as it is a point; we deem this bad, s it gets a 0
        const avgEdgeLen = sumLen / 3
        const deltaAtoB = Math.abs(lenAtoB - avgEdgeLen)
        const deltaBtoC = Math.abs(lenBtoC - avgEdgeLen)
        const deltaCtoA = Math.abs(lenCtoA - avgEdgeLen)
        const sumDelta = deltaAtoB + deltaBtoC + deltaCtoA
        return ((sumLen - sumDelta) / sumLen)**4
    }
    public visualize(ctx: CanvasRenderingContext2D): void {
//      if (this != firstPoorQualityTriangle) return
        this.p.visualize(ctx, this.color, this.halo)
        if (cShowTriangle) this.visualizeEdgesAndFillTriangle(ctx)
    }
    public toString(): string {
        return `${this.id}: ${this.p}; observees= ${this.observee1?.id}(${this.observee1?.p.x.toFixed(0)}, ${this.observee1?.p.y.toFixed(0)}) and ${this.observee2?.id}(${this.observee2?.p.x}, ${this.observee2?.p.y})` 
//      return `${this.id}: ${this.p}; observees= ${this.observee1?.id}(${this.observee1?.p.x}, ${this.observee1?.p.y}) and ${this.observee2?.id}(${this.observee2?.p.x}, ${this.observee2?.p.y})` 
    }
}

// ****************************************************************************************
//      ACTOR GROUP
// ****************************************************************************************

abstract class ActorGroup implements CanvasObject {
    constructor(public ctx: CanvasRenderingContext2D, 
                public id: string, 
                public actors: Actor[] = [], 
                public colorScheme?: ColorScheme) { 
    }
    public covers(p: Point): boolean {
        return this.actors.map(a => a.covers(p)).reduce((d, e) => d || e, false)
    }
    public applyColorScheme(colorScheme: ColorScheme): void {
        this.colorScheme = colorScheme
        this.actors.forEach(a => a.color = RgbColor.newRandomColor(colorScheme))
    } 
    public visualize() {
        this.actors.forEach(a => a.visualize(this.ctx))
        if (!cShowActorGroupIdAndQuality) return 
        this.visualizeIdAndQuality()
    }
    private visualizeIdAndQuality(remark: string = ""): void {
        const ctr = this.centerPoint()
        this.ctx.beginPath()
        this.ctx.moveTo(ctr.x, ctr.y)
        this.ctx.closePath() 
        this.ctx.fillStyle = new RgbColor(100, 100, 100).rgbString
        this.ctx.textAlign = "center"
        this.ctx.font = "12px Arial"
        this.ctx.fillText(`${this.id} ${(this.avgTriangleQuality * 100).toFixed(0)}% ${remark}`, ctr.x, ctr.y)
    } 
    public nearbyActors(p: Point, margin: number): Actor[] {
        return this.actors.filter(a => p.nearby(a.p, margin))
    }
    public centerPoint(): Point {
        return new Point(this.ctx, 
                         this.actors.map(a => a.p.x).reduce((acc, curr) => acc + curr, 0) / this.actors.length,
                         this.actors.map(a => a.p.y).reduce((acc, curr) => acc + curr, 0) / this.actors.length)
    }
    public get avgTriangleQuality(): number {
        return this.actors.map(a => a.triangleQuality).reduce((q1, q2) => q1 + q2) / this.actors.length
    }
    public isFrozen(): boolean {
//      console.log(`${this.id} is frozen? ${this.actors.map(a => a.isFrozen()).reduce((a, b) => a && b, true)}`)
        return this.actors.map(a => a.isFrozen()).reduce((a, b) => a && b, true)
    }
    public toString(): string {
        return `Actor Group ${this.id}: #actors= ${this.actors.length}` 
    }
    abstract calculateNewActorPositions(otherActGrps: ActorGroup[], iteration: number): void
    abstract moveActors(): void
}

class ActorGroupDynamic extends ActorGroup {
    static newRandomizedActGrp(ctx: CanvasRenderingContext2D, id: string, numActors: number, startBox: Box, powerCurveFactor: number = 0) {
        const ag = new ActorGroupDynamic(ctx, id, [], powerCurveFactor)
        ag.randomizeActors(startBox, numActors)
//      console.log(`${ag.id}: bloated list: ${powerCurveBloatedListOf(ag.actors, powerFunctionFactory(cPowerCurveFactor, ag.actors.length)).map(a => a.id)}`)
        ag.assign2RandomObservees(powerCurveBloatedListOf(ag.actors, powerFunctionFactory(powerCurveFactor, ag.actors.length)))
//      console.log(powerCurveBloatedListOf(ag.actors, powerFunctionFactory(-cPowerCurveFactor, ag.actors.length)).map(e => e.id))
//      console.log(ag.actors.map(e => `${e.id}=>[${e.observee1?.id}, ${e.observee2?.id}]\n`))
        return ag
    }

    private log = new Log()
    private calculatedNewPositions: Point[] = []
    
    constructor(ctx: CanvasRenderingContext2D, id: string, actors: Actor[] = [], public powerCurveFactor: number = 0) { 
        super(ctx, id, actors)
    }
    public addActor(a: Actor): void {
        this.actors.push(a)
    }
    public randomizeActors(startBox: Box, numActors: number): void {
        for (let i = 0; i < numActors; i++)
            this.addActor(Actor.newRandomizedActor(this.ctx, `${this.id[0]}${i}`, startBox))
    }    
    public assign2RandomObservees(bloatedActorsList: Actor[]): void {
        console.log(bloatedActorsList.map(a => a.id))
        this.actors.forEach(a => a.assign2RandomObservees(bloatedActorsList))
        console.log(this.actors.map(e => `${e.id}=>[${e.observee1?.id}, ${e.observee2?.id}]\n`))
    }
    public calculateNewActorPositions(otherActGrps: ActorGroup[], iteration: number): void {
        const qlty = this.avgTriangleQuality  
        if (qlty > cMinTriangleQuality) {
            console.log(`iterations stopped at avg. triangle quality= ${qlty}`)
            return
        }    
        this.log.push(qlty)
/*
        if (iteration % 100 == 0) console.log(`iterating ${iteration}: avgQuality= ${(qlty * 100).toFixed(0)}%`)
        if (iteration % 1000 == 0) console.log(`${this.log}`)
*/
        this.calculatedNewPositions = [] 
        for (let a of this.actors)
            this.calculatedNewPositions.push(a.newPosition(otherActGrps))
    }
    public moveActors(): void {
        for (let i = 0; i < this.actors.length; i++) {
            this.actors[i].setPosition(this.calculatedNewPositions[i])
        }
        this.visualize()
    }
}

class ActorGroupStaticBox extends ActorGroup {
    constructor(ctx: CanvasRenderingContext2D, id: string, box: Box, colRgbRanges?: ColorScheme) { 
        const black = new RgbColor(0, 0, 0)
        const actors = [
            new Actor(ctx, "lowerLeft",  box.lowerLeft.x,  box.lowerLeft.y,  black),
            new Actor(ctx, "upperLeft",  box.lowerLeft.x,  box.upperRight.y, black),
            new Actor(ctx, "upperRight", box.upperRight.x, box.upperRight.y, black),
            new Actor(ctx, "lowerRight", box.upperRight.x, box.lowerLeft.y,  black)
        ]
        super(ctx, id, actors, colRgbRanges)
        actors[0].observee1 = actors[1]
        actors[0].observee2 = actors[3]
        actors[2].observee1 = actors[1]
        actors[2].observee2 = actors[3]
    }
    public calculateNewActorPositions(otherActGrps: ActorGroup[], iteration: number): void { 
        return 
    }    
    public moveActors(): void { 
        return 
    }
}

// ****************************************************************************************
//      SYSTEM 
// ****************************************************************************************

enum IterationMode {
    iterating = "iterating",
    paused    = "paused",
    dead      = "dead"
}

class NervousNumbatSystem {
    static  newWithActGrps(interval: number, actGrps: ActorGroup[]): NervousNumbatSystem {
        const sys = new NervousNumbatSystem(interval)
        sys.colorSchemes = new ColorSchemes(actGrps.length)
        actGrps.forEach(ag => sys.addActGrps([ag]))
        return sys
    }

    public  ctx: CanvasRenderingContext2D
    private canvas: HTMLCanvasElement
    private actGrps: ActorGroup[] = []
    public  colorSchemes = new ColorSchemes(1)  // 1 as default
    public  doneIterations = 0
    private iterationMode  = IterationMode.iterating
    public  pickedActor: Actor | null | undefined = undefined
    private htmlElementNumIterations: HTMLParagraphElement

    constructor(private interval: number) {
        this.canvas = document.getElementById("myCanvas") as HTMLCanvasElement;
        if (!this.canvas) throw new Error("Canvas element not found")
        const ctx = this.canvas.getContext("2d")
        if (!ctx) throw new Error("2D context not supported or canvas already initialized")
        this.ctx = ctx
        this.canvas.onmousedown = this.handleMouseDown.bind(this)
        document.addEventListener("keydown", (event: KeyboardEvent): void => this.handleKeyDown(event))
        window.addEventListener("resize", this.resizeCanvas.bind(this))
        this.resizeCanvas()
        this.htmlElementNumIterations = document.getElementById("numIterations") as HTMLParagraphElement
    }

    public addActGrps(actGrps: ActorGroup[]): NervousNumbatSystem {
        actGrps.forEach(ag => this.actGrps.push(ag))
        this.colorSchemes = new ColorSchemes(this.actGrps.length)
        actGrps.forEach(ag => ag.applyColorScheme(this.colorSchemes.nextColorScheme()))
        return this
    }
    public visualize(): void {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
        this.actGrps.forEach(ag => ag.visualize())
    }
    public iterate(): void {
        if (this.doneIterations > cMaxIterations) throw("Iterations limit reached: stopped it!")
        if (this.actGrps[0].isFrozen())           throw(`${this.actGrps[0].id} is frozen.`)
        this.htmlElementNumIterations.textContent = `${this.doneIterations}`    
        this.actGrps.forEach(ag => ag.calculateNewActorPositions(this.actGrps.filter(ag2 => ag2 != ag), this.doneIterations))
        this.actGrps.forEach(ag => ag.moveActors())
        this.visualize()
        this.doneIterations++
        if (this.iterationMode == IterationMode.iterating)
            setTimeout(() => this.iterate(), this.interval)
    }
    public toggleIterationsMode(): void {
        if (this.iterationMode == IterationMode.dead) return
        if (this.iterationMode == IterationMode.iterating)
            this.iterationMode = IterationMode.paused
        else {
            this.iterationMode = IterationMode.iterating
            setTimeout(() => this.iterate(), this.interval)
        }
    }
    public stopIterating(): void {
        this.iterationMode = IterationMode.dead
    }
    private nearbyActorsInRange(p: Point, margin: number): Actor[] {
        return this.actGrps.flatMap(ag => ag.nearbyActors(p, margin))
    }
    public closestActorInRange(p: Point, margin: number): Actor | null {
        const actorsInRange = this.nearbyActorsInRange(p, margin)
        if (actorsInRange.length  < 1) return null
        if (actorsInRange.length == 1) return actorsInRange[0]
        const minDistance = actorsInRange.map(a => p.distanceTo(a.p)).reduce((e, f) => e < f ? e : f)
        return actorsInRange.find(a => p.distanceTo(a.p) == minDistance) || actorsInRange[0]
    }
    public handleKeyDown(event: KeyboardEvent): void {
        event.preventDefault()
        switch (event.code) {
            case "Space": { this.toggleIterationsMode(); break }
            default:      { }
        }
    }
    public handleMouseDown(event: MouseEvent): void {
        event.preventDefault()
        this.pickedActor = this.closestActorInRange(new Point(this.ctx, event.offsetX, event.offsetY), cActorPickMargin)
        if (!this.pickedActor) return
        this.pickedActor.turnHaloOn()
        this.visualize()
        this.canvas.onmousemove = this.handleMouseMove.bind(this)
        this.canvas.onmouseup   = this.handleMouseUp.bind(this)
    }
    public handleMouseMove(event: MouseEvent): void {
        if (!this.pickedActor) return
        this.pickedActor.setPosition(new Point(this.ctx, event.offsetX, event.offsetY))
        this.visualize()
    }
    public handleMouseUp(event: MouseEvent): void {
        this.pickedActor?.turnHaloOff()
        this.pickedActor = undefined
        this.visualize()
        this.canvas.onmousemove = null
        this.canvas.onmouseup   = null
    }
    public resizeCanvas(): void {
        console.log(`Canvas resizing ...`)
        this.ctx.canvas.width  = window.innerWidth  - cLeftMargin - cRightMargin
        this.ctx.canvas.height = window.innerHeight - cUpperMargin - cLowerMargin
    }
}

// ****************************************************************************************
//      HELPER FUNCTIONS 
// ****************************************************************************************

function randomInRange(from: number, to: number): number {
    return from + Math.floor(Math.random() * (to - from))  
}

function isBetween(v: number, n1: number, n2: number): boolean {
    const min = Math.min(n1, n2)
    const max = Math.max(n1, n2)
    return v >= min && v <= max
}

function reshuffle<T>(arr: T[]): T[] {
    if (arr.length <= 1) return []
    const e: T = arr.splice(randomInRange(0, (arr.length - 1)), 1)[0]        
    return [e].concat(reshuffle<T>(arr))  
}

function powerOf(scale: number, power: number, x: number): number {
  return scale * (x + 1) ** power;
}

type PowerFunction = (x: number) => number
function powerFunctionFactory(power: number, maxX: number): PowerFunction {
  const lastValue = powerOf(1, power, maxX);
  return powerOf.bind(null, 1 / lastValue, power);
}

function powerCurveBloatedListOf<T>(list: T[], powFct: PowerFunction): T[] {
  let bloatedList: T[] = [];
  for (let i = 0; i < list.length; i++) {
    const numOfElements = Math.max(1, Math.round(powFct(i)))
    for (let j = 0; j < numOfElements; j++) bloatedList.push(list[i])
  }
  console.log(`powerCurveBloatedListOf(${(<Actor[]>list).map(a => a.id)}) => ${(<Actor[]>bloatedList).map(a => a.id)}`)
  return bloatedList
}

// ****************************************************************************************
//      MAIN
// ****************************************************************************************
const cTolerance = 0.001
const cMaxIterations = 1000000
const cMaxMoveDistance = 4
const cMinTriangleAltitude = 20
const cMinTriangleQuality = 1
const cPoorTriangleQualityThreshold = 0.5
const cStandardDeviationThreshold = 0.00001
const cLogLengthDefault = 100
const cActorPickMargin = 20
const cUpperMargin = 200
const cLowerMargin = 50
const cLeftMargin = 50
const cRightMargin = 200
const cIntervalMillisecs = 30
const cNumberActorsInActGrp = 20
const cDefaultColor = new RgbColor(0, 0, 0)
const cShowActorId = false
const cShowActorTriangleQuality = true
const cShowActorMode = false
const cShowActorObservees = false
const cShowTriangle = true
const cShowActorGroupIdAndQuality = true
const cAimAtFartherVertexOnEnduredPoorQuality = true
const cPowerCurveFactor = -0.8; if (cPowerCurveFactor > 0) throw Error("cPowerCurveFactor needs to be smaller than 0 !")

//let firstPoorQualityTriangle: Actor
