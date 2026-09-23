// logic.test.ts —— 招募/建筑/科技纯逻辑单测
import { describe, expect, it } from 'vitest';
import { createDefaultSave, type SaveData } from '../save';
import { SeededRng } from '../rng';
import { canRecruit, doRecruit, RECRUIT_COST, workerCapacity } from '../recruit';
import { canBuildHut, doBuildHut, HUT_COST } from '../buildings';
import { canResearchPottery, doResearchPottery, POTTERY_COST } from '../tech';

function saveWith(over: Partial<SaveData>): SaveData {
  return { ...createDefaultSave(), ...over };
}

describe('招募', () => {
  it('浆果不足不能招募', () => {
    const s = saveWith({ resources: { berries: RECRUIT_COST - 1, wood: 0, stone: 0 } });
    expect(canRecruit(s)).toBe(false);
  });

  it('达到人口上限不能招募', () => {
    const s = saveWith({
      resources: { berries: 999, wood: 0, stone: 0 },
      workers: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: 'x', zhName: 'x', task: null })),
      buildings: { huts: 0, sheds: 0 },
    });
    expect(workerCapacity(s)).toBe(5);
    expect(canRecruit(s)).toBe(false);
  });

  it('消耗浆果并新增小人', () => {
    const s = saveWith({ resources: { berries: RECRUIT_COST, wood: 0, stone: 0 } });
    const rng = new SeededRng(42);
    const next = doRecruit(s, rng);
    expect(next.resources.berries).toBe(0);
    expect(next.workers.length).toBe(s.workers.length + 1);
    expect(next.workers[1].zhName.length).toBeGreaterThan(0);
    expect(next.workers[1].task).toBeNull();
  });

  it('茅草房 +1 人口上限', () => {
    const s = saveWith({ buildings: { huts: 2, sheds: 0 } });
    expect(workerCapacity(s)).toBe(5 + 2);
  });
});

describe('茅草房', () => {
  it('木材/石头不足不能建', () => {
    const s = saveWith({ resources: { berries: 0, wood: HUT_COST.wood - 1, stone: HUT_COST.stone } });
    expect(canBuildHut(s)).toBe(false);
  });

  it('建造扣除资源并 +1 座', () => {
    const s = saveWith({
      resources: { berries: 0, wood: HUT_COST.wood, stone: HUT_COST.stone },
      buildings: { huts: 0, sheds: 0 },
    });
    const next = doBuildHut(s);
    expect(next.resources.wood).toBe(0);
    expect(next.resources.stone).toBe(0);
    expect(next.buildings.huts).toBe(1);
  });
});

describe('制陶科技', () => {
  it('已研究则不可重复研究', () => {
    const s = saveWith({ tech: { pottery: true, fireFarming: false } });
    expect(canResearchPottery(s)).toBe(false);
  });

  it('研究消耗资源并解锁', () => {
    const s = saveWith({
      resources: { berries: POTTERY_COST.berries, wood: POTTERY_COST.wood, stone: 0 },
      tech: { pottery: false, fireFarming: false },
    });
    const next = doResearchPottery(s);
    expect(next.tech.pottery).toBe(true);
    expect(next.resources.berries).toBe(0);
    expect(next.resources.wood).toBe(0);
  });
});
