// ****************************************************************************************
//      LOG
// ****************************************************************************************

const cLogLengthDefault = 100

export class Log {
    public  log: number[] = []
    private pos: number   = -1 // no element

    constructor(private maxLen: number = cLogLengthDefault) {} 

    public push(quality: number): void {
        if (this.log.length < this.maxLen) {
            this.log.push(quality)
            this.pos = this.log.length - 1    
        } else {
            this.pos = (this.pos + 1) % this.log.length
            this.log[this.pos] = quality 
        }
    }
    public get lastLoggedQuality(): number | undefined {
        return this.pos >= 0 ? this.log[this.pos] : undefined
    }
    public areTooManyLoggedQualitiesBelow(threshold: number): boolean {
        if (this.log.length < this.maxLen) return false
        return this.log.map(le => le < threshold).reduce((b1, b2) => b1 && b2, true)
    }
    public get avgStandardDeviation(): number {
        if (this.log.length < cLogLengthDefault) return 1
        const mean     = this.log.reduce((v1, v2) => v1 + v2, 0) / this.log.length
        const variance = this.log.map(v => Math.pow(v - mean, 2)).reduce((v1, v2) => v1 + v2, 0)
        return Math.sqrt(variance / this.log.length)
    }
    public toString(): string {
        return `log = ${this.log.map(le => le.toFixed(2))}`
    }
}


