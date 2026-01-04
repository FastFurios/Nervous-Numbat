import { Component, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit  } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CommonModule } from '@angular/common'

import { Point, Box} from "./library/geometry"
import { RgbColor } from "./library/color"
import { NervousNumbatSystem } from "./library/system"
import { ActorGroup, ActorGroupDynamic, ActorGroupStaticBox } from "./library/actorGroup"
import { cIntervalMillisecs, cPowerCurveFactor } from "./library/parameters"

export type SystemExecParmsRun = {
  intervalMillisecs: number
  maxIterations: number
  maxMoveDistance: number
  minTriangleQuality: number
}
export type SystemExecParmsDisplay = {
  showActorId: boolean
  showTriangle: boolean
  showActorTriangleQuality: boolean
//showActorMode: boolean
  showActorObservees: boolean
  showActorGroupIdAndQuality: boolean
  showActorJourney: boolean
  showOneActorOnlyWithTheGivenAgIndex: number | undefined
}
export type SystemExecParmsStrategy = {
  poorTriangleQualityThreshold: number
  aimAtFartherVertexOnEnduredPoorQuality: boolean
}
export interface SystemExecParms {
  run:      SystemExecParmsRun 
  display:  SystemExecParmsDisplay
  strategy: SystemExecParmsStrategy
 }

type RunResumeButtonLabel = "Run" | "Resume"

@Component({
  selector: 'main-canvas',
  imports: [FormsModule, CommonModule],
  templateUrl: './main-canvas.html',
  styleUrl: './main-canvas.css',
})
export class MainCanvas implements AfterViewInit, OnChanges {
  sysExecParms!: SystemExecParms
  public system: NervousNumbatSystem | undefined = undefined
//  public pIntervalMillisecs: number 
  public runResumeButtonLabel: RunResumeButtonLabel = "Run"
  public highestActorIndexInActorGroup_0: number
  @ViewChild('myCanvas') canvasRef!: ElementRef<HTMLCanvasElement>
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D

  constructor() {
//  console.log("Welcome from the MainCanvas component.")

    this.sysExecParms = {
      run: {
        intervalMillisecs: cIntervalMillisecs,
        maxIterations: 1000000,
        maxMoveDistance: 4,
        minTriangleQuality: 1
      },
      display: {
        showActorId: false,
        showTriangle: true,
        showActorTriangleQuality: false,
//      showActorMode: false,
        showActorObservees: false,
        showActorGroupIdAndQuality: false,
        showActorJourney: false,
        showOneActorOnlyWithTheGivenAgIndex: undefined
      },
      strategy: {
        poorTriangleQualityThreshold: 0.5,
        aimAtFartherVertexOnEnduredPoorQuality: true
      }
    }
    //this.pIntervalMillisecs = 0.4
    this.highestActorIndexInActorGroup_0 = this.numActorsOfActGrp(0) || 0
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement
    const context = canvas.getContext('2d')

    if (context) {
      this.ctx = context;
    } else {
      throw Error('Could not get 2D context from canvas!');
    }

    this.setupSystem()

  }

  ngOnChanges(changes: SimpleChanges): void {
/*
      console.log(`main-vanvas.ngOnChanges(): updating system...`)
//    this.system?.updateParameters(changes["pShowTriangles"].currentValue)
      this.system?.updateParameters(this.sysExecParms)
*/
  }
  public onUpdatedParameters(value: unknown): void {
    console.log(`main-canvas.onUpdatedParameters(): ${this.sysExecParms.run.intervalMillisecs}`)
    console.log(this.sysExecParms)
    this.system?.updateParameters(this.sysExecParms)
    this.system?.visualize() 
  }
/*
  public onTest(value: unknown): void {
    console.log(`main-canvas.onTest()`)
  }

  @HostListener("document:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space') {
      event.preventDefault();
      console.log('main-canvas.onKeyDown(): Space pressed!');
    }
  }
*/
  // ---------------------------------------------------------------------------------------
  // <button> and other handlers
  // ---------------------------------------------------------------------------------------

  /** run&resume button clicked */
  public runResumeIterationsHandler() {
    this.system?.runResumeIterating()
  }
  
  /* stop button clicked */
  public stopIterationsHandler() {
    this.system?.stopIterating()
    this.runResumeButtonLabel = "Resume"
  }

  /** reset button clicked */
  public resetSystemHandler() {
    this.setupSystem()
    this.runResumeButtonLabel = "Run"
  }

  public numActorsOfActGrp(agIdx: number): number | undefined {
    return this.system?.actGrps[agIdx].actors.length
  }

  public setupSystem(): void {
    console.log(`main-canvas.systemSetupHandler()`)

/**/const numActGrps = 1
/**/const numActors = 25

    this.system?.stopIterating()
    this.system = new NervousNumbatSystem(this.canvasRef.nativeElement, this.sysExecParms)

    const actGrps: ActorGroup[] = []
    for (let i = 0; i < numActGrps; i++) {
      const startBox = new Box(this.system.ctx, "startBox", 
//                              new Point(this.system.ctx,  (i + 1) * 300,  (i + 1) * 100), 
                                i % 2 == 0 ? new Point(this.system.ctx, 1300, 400) : new Point(this.system.ctx,  this.system.ctx.canvas.width - 100,  100), 
//                              new Point(this.system.ctx,  (i + 2) * 300,  (i + 2) * 100), 
                                i % 2 == 0 ? new Point(this.system.ctx, 1500, 600) : new Point(this.system.ctx,  this.system.ctx.canvas.width - 500,  500), 
                                new RgbColor(0, 0, 0))
      actGrps.push(ActorGroupDynamic.newRandomizedActGrp(
                        this.system.ctx, 
                        `Explorers-${i}`, 
                        numActors, 
                        startBox,
                        this.sysExecParms, 
                        i % 2 == 0 ? cPowerCurveFactor : 0)  // apply the cPowerCurveFactor to every actor group with even id
                    )
    }            
/*    
    actGrps.push(new ActorGroupStaticBox(this.system.ctx, 
                                         "Obstacle", 
                                         new Box(this.system.ctx, 
                                                 "", 
                                                 new Point(this.system.ctx,  this.system.ctx.canvas.width / 2 - 10, this.system.ctx.canvas.height / 2 - 300), 
                                                 new Point(this.system.ctx,  this.system.ctx.canvas.width / 2 + 10, this.system.ctx.canvas.height / 2 - 100), 
                                                 new RgbColor(128, 128, 128))))
*/    

      this.system.addActGrps(actGrps).iterateOn()
      this.system.stopIterating()

    }
}



