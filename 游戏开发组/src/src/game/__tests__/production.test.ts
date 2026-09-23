// production.test.ts —— 产出公式单测（权威公式，在线/离线共用）
import { describe, expect, it } from 'vitest';
import { computeResourceRates, computeOfflineGain, BASE_RATE, POTTERY_BERRY_MULT } from '../production';
import type { ProductionInput } from '../production';

function input(workers: { task: 'berry' | 'wood' | 'stone' | null }[], pottery = false): ProductionInput {
  return { workers, tech: { pottery } };
}

describe('computeResourceRates', () => {
  it('单浆果采集者 = 基础速率', () => {
    const r = computeResourceRates(input([{ task: 'berry' }]));
    expect(r.berries).toBeCloseTo(BASE_RATE.berry);
    expect(r.wood).toBe(0);
    expect(r.stone).toBe(0);
  });

  it('三种任务各自累加', () => {
    const r = computeResourceRates(
      input([
        { task: 'berry' },
        { task: 'berry' },
        { task: 'wood' },
        { task: 'stone' },
      ]),
    );
    expect(r.berries).toBeCloseTo(BASE_RATE.berry * 2);
    expect(r.wood).toBeCloseTo(BASE_RATE.wood);
    expect(r.stone).toBeCloseTo(BASE_RATE.stone);
  });

  it('空闲小人（task=null）不计产', () => {
    const r = computeResourceRates(input([{ task: null }, { task: 'berry' }]));
    expect(r.berries).toBeCloseTo(BASE_RATE.berry);
  });

  it('制陶科技：浆果 ×1.25，木/石不变', () => {
    const r = computeResourceRates(input([{ task: 'berry' }, { task: 'wood' }], true));
    expect(r.berries).toBeCloseTo(BASE_RATE.berry * POTTERY_BERRY_MULT);
    expect(r.wood).toBeCloseTo(BASE_RATE.wood);
  });
});

describe('computeOfflineGain', () => {
  it('离线 300s × 1 浆果采集者 = 30 浆果', () => {
    const g = computeOfflineGain(input([{ task: 'berry' }]), 300);
    expect(g.berries).toBeCloseTo(30);
  });

  it('离线 0s = 0 收益', () => {
    const g = computeOfflineGain(input([{ task: 'berry' }]), 0);
    expect(g.berries).toBe(0);
  });
});

describe('饥饿减半（ADR 036）', () => {
  it('starving=true 时速率减半', () => {
    const s: ProductionInput = { workers: [{ task: 'berry' }], tech: { pottery: false } };
    const normal = computeResourceRates(s);
    const hungry = computeResourceRates(s, true);
    expect(hungry.berries).toBeCloseTo(normal.berries * 0.5);
  });
});
