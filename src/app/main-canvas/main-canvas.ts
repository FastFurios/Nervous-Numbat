import { Component } from '@angular/core'
import { Point, Box} from "./library/geometry"
import { ColorSchemes, RgbColor } from "./library/color"
import { NervousNumbatSystem } from "./library/system"
import { ActorGroup, ActorGroupDynamic, ActorGroupStaticBox } from "./library/actorGroup"
import { cIntervalMillisecs, cPowerCurveFactor } from "./library/parameters"

@Component({
  selector: 'main-canvas',
  imports: [],
  templateUrl: './main-canvas.html',
  styleUrl: './main-canvas.css',
})
export class MainCanvas {
  public system: NervousNumbatSystem | undefined = undefined

  constructor() {
    console.log("Welcome from the MainCanvas component.")
  }
 
  public systemSetupHandler(): void {
    console.log(`systemSetupHandler()`)

/**/const numActGrps = 2
/**/const numActors = 60

    this.system?.stopIterating()
    this.system = new NervousNumbatSystem(cIntervalMillisecs)

    const actGrps: ActorGroup[] = []
    for (let i = 0; i < numActGrps; i++) {
      const startBox = new Box(this.system.ctx, "startBox", 
//                              new Point(this.system.ctx,  (i + 1) * 300,  (i + 1) * 100), 
                                i % 2 == 0 ? new Point(this.system.ctx, 100, 100) : new Point(this.system.ctx,  this.system.ctx.canvas.width - 100,  100), 
//                              new Point(this.system.ctx,  (i + 2) * 300,  (i + 2) * 100), 
                                i % 2 == 0 ? new Point(this.system.ctx, 500, 500) : new Point(this.system.ctx,  this.system.ctx.canvas.width - 500,  500), 
                                new RgbColor(0, 0, 0))
      actGrps.push(ActorGroupDynamic.newRandomizedActGrp(
                        this.system.ctx, 
                        `Explorers-${i}`, 
                        numActors, 
                        startBox,
                        i % 2 == 0 ? cPowerCurveFactor : 0)  // apply the cPowerCurveFactor to every actor group with even id
                    )
    }            
    actGrps.push(new ActorGroupStaticBox(this.system.ctx, 
                                         "Obstacle", 
                                         new Box(this.system.ctx, 
                                                 "", 
                                                 new Point(this.system.ctx,  this.system.ctx.canvas.width / 2 - 10, this.system.ctx.canvas.height / 2 - 100), 
                                                 new Point(this.system.ctx,  this.system.ctx.canvas.width / 2 + 10, this.system.ctx.canvas.height / 2 + 100), 
                                                 new RgbColor(128, 128, 128))))

    this.system.addActGrps(actGrps).iterate()
  }
}



