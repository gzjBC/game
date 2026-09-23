// M2 单测：存储上限截断 / 火耕解锁村庄 / 仓库扩容 / 存档迁移兼容
import { describe, expect, it } from 'vitest';
import { addResource, createResources } from '../resources';
import {
  canResearchFireFarming,
  doResearchFireFarming,
  FIRE_FARMING_COST,
} from '../tech';
import {
  canBuildShed,
  doBuildShed,
  SHED_COST,
  SHED_STORAGE_BONUS,
  SHED_UNLOCK_HUTS,
} from '../buildings';
import { migrateSave } from '../save';
import type { SaveData } from '../save';

const fullSave = (over: Partial<SaveData> = {}): SaveData =>
  migrateSave({
    version: 2,
    seed: 1,
    age: 'stone',
    resources: { berries: 0, wood: 0, stone: 0 },
    storage: { berries: 100, wood: 100, stone: 100 },
    resourceNodes: {
      berry: { stock: 20, respawnAt: 0 },
      wood: { stock: 15, respawnAt: 0 },
      stone: { stock: 10, respawnAt: 0 },
    },
    workers: [{ id: 1, name: 'K', zhName: '凯', task: 'berry' }],
    baseCapacity: 5,
    fireLit: false,
    buildings: { huts: 0, sheds: 0 },
    tech: { pottery: false, fireFarming: false },
    ...over,
  } as SaveData);

describe('存储上限（M2）', () => {
  it('addResource 不超过上限', () => {
    const r = addResource(createResources(), { berries: 100, wood: 100, stone: 100 }, 'berries', 50);
    expect(r.berries).toBe(50);
    const capped = addResource(r, { berries: 100, wood: 100, stone: 100 }, 'berries', 80);
    expect(capped.berries).toBe(100); // 截断
  });

  it('负资源不受截断影响（可扣到负？应至少不小于 0 语义由调用方保证）', () => {
    const r = addResource({ berries: 10, wood: 0, stone: 0 }, { berries: 100, wood: 100, stone: 100 }, 'berries', -15);
    expect(r.berries).toBe(-5); // 截断只防上限，不防下限（生产不产负）
  });
});

describe('火耕科技（M2：解锁村庄阶段）', () => {
  it('资源不足不可研究', () => {
    const s = fullSave();
    expect(canResearchFireFarming(s)).toBe(false);
    expect(doResearchFireFarming(s)).toBe(s); // 原样返回
  });

  it('研究成功：扣资源 + 解锁村庄时代', () => {
    const s = fullSave({
      resources: { berries: 100, wood: 0, stone: 50 },
    });
    expect(canResearchFireFarming(s)).toBe(true);
    const next = doResearchFireFarming(s);
    expect(next.tech.fireFarming).toBe(true);
    expect(next.age).toBe('village');
    expect(next.resources.berries).toBe(100 - FIRE_FARMING_COST.berries);
    expect(next.resources.stone).toBe(50 - FIRE_FARMING_COST.stone);
  });

  it('二次研究幂等（已解锁则不可再研究）', () => {
    const s = fullSave({
      resources: { berries: 100, wood: 0, stone: 50 },
      tech: { pottery: false, fireFarming: true },
      age: 'village',
    });
    expect(canResearchFireFarming(s)).toBe(false);
  });
});

describe('仓库建筑（M2：存储 +50/座，茅草房 ≥2 解锁）', () => {
  it('茅草房不足 2 座不可建', () => {
    const s = fullSave({ resources: { berries: 0, wood: 100, stone: 100 } });
    expect(canBuildShed(s)).toBe(false);
    expect(doBuildShed(s)).toBe(s);
  });

  it('建造成功：扣资源 + sheds+1 + 三资源存储各 +50', () => {
    const s = fullSave({
      resources: { berries: 0, wood: 100, stone: 100 },
      buildings: { huts: SHED_UNLOCK_HUTS, sheds: 0 },
    });
    expect(canBuildShed(s)).toBe(true);
    const next = doBuildShed(s);
    expect(next.buildings.sheds).toBe(1);
    expect(next.resources.wood).toBe(100 - SHED_COST.wood);
    expect(next.resources.stone).toBe(100 - SHED_COST.stone);
    expect(next.storage).toEqual({
      berries: 100 + SHED_STORAGE_BONUS,
      wood: 100 + SHED_STORAGE_BONUS,
      stone: 100 + SHED_STORAGE_BONUS,
    });
  });

  it('仓库连锁：2 座后存储上限 200', () => {
    const s = fullSave({
      resources: { berries: 0, wood: 100, stone: 100 },
      storage: { berries: 150, wood: 150, stone: 150 }, // 已建 1 座 → 上限 150
      buildings: { huts: 3, sheds: 1 },
    });
    const next = doBuildShed(s);
    expect(next.buildings.sheds).toBe(2);
    expect(next.storage.berries).toBe(200);
  });
});

describe('存档迁移（M2 新增字段兼容）', () => {
  it('旧 v2 档（无 age/storage/sheds/fireFarming）补齐默认', () => {
    const legacy = {
      version: 2,
      seed: 7,
      resources: { berries: 30, wood: 40, stone: 50 },
      resourceNodes: {},
      workers: [],
      baseCapacity: 5,
      fireLit: false,
      buildings: { huts: 2 },
      tech: { pottery: true },
    };
    const s = migrateSave(legacy as unknown as SaveData);
    expect(s.age).toBe('stone');
    expect(s.buildings.sheds).toBe(0);
    expect(s.tech.fireFarming).toBe(false);
    expect(s.storage).toEqual({ berries: 100, wood: 100, stone: 100 }); // 存量 < 100 不抬高
  });

  it('存量超过 100 的旧档：存储上限不低于存量（不惩罚玩家）', () => {
    const legacy = {
      version: 2,
      seed: 8,
      resources: { berries: 150, wood: 0, stone: 0 },
      resourceNodes: {},
      workers: [],
      baseCapacity: 5,
      fireLit: false,
      buildings: { huts: 0 },
      tech: { pottery: false },
    };
    const s = migrateSave(legacy as unknown as SaveData);
    expect(s.storage.berries).toBe(150);
  });
});
