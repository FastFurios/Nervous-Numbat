import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class System {
  private ctx: CanvasRenderingContext2D | undefined = undefined
  constructor() {
    console.log(`services/system.constructor(ctx)`)
  }

  public deliverSpotOnCanvas(ctx: CanvasRenderingContext2D, x: number, y: number): number {
    console.log(`service.system.deliverSpotOnCanvas(): ...`)
    if (!ctx) {
      console.log(`service.system.deliverSpotOnCanvas(): ctx is undefined!`)
      return -1
    }
    console.log(`service.system.deliverSpotOnCanvas(): draw point on canvas at (${x}/${y})`)
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, 2 * Math.PI)
    ctx.strokeStyle = `rgba(150, 83, 83, 1)`
    ctx.stroke()
    ctx.fillStyle = `rgba(150, 83, 83, 1)`
    ctx.fill()
    ctx.closePath
    ctx.font = "12px Arial"
    ctx.fillText(`drawn by the service`, 50, 50)
    


    return x + y
  }
}
