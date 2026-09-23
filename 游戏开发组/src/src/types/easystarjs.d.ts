// easystarjs 无官方类型声明，这里给出实际导出结构的最小声明。
// 实际导出：module.exports = { js: EasyStar 构造函数, TOP/RIGHT/... 方向常量 }
declare module 'easystarjs' {
  export interface GridPoint {
    x: number;
    y: number;
  }

  export class EasyStar {
    constructor();
    setGrid(grid: number[][]): void;
    setAcceptableTiles(tiles: number[]): void;
    enableDiagonals(): void;
    setTileCost(tile: number, cost: number): void;
    setIterationsPerCalculation(iterations: number): void;
    findPath(
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      callback: (path: GridPoint[] | null) => void,
    ): void;
    calculate(): void;
    isCalculating(): boolean;
  }

  const EasyStarModule: { js: typeof EasyStar };
  export default EasyStarModule;
}
