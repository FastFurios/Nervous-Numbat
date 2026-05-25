// ****************************************************************************************
//      BARRIER
// ****************************************************************************************

import { Point, MapperRealToCanvas } from "./geometry"
import { RgbColor } from "./color"
import { LineSegment } from "./geometry"
import { BarrierOrientation } from "./api"
import { toArray } from "rxjs"

type FromToPoints = {
    from: Point
    to:   Point
}

// ****************************************************************************************
//      BARRIER
// ****************************************************************************************

export class Barrier extends LineSegment {
    constructor(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
        // setting up the LineSegment with end points stretched to the next integer coordinte to ensure full overlap of adjacent barriers


//        super(ctx, fromStretched, toStretched)
        super(ctx, 
              new Point(ctx, // from
                        from.x == to.x ? from.x : Math.floor(Math.min(from.x, to.x)),   // x
                        from.y == to.y ? from.y : Math.floor(Math.min(from.y, to.y))),  // y
              new Point(ctx, // to
                        from.x == to.x ? from.x : Math.ceil(Math.max(from.x, to.x)),   // x
                        from.y == to.y ? from.y : Math.ceil(Math.max(from.y, to.y))),  // y
        )
//      console.log(`Barrier.constructor(): from= ${from}, to= ${to} => from= ${fromStretched}, to= ${toStretched}`)
    }

    public override visualize(m2c: MapperRealToCanvas): void {
        super.visualize(m2c, new RgbColor(0, 0, 0))
    }

    public get orientation(): BarrierOrientation {
        if (this.base.x == this.p2.x) return BarrierOrientation.vertical
        if (this.base.y == this.p2.y) return BarrierOrientation.horizontal
        throw Error("Barrier.orientation(): barrier neither vertical nor horizontal")
    }
}
