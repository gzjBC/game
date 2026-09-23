// game/tech.ts —— 科技纯逻辑（M1：制陶 → 浆果产出 +25%）
import type { SaveData } from './save';

export const POTTERY_COST = { berries: 15, wood: 10 } as const;

export function canResearchPottery(s: SaveData): boolean {
  return (
    !s.tech.pottery &&
    s.resources.berries >= POTTERY_COST.berries &&
    s.resources.wood >= POTTERY_COST.wood
  );
}

/** 研究制陶（返回新状态；不可研究时原样返回） */
export function doResearchPottery(s: SaveData): SaveData {
  if (!canResearchPottery(s)) return s;
  return {
    ...s,
    resources: {
      ...s.resources,
      berries: s.resources.berries - POTTERY_COST.berries,
      wood: s.resources.wood - POTTERY_COST.wood,
    },
    tech: { ...s.tech, pottery: true },
  };
}

// —— 火耕（M2，解锁村庄阶段，docs/04c）——
export const FIRE_FARMING_COST = { berries: 80, stone: 40 } as const;

export function canResearchFireFarming(s: SaveData): boolean {
  return (
    !s.tech.fireFarming &&
    s.resources.berries >= FIRE_FARMING_COST.berries &&
    s.resources.stone >= FIRE_FARMING_COST.stone
  );
}

/** 研究火耕：消耗资源，解锁村庄时代（返回新状态；不可研究时原样返回） */
export function doResearchFireFarming(s: SaveData): SaveData {
  if (!canResearchFireFarming(s)) return s;
  return {
    ...s,
    resources: {
      ...s.resources,
      berries: s.resources.berries - FIRE_FARMING_COST.berries,
      stone: s.resources.stone - FIRE_FARMING_COST.stone,
    },
    tech: { ...s.tech, fireFarming: true },
    age: 'village',
  };
}
