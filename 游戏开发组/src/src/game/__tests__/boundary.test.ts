// boundary.test.ts —— 边界健壮性单测（测试组产出，只测不改源码）
import { describe, expect, it } from 'vitest';
import { createDefaultSave, migrateSave, type SaveData } from '../save';
import { applyOfflineProgress, OFFLINE_CAP_SECONDS } from '../offline';
import { canRecruit, doRecruit, RECRUIT_COST, workerCapacity } from '../recruit';
import { computeResourceRates, computeOfflineGain } from '../production';
import { SeededRng } from '../rng';

function saveWith(over: Partial<SaveData>): SaveData {
  return { ...createDefaultSave(), ...over };
}

describe('离线结算边界', () => {
  it('超过 8 小时按 8 小时封顶（含 0.2 速度系数与食物消耗）', () => {
    const s = saveWith({ lastSavedAt: Date.now() - 9 * 3600 * 1000 });
    const r = applyOfflineProgress(s);
    expect(r.offlineSeconds).toBe(OFFLINE_CAP_SECONDS);
    // 毛产出 0.1×0.2×28800=576，但浆果总储量 80 截断（ADR 033 多点 4×20）→ 毛 80 − 食物 480 = 净 -400
    expect(r.gained.berries).toBeCloseTo(-400);
  });

  it('lastSavedAt 在未来：离线秒数为 0，无收益', () => {
    const s = saveWith({ lastSavedAt: Date.now() + 60_000 });
    const r = applyOfflineProgress(s);
    expect(r.offlineSeconds).toBe(0);
    expect(r.report).toBeNull();
  });

  it('恰好 0 秒：无报告', () => {
    const s = saveWith({ lastSavedAt: Date.now() });
    const r = applyOfflineProgress(s);
    expect(r.offlineSeconds).toBe(0);
    expect(r.report).toBeNull();
  });

  it('离线 1 秒：毛产出 ×0.2，扣 1/60 食物', () => {
    const s = saveWith({ lastSavedAt: Date.now() - 1000 });
    const r = applyOfflineProgress(s);
    expect(r.offlineSeconds).toBe(1);
    expect(r.gained.berries).toBeCloseTo(0.1 * 0.2 - 1 / 60);
  });

  it('离线 5 分钟单人：毛 6 浆果 − 食物 5 = 净 1', () => {
    const s = saveWith({ lastSavedAt: Date.now() - 5 * 60 * 1000 });
    const r = applyOfflineProgress(s);
    expect(r.gained.berries).toBeCloseTo(0.1 * 0.2 * 300 - (1 / 60) * 300); // 6 - 5 = 1
  });
});

describe('migrateSave 异常输入', () => {
  it('null / undefined 回退默认档', () => {
    expect(migrateSave(null).version).toBe(2);
    expect(migrateSave(undefined).version).toBe(2);
  });

  it('未知版本号（如 99）按 v1 缺失字段路径迁移不崩溃', () => {
    const s = migrateSave({ version: 99, berries: 5 });
    expect(s.version).toBe(2);
    expect(s.resources.berries).toBe(5);
  });

  it('v1 完全缺字段也能生成 1 名工人', () => {
    const s = migrateSave({ version: 1 });
    expect(s.workers.length).toBe(1);
    expect(s.resources).toEqual({ berries: 0, wood: 0, stone: 0 });
  });

  it('v2 的 workers 为非法值（空数组）时回退默认 1 人', () => {
    const s = migrateSave({ version: 2, workers: [] });
    expect(s.workers.length).toBe(1);
  });

  it('v2 的 resources 部分缺失用 0 补齐', () => {
    const s = migrateSave({ version: 2, resources: { wood: 7 } });
    expect(s.resources).toEqual({ berries: 0, wood: 7, stone: 0 });
  });
});

describe('招募边界', () => {
  it('浆果恰好等于成本：可招募且归零', () => {
    const s = saveWith({ resources: { berries: RECRUIT_COST, wood: 0, stone: 0 } });
    expect(canRecruit(s)).toBe(true);
    const next = doRecruit(s, new SeededRng(1));
    expect(next.resources.berries).toBe(0);
  });

  it('浆果差 0.1 不可招募（浮点比较）', () => {
    const s = saveWith({ resources: { berries: RECRUIT_COST - 0.1, wood: 0, stone: 0 } });
    expect(canRecruit(s)).toBe(false);
  });

  it('容量边界：正好满员不可招募', () => {
    const n = 5;
    const s = saveWith({
      resources: { berries: 999, wood: 0, stone: 0 },
      workers: Array.from({ length: n }, (_, i) => ({ id: i + 1, name: 'x', zhName: 'x', task: null })),
    });
    expect(workerCapacity(s)).toBe(n);
    expect(canRecruit(s)).toBe(false);
  });

  it('同 seed 招募同名（可复现性）', () => {
    const a = doRecruit(saveWith({ resources: { berries: RECRUIT_COST, wood: 0, stone: 0 } }), new SeededRng(42));
    const b = doRecruit(saveWith({ resources: { berries: RECRUIT_COST, wood: 0, stone: 0 } }), new SeededRng(42));
    expect(a.workers[a.workers.length - 1].name).toBe(b.workers[b.workers.length - 1].name);
    expect(a.workers[a.workers.length - 1].zhName).toBe(b.workers[b.workers.length - 1].zhName);
  });
});

describe('production 边界', () => {
  it('空 workers：全速率 0', () => {
    const r = computeResourceRates({ workers: [], tech: { pottery: false } });
    expect(r).toEqual({ berries: 0, wood: 0, stone: 0 });
  });

  it('全员 task=null：全速率 0', () => {
    const r = computeResourceRates({
      workers: [{ task: null }, { task: null }],
      tech: { pottery: false },
    });
    expect(r.berries).toBe(0);
  });

  it('制陶加成对 0 速率无副作用（不产生 NaN/负数）', () => {
    const r = computeResourceRates({ workers: [], tech: { pottery: true } });
    expect(Number.isFinite(r.berries)).toBe(true);
    expect(r.berries).toBe(0);
  });

  it('离线 0 秒无收益', () => {
    const g = computeOfflineGain({ workers: [{ task: 'berry' }], tech: { pottery: false } }, 0);
    expect(g.berries).toBe(0);
  });

  it('离线负秒数按 0 处理', () => {
    const g = computeOfflineGain({ workers: [{ task: 'berry' }], tech: { pottery: false } }, -5);
    expect(g.berries).toBe(0);
  });
});
