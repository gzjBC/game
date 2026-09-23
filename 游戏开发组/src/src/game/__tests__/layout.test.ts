// layout.test.ts —— 建筑占格布局单测
import { describe, expect, it } from 'vitest';
import { HUT_MAX, hutSlot, hutTiles, CAVE_TILES, HOME, HUT_SLOT_GAP, REST_SPOTS, restSpotFor } from '../layout';

describe('茅草房占格', () => {
  it('第 0 座在山洞右侧第 3 格', () => {
    expect(hutSlot(0)).toEqual({ x: 3, y: 0 });
  });

  it('座间距为 2 格（中间留通道）', () => {
    expect(HUT_SLOT_GAP).toBe(2);
    expect(hutSlot(1).x - hutSlot(0).x).toBe(2);
    expect(hutSlot(2).x - hutSlot(1).x).toBe(2);
  });

  it('3 座茅草房占 3 个互不重叠的格子', () => {
    const tiles = hutTiles(3);
    expect(tiles.length).toBe(3);
    const keys = new Set(tiles.map((t) => `${t.x},${t.y}`));
    expect(keys.size).toBe(3);
  });

  it('茅草房上限 8 座单行（ADR 037）：全在 y=0 行且地图内', () => {
    expect(hutSlot(0)).toEqual({ x: 3, y: 0 });
    expect(hutSlot(7)).toEqual({ x: 17, y: 0 }); // 第 8 座行末
    expect(HUT_MAX).toBe(8);
  });

  it('8 座占格全部在地图内且互不重叠', () => {
    const tiles = hutTiles(8);
    const keys = new Set(tiles.map((t) => `${t.x},${t.y}`));
    expect(keys.size).toBe(8);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThan(20);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThan(20);
    }
  });
});

describe('山洞与洞口', () => {
  it('山洞占 2×2 四格', () => {
    expect(CAVE_TILES.length).toBe(4);
    expect(CAVE_TILES).toContainEqual({ x: 0, y: 0 });
    expect(CAVE_TILES).toContainEqual({ x: 1, y: 1 });
  });

  it('洞口在 (2,0)，不在山洞占格内', () => {
    expect(HOME).toEqual({ x: 2, y: 0 });
    expect(CAVE_TILES.some((t) => t.x === HOME.x && t.y === HOME.y)).toBe(false);
  });

  it('洞口不与第 0 座茅草房重叠', () => {
    expect(hutSlot(0)).not.toEqual(HOME);
  });
});

describe('工人专属休息点（ADR 026：防小人重叠）', () => {

  it('5 个休息格全部避开山洞与任意数量茅草房', () => {
    for (const spot of REST_SPOTS) {
      expect(CAVE_TILES.some((t) => t.x === spot.x && t.y === spot.y)).toBe(false);
      for (let i = 0; i < 12; i++) {
        expect(hutSlot(i)).not.toEqual(spot);
      }
    }
  });

  it('休息格两两不重复', () => {
    const keys = new Set(REST_SPOTS.map((t) => `${t.x},${t.y}`));
    expect(keys.size).toBe(REST_SPOTS.length);
  });

  it('restSpotFor 确定性：同 id 恒同点', () => {
    const a = restSpotFor(3);
    const b = restSpotFor(3);
    expect(a).toEqual(b);
  });

  it('id 1..10 覆盖全部 5 格（每格 2 人）且抖动不重复', () => {
    const byTile = new Map<string, string[]>();
    for (let id = 1; id <= 10; id++) {
      const s = restSpotFor(id);
      const k = `${s.tile.x},${s.tile.y}`;
      const arr = byTile.get(k) ?? [];
      arr.push(`${s.dx},${s.dy}`);
      byTile.set(k, arr);
    }
    expect(byTile.size).toBe(5);
    for (const [k, arr] of byTile) {
      expect(arr.length).toBe(2);
      expect(new Set(arr).size).toBe(2); // 同格两人抖动错开
      void k;
    }
  });

  it('抖动范围在格内（±2px，不超出 24px 格子）', () => {
    for (let id = 1; id <= 20; id++) {
      const s = restSpotFor(id);
      expect(Math.abs(s.dx)).toBeLessThanOrEqual(3);
      expect(Math.abs(s.dy)).toBeLessThanOrEqual(3);
    }
  });
});
