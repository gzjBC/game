// food.test.ts —— 食物系统单测
import { describe, expect, it } from 'vitest';
import { createDefaultSave, type SaveData } from '../save';
import {
  FOOD_PER_WORKER_PER_SEC,
  foodConsumptionPerSec,
  isStarving,
  consumeFood,
} from '../food';

function saveWith(over: Partial<SaveData>): SaveData {
  return { ...createDefaultSave(), ...over };
}

describe('食物消耗', () => {
  it('单人工人每秒消耗 1/60 浆果', () => {
    expect(foodConsumptionPerSec(1)).toBeCloseTo(FOOD_PER_WORKER_PER_SEC);
  });

  it('3 人工人消耗 ×3', () => {
    expect(foodConsumptionPerSec(3)).toBeCloseTo(FOOD_PER_WORKER_PER_SEC * 3);
  });

  it('1 分钟 1 人恰好消耗 1 浆果', () => {
    const r = consumeFood({ berries: 10, wood: 0, stone: 0 }, 1, 60_000);
    expect(r.berries).toBeCloseTo(9);
  });

  it('有食物时按需扣减', () => {
    const r = consumeFood({ berries: 0.5, wood: 0, stone: 0 }, 1, 30_000);
    expect(r.berries).toBeCloseTo(0);
  });
});

describe('饥饿判定与不扣穿', () => {
  it('浆果为 0 → 饥饿', () => {
    expect(isStarving(saveWith({ resources: { berries: 0, wood: 0, stone: 0 } }))).toBe(true);
  });

  it('浆果为正 → 不饥饿', () => {
    expect(isStarving(saveWith({ resources: { berries: 0.01, wood: 0, stone: 0 } }))).toBe(false);
  });

  it('浆果为负 → 饥饿（防御旧档）', () => {
    expect(isStarving(saveWith({ resources: { berries: -3, wood: 0, stone: 0 } }))).toBe(true);
  });

  it('食物不足时不会扣成负数（不饿死）', () => {
    const r = consumeFood({ berries: 0.1, wood: 0, stone: 0 }, 1, 60_000);
    expect(r.berries).toBe(0);
  });
});
