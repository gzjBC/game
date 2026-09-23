// game/recruit.ts —— 招募小人的纯逻辑（消耗浆果，受人口上限约束）
import type { SaveData } from './save';
import { SeededRng } from './rng';
import { randomName } from './names';

export const RECRUIT_COST = 10; // 招募 1 人消耗浆果

export function workerCapacity(s: SaveData): number {
  return s.baseCapacity + s.buildings.huts; // 每座茅草房 +1 人口
}

export function canRecruit(s: SaveData): boolean {
  return s.resources.berries >= RECRUIT_COST && s.workers.length < workerCapacity(s);
}

/** 招募一名新小人（返回新状态；不可招募时原样返回） */
export function doRecruit(s: SaveData, rng: SeededRng): SaveData {
  if (!canRecruit(s)) return s;
  const name = randomName(rng);
  return {
    ...s,
    resources: { ...s.resources, berries: s.resources.berries - RECRUIT_COST },
    workers: [...s.workers, { id: nextWorkerId(s), name: name.en, zhName: name.zh, task: null }],
  };
}

export function nextWorkerId(s: SaveData): number {
  return s.workers.reduce((m, w) => Math.max(m, w.id), 0) + 1;
}
