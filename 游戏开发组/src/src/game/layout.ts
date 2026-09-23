// game/layout.ts —— 世界布局纯函数：建筑占格（碰撞体积）计算
// M2：茅草房占据网格格点 → 寻路绕行（easystar grid 对应格置 1）。

export const GRID = 20; // 世界网格边长（20×20）

export interface GridPoint {
  x: number;
  y: number;
}

// 第一座茅草房所在格（山洞右侧，y=0 行）
export const HUT_SLOT_START: GridPoint = { x: 3, y: 0 };
// 茅草房座间距（格，留 1 格通道）
export const HUT_SLOT_GAP = 2;
// 每行 8 座（x=3,5,…,17）；上限 8 座（ADR 037：茅草房限 8，后续小镇阶段可升级为木屋）
export const HUT_COLS = 8;
export const HUT_ROW_GAP = 4;
export const HUT_MAX = HUT_COLS;
export const SHED_MAX = 8; // 仓库单行容量（存储上限 100+50×8=500/资源，够 M2）

/** 第 i 座茅草房占用的格子（多行排布，修复"造多看不见"越界 bug） */
export function hutSlot(i: number): GridPoint {
  const row = Math.floor(i / HUT_COLS);
  const col = i % HUT_COLS;
  return { x: HUT_SLOT_START.x + col * HUT_SLOT_GAP, y: HUT_SLOT_START.y + row * HUT_ROW_GAP };
}

/** count 座茅草房占用的所有格子 */
export function hutTiles(count: number): GridPoint[] {
  return Array.from({ length: count }, (_, i) => hutSlot(i));
}

/** 山洞占格（2×2） */
export const CAVE_TILES: GridPoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

/** 第 i 座仓库占格（茅草房正下方一行，避免与休息点冲突） */
export function shedSlot(i: number): GridPoint {
  return { x: HUT_SLOT_START.x + i * HUT_SLOT_GAP, y: HUT_SLOT_START.y + 2 };
}

/** count 座仓库占用的所有格子 */
export function shedTiles(count: number): GridPoint[] {
  return Array.from({ length: count }, (_, i) => shedSlot(i));
}

/** 资源点默认位置（建图/迁移兜底；采空重生后换随机位） */
/** 资源点初始位（2026-09-19 多点化 ADR 033：每类 N 个分散位置，避开建筑区/山洞）
 * 布局：山洞(0-1,0-1)、茅草房 x≥3、仓库 x 顶行；分散在空旷区 */
export const GATHERING_POINTS: Record<string, { x: number; y: number }[]> = {
  berry: [
    { x: 12, y: 12 },
    { x: 2, y: 14 },
    { x: 17, y: 10 },
    { x: 9, y: 17 },
  ],
  wood: [
    { x: 5, y: 16 },
    { x: 15, y: 18 },
    { x: 3, y: 7 },
  ],
  stone: [
    { x: 16, y: 5 },
    { x: 18, y: 16 },
    { x: 7, y: 2 },
  ],
};

/** 洞口（工人出生/回家点，山洞右侧一格） */
export const HOME: GridPoint = { x: 2, y: 0 };

// —— 工人专属休息点（ADR 026：分散休息，防止多小人重叠成"一个人"）——
// HOME 邻域 5 格：全部避开山洞(0-1,0-1)与茅草房((3+2i,0))，工人按 id 循环取格。

/** 休息点候选格（格子坐标） */
export const REST_SPOTS: GridPoint[] = [
  { x: 2, y: 0 }, // HOME 本身
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
];

export interface RestSpot {
  tile: GridPoint; // 休息格（寻路目标）
  dx: number; // 格内像素抖动（-2..2，同格两人错开）
  dy: number;
}

/** 第 id 个工人（id 从 1 起）的休息点：5 格循环 + 确定性抖动 */
export function restSpotFor(id: number): RestSpot {
  const tile = REST_SPOTS[(id - 1 + REST_SPOTS.length) % REST_SPOTS.length];
  // 抖动用 mod 7（与分组周期 5 互质）：同格两人（id 差 5）必然错开
  return { tile, dx: ((id * 2) % 7) - 3, dy: ((id * 5) % 7) - 3 };
}
