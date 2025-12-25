import { Component } from '@angular/core'
import { Point, Box} from "./lib/geometry"
import { RgbColor } from "./lib/color"
import { NervousNumbatSystem } from "./lib/system"
import { ActorGroup, ActorGroupDynamic } from "./lib/actorGroup"
import { cIntervalMillisecs, cPowerCurveFactor } from "./lib/parameters"

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

/**/const numActGrps = 1
/**/const numActors = 60

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



