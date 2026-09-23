// game/production.ts —— 产出纯函数（ADR 009：在线/离线共用同一权威公式）
// M1：三种采集任务 → 三种资源；浆果受制陶科技 1.25 倍加成。

import type { ResourceKey } from './resources';
import type { GatheringTask } from './save';

export interface ProductionInput {
  workers: { task: GatheringTask | null }[];
  tech: { pottery: boolean };
}

export interface ProductionRates {
  berries: number;
  wood: number;
  stone: number;
}

// 每名小人每秒的采集量（数值草案取整量级）
export const BASE_RATE: Record<GatheringTask, number> = {
  berry: 0.1, // 浆果 0.1/s
  wood: 0.05, // 木材 0.05/s
  stone: 0.03, // 石头 0.03/s
};

// 制陶科技：浆果产出 +25%
export const POTTERY_BERRY_MULT = 1.25;

// 采集任务 → 资源键映射（task 是 'berry'，资源键是 'berries'）
export const TASK_TO_RESOURCE: Record<GatheringTask, ResourceKey> = {
  berry: 'berries',
  wood: 'wood',
  stone: 'stone',
};

export function computeResourceRates(s: ProductionInput, starving = false): ProductionRates {
  const mult = starving ? 0.5 : 1; // 饥饿减半（ADR 036，与 harvest 实际入库存一致）
  const rates: ProductionRates = { berries: 0, wood: 0, stone: 0 };
  for (const w of s.workers) {
    if (!w.task) continue;
    const key = TASK_TO_RESOURCE[w.task];
    rates[key] += BASE_RATE[w.task] * mult;
  }
  if (s.tech.pottery) rates.berries *= POTTERY_BERRY_MULT;
  return rates;
}

export function computeOfflineGain(
  s: ProductionInput,
  seconds: number,
): ProductionRates {
  const safe = Math.max(0, seconds); // 防御负秒数（边界测试抓出）
  const r = computeResourceRates(s);
  return {
    berries: r.berries * safe,
    wood: r.wood * safe,
    stone: r.stone * safe,
  };
}
