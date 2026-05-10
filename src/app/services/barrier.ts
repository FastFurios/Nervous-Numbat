// ****************************************************************************************
//      BARRIER
// ****************************************************************************************

import { CanvasObject, Point, Box, MapperRealToCanvas } from "./geometry"
import { RgbColor, ColorScheme, cDefaultColor, cBlack } from "./color"
import { Actor } from "./actor"
import { Log } from "./log"
import { LineSegment } from "./geometry"

import { BarrierOrientation } from "./api"


// ****************************************************************************************
//      BARRIER
// ****************************************************************************************

export class Barrier extends LineSegment {
    constructor(ctx: CanvasRenderingContext2D, from: Point, to: Point) { 
        super(ctx, from, to)
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

/*
export class BarrierSet {
    constructor (public ctx: CanvasRenderingContext2D, public barriers: Barrier[]) { }

    public visualize(m2c: MapperRealToCanvas): void {
        this.barriers.forEach(b => b.visualize(m2c, cBlack))
    }
}  
*/
