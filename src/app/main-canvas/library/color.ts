// ****************************************************************************************
//      COLOR
// ****************************************************************************************

import { randomInRange, reshuffle } from "./helpers"
import { cOpacity } from "./actor"

export type NumberRange      = [number, number]
export type OneRgbColorRange = NumberRange
export type ColorScheme      = [OneRgbColorRange, OneRgbColorRange, OneRgbColorRange]    

export class RgbColor {
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

export const cDefaultColor = new RgbColor(0, 0, 0)

export class ColorSchemes {
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
