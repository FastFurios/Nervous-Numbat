// ****************************************************************************************
//      BARRIER
// ****************************************************************************************

import { CanvasObject, Point, Box, MapperRealToCanvas } from "./geometry"
import { RgbColor, ColorScheme, cDefaultColor, cBlack } from "./color"
import { Actor } from "./actor"
import { Log } from "./log"
import { LineSegment } from "./geometry"

import { Configuration, ConfigActorGroup, ConfigActor, ConfigBarrier, ConfigBarrierSet, CoordinateType, BarrierOrientation } from "./api"


// ****************************************************************************************
//      BARRIER
// ****************************************************************************************

export class ___Barrier extends LineSegment {
    constructor(ctx: CanvasRenderingContext2D, orientation: BarrierOrientation, at: number, from: number, to: number) { 
        let base, p2: Point 
        if (orientation == BarrierOrientation.horizontal) { 
            base    = new Point(ctx, from, at)
            p2      = new Point(ctx, to,   at)
        }
        else {
            base    = new Point(ctx, at, from)
            p2      = new Point(ctx, at,   to)

        } 
        super(ctx, base, p2)
    }

    public override visualize(m2c: MapperRealToCanvas): void {
        super.visualize(m2c, new RgbColor(0, 0, 0))
    }
}

export class BarrierSet {
    constructor (public ctx: CanvasRenderingContext2D, public coordType: CoordinateType, public barriers: LineSegment[]) { }

    public visualize(m2c: MapperRealToCanvas): void {
        this.barriers.forEach(b => b.visualize(m2c, cBlack))
    }
}  