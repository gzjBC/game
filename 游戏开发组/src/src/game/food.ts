// game/food.ts —— 食物系统纯逻辑（M2，ADR 008：小人不死只罢工）
// 浆果兼作食物。工人持续消耗浆果；浆果 ≤ 0 时全队"觅食"（罢工：不产出、不积累，也不会饿死）。

import type { Resources, SaveData } from './save';

// 每名小人每秒消耗浆果数：1 个 / 60s
export const FOOD_PER_WORKER_PER_SEC = 1 / 60;

/** 饥饿时产出倍率（ADR 036：饿不死但减产一半，食物缓慢恢复解除死循环） */
export const HUNGER_RATE = 0.5;

/** 每秒全队食物消耗 */
export function foodConsumptionPerSec(workerCount: number): number {
  return workerCount * FOOD_PER_WORKER_PER_SEC;
}

/** 是否处于饥饿/觅食状态（浆果 ≤ 0） */
export function isStarving(s: Pick<SaveData, 'resources'>): boolean {
  return s.resources.berries <= 0;
}

/** 扣食物：只有有食物才扣，不会扣成负数（饿了就停吃，进入觅食） */
export function consumeFood(
  resources: Resources,
  workerCount: number,
  deltaMs: number,
): Resources {
  const need = foodConsumptionPerSec(workerCount) * (deltaMs / 1000);
  return { ...resources, berries: Math.max(0, resources.berries - need) };
}
