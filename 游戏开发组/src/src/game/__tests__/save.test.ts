// save.test.ts —— 存档结构与 v1→v2 迁移单测
import { describe, expect, it } from 'vitest';
import { createDefaultSave, migrateSave } from '../save';

describe('createDefaultSave', () => {
  it('初始 1 名浆果采集者，资源为 0', () => {
    const s = createDefaultSave();
    expect(s.version).toBe(2);
    expect(s.workers.length).toBe(1);
    expect(s.workers[0].task).toBe('berry');
    expect(s.baseCapacity).toBe(5);
    expect(s.resources).toEqual({ berries: 0, wood: 0, stone: 0 });
  });
});

describe('migrateSave v1→v2', () => {
  it('v1 浆果与人数正确迁移', () => {
    const v1 = {
      version: 1,
      seed: 123,
      berries: 42,
      berryGatherers: 3,
      fireLit: true,
      lastSavedAt: 1000,
      meta: { prestigeCount: 0, globalMult: 1, lifetimeStats: {}, seedHistory: [], codex: {}, achievements: [], dailyHistory: {} },
    };
    const s = migrateSave(v1);
    expect(s.version).toBe(2);
    expect(s.resources.berries).toBe(42);
    expect(s.resources.wood).toBe(0);
    expect(s.workers.length).toBe(3);
    expect(s.fireLit).toBe(true);
    expect(s.buildings.huts).toBe(0);
    expect(s.tech.pottery).toBe(false);
  });

  it('v1 berryGatherers 缺失时至少 1 人', () => {
    const s = migrateSave({ version: 1, berries: 1 });
    expect(s.workers.length).toBe(1);
  });

  it('v2 缺失字段用默认补齐', () => {
    const s = migrateSave({ version: 2, seed: 7, resources: { berries: 9 } });
    expect(s.resources).toEqual({ berries: 9, wood: 0, stone: 0 });
    expect(s.workers.length).toBe(1);
    expect(s.buildings.huts).toBe(0);
  });

  it('未知格式回退默认档', () => {
    const s = migrateSave(null);
    expect(s.version).toBe(2);
  });
});

describe('资源点 migrate 防御（2026-09-19 树林污染事故修复）', () => {
  it('respawnAt 超远未来（异常注入）→ 归 0 且回满', () => {
    const now = Date.now();
    const raw = {
      version: 2,
      resourceNodes: {
        wood: { remaining: 0, max: 15, respawnAt: now + 999_999_999, pos: { x: 3, y: 3 } },
      },
    };
    const s = migrateSave(raw);
    const wood = s.resourceNodes.find((n) => n.task === 'wood')!;
    expect(wood.respawnAt).toBe(0);
    expect(wood.remaining).toBe(15);
  });

  it('正常刷新周期（≤240s）不被误伤', () => {
    const now = Date.now();
    const raw = {
      version: 2,
      resourceNodes: {
        stone: { remaining: 0, max: 10, respawnAt: now + 100_000, pos: { x: 1, y: 1 } },
      },
    };
    const s = migrateSave(raw);
    const stone = s.resourceNodes.find((n) => n.task === 'stone')!;
    expect(stone.respawnAt).toBe(now + 100_000);
    expect(stone.remaining).toBe(0);
  });

  it('remaining 越界 clamp（负→0，超 max→max）', () => {
    const raw = {
      version: 2,
      resourceNodes: {
        berry: { remaining: -5, max: 20, respawnAt: 0, pos: { x: 2, y: 2 } },
        wood: { remaining: 999, max: 15, respawnAt: 0, pos: { x: 3, y: 3 } },
      },
    };
    const s = migrateSave(raw);
    const berry = s.resourceNodes.find((n) => n.task === 'berry')!;
    const wood = s.resourceNodes.find((n) => n.task === 'wood')!;
    expect(berry.remaining).toBe(0);
    expect(wood.remaining).toBe(15);
  });
});
