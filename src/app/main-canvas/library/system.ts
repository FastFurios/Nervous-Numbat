// ****************************************************************************************
//      SYSTEM 
// ****************************************************************************************

import { Point } from "./geometry"
import { ColorSchemes } from "./color"
import { Actor } from "./actor"
import { ActorGroup } from "./actorGroup"
import { cMaxIterations, cActorPickMargin, cLeftMargin, cRightMargin, cUpperMargin, cLowerMargin } from "./parameters"


enum IterationMode {
    iterating = "iterating",
    paused    = "paused",
    dead      = "dead"
}

export class NervousNumbatSystem {
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

