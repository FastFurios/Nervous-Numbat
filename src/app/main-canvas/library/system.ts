// ****************************************************************************************
//      SYSTEM 
// ****************************************************************************************

import { Point, Box } from "./geometry"
import { ColorSchemes, RgbColor } from "./color"
import { SystemExecParms } from "../main-canvas"
import { Actor } from "./actor"
import { ActorGroup, ActorGroupStaticBox } from "./actorGroup"
import { cActorPickMargin, cLeftMargin, cRightMargin, cUpperMargin, cLowerMargin, cShowActorJourney } from "./parameters"


enum IterationMode {
    iterating = "iterating",
    paused    = "paused",
    dead      = "dead"
}

export class NervousNumbatSystem {
    static  newWithActGrps(canvas: HTMLCanvasElement, actGrps: ActorGroup[], sysExecParms: SystemExecParms): NervousNumbatSystem {
        const sys = new NervousNumbatSystem(canvas, sysExecParms)
        sys.colorSchemes = new ColorSchemes(actGrps.length)
        actGrps.forEach(ag => sys.addActGrps([ag]))
        return sys
    }

    public  ctx: CanvasRenderingContext2D
    public  actGrps: ActorGroup[] = []
    public  colorSchemes = new ColorSchemes(1)  // 1 as default
    public  maxIterations!: number
    public  intervalMillisecs!: number
    private showActorJourney!: boolean
    public  doneIterations = 0
    private iterationMode  = IterationMode.iterating
    public  pickedActor: Actor | null | undefined = undefined
//    private htmlElementNumIterations: HTMLParagraphElement

    constructor(private canvas:  HTMLCanvasElement,
                        sysExecParms: SystemExecParms) {

        this.ctx = canvas.getContext('2d')!
        this.canvas.onmousedown = this.handleMouseDown.bind(this)
        //document.addEventListener("keydown", (event: KeyboardEvent): void => this.handleKeyDown(event))
        window.addEventListener("resize", this.resizeCanvas.bind(this))
        this.resizeCanvas()
        this.showActorJourney = sysExecParms.display.showActorJourney
        this.updateParameters(sysExecParms)
    }
    public addActGrps(actGrps: ActorGroup[]): NervousNumbatSystem {
        actGrps.forEach(ag => this.actGrps.push(ag))
        this.colorSchemes = new ColorSchemes(this.actGrps.length)
        actGrps.forEach(ag => ag.applyColorScheme(this.colorSchemes.nextColorScheme()))
        return this
    }
    public updateParameters(sep: SystemExecParms): void {
        console.log(`system.updateParameter(): propagating update...`)
        this.maxIterations = sep.run.maxIterations
        this.intervalMillisecs = sep.run.intervalMillisecs
        this.showActorJourney = sep.display.showActorJourney
        this.actGrps.forEach(ag => ag.updateParameters(sep))
    }
    public visualize(): void {
        if (!this.showActorJourney) this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
        console.log(`system.visualize(): this.showActorJourney= ${this.showActorJourney}`)
        this.actGrps.forEach(ag => ag.visualize())
    }
    public iterateOn(): void {
        if (this.doneIterations > this.maxIterations) throw("Iterations limit reached: stopped it!")
/*?*/   if (this.actGrps[0].isFrozen())           throw(`${this.actGrps[0].id} is frozen.`)
//      this.htmlElementNumIterations.textContent = `${this.doneIterations}`    
        this.actGrps.forEach(ag => ag.calculateNewActorPositions(this.actGrps.filter(ag2 => ag2 != ag), this.doneIterations))
        this.actGrps.forEach(ag => ag.moveActors())
        this.visualize()
        this.doneIterations++
        if (this.iterationMode == IterationMode.iterating)
            setTimeout(() => this.iterateOn(), this.intervalMillisecs)
    }
/*
    public toggleIterationsMode(): void {
        if (this.iterationMode == IterationMode.dead) return
        if (this.iterationMode == IterationMode.iterating)
            this.iterationMode = IterationMode.paused
        else {
            this.iterationMode = IterationMode.iterating
            setTimeout(() => this.iterateOn(), this.interval)
        }
    }
 */
    public stopIterating(): void {
        this.iterationMode = IterationMode.paused
    }
    public runResumeIterating(): void {
        if (this.iterationMode == IterationMode.iterating) return
        this.iterationMode = IterationMode.iterating
        this.iterateOn()
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
/*
    public handleKeyDown(event: KeyboardEvent): void {
        event.preventDefault()
        switch (event.code) {
            case "Space": { this.toggleIterationsMode(); break }
            default:      { }
        }
    }
*/
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

