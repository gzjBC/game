// game/buildings.ts —— 建筑纯逻辑（M1：茅草房，人口上限 +1）
import type { SaveData } from './save';
import { HUT_MAX, SHED_MAX } from './layout';

export const HUT_COST = { wood: 20, stone: 10 } as const;

export function canBuildHut(s: SaveData): boolean {
  return (
    s.buildings.huts < HUT_MAX &&
    s.resources.wood >= HUT_COST.wood &&
    s.resources.stone >= HUT_COST.stone
  );
}

/** 建造一座茅草房（返回新状态；不可建造时原样返回） */
export function doBuildHut(s: SaveData): SaveData {
  if (!canBuildHut(s)) return s;
  return {
    ...s,
    resources: {
      ...s.resources,
      wood: s.resources.wood - HUT_COST.wood,
      stone: s.resources.stone - HUT_COST.stone,
    },
    buildings: { ...s.buildings, huts: s.buildings.huts + 1 },
  };
}

// —— 仓库（M2：存储上限 +50/座，docs/04a「储物棚」；茅草房 ≥2 解锁）——
export const SHED_COST = { wood: 15, stone: 5 } as const;
export const SHED_STORAGE_BONUS = 50;
export const SHED_UNLOCK_HUTS = 2; // 需要茅草房 ≥ 2 座

export function canBuildShed(s: SaveData): boolean {
  return (
    s.buildings.huts >= SHED_UNLOCK_HUTS &&
    s.buildings.sheds < SHED_MAX &&
    s.resources.wood >= SHED_COST.wood &&
    s.resources.stone >= SHED_COST.stone
  );
}

/** 建造一座仓库：三资源存储上限各 +50（返回新状态；不可建造时原样返回） */
export function doBuildShed(s: SaveData): SaveData {
  if (!canBuildShed(s)) return s;
  return {
    ...s,
    resources: {
      ...s.resources,
      wood: s.resources.wood - SHED_COST.wood,
      stone: s.resources.stone - SHED_COST.stone,
    },
    buildings: { ...s.buildings, sheds: s.buildings.sheds + 1 },
    storage: {
      berries: s.storage.berries + SHED_STORAGE_BONUS,
      wood: s.storage.wood + SHED_STORAGE_BONUS,
      stone: s.storage.stone + SHED_STORAGE_BONUS,
    },
  };
}
