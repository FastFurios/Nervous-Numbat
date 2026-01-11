// ****************************************************************************************
//      HELPER FUNCTIONS 
// ****************************************************************************************

export function randomInRange(from: number, to: number): number {
    return from + Math.floor(Math.random() * (to - from))  
}

export function isBetween(v: number, n1: number, n2: number): boolean {
    const min = Math.min(n1, n2)
    const max = Math.max(n1, n2)
    return v >= min && v <= max
}

export function reshuffle<T>(arr: T[]): T[] {
    if (arr.length <= 1) return []
    const e: T = arr.splice(randomInRange(0, (arr.length - 1)), 1)[0]        
    return [e].concat(reshuffle<T>(arr))  
}

export function powerOf(scale: number, power: number, x: number): number {
  return scale * (x + 1) ** power;
}

export type PowerFunction = (x: number) => number
export function powerFunctionFactory(power: number, maxX: number): PowerFunction {
  const lastValue = powerOf(1, power, maxX);
  return powerOf.bind(null, 1 / lastValue, power);
}

export function powerCurveBloatedListOf<T>(list: T[], powFct: PowerFunction): T[] {
  let bloatedList: T[] = [];
  for (let i = 0; i < list.length; i++) {
    const numOfElements = Math.max(1, Math.round(powFct(i)))
    for (let j = 0; j < numOfElements; j++) bloatedList.push(list[i])
  }
  //console.log(`powerCurveBloatedListOf(${(<Actor[]>list).map(a => a.id)}) => ${(<Actor[]>bloatedList).map(a => a.id)}`)
  return bloatedList
}
