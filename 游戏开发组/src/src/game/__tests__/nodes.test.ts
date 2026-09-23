// nodes.test.ts —— 资源点储量/采空/刷新/随机重生纯逻辑（M2 docs/05 v2；ADR 033 多点化）
import { describe, expect, it } from 'vitest';
import {
  createNodes,
  consumeNode,
  tickNodes,
  rollNodePos,
  isDepleted,
  anyAvailable,
  taskAvailable,
  bestNodeFor,
  totalRemaining,
  applyOfflineToNodes,
  nodesByTask,
  NODE_CONFIG,
  NODE_COUNTS,
  TASKS,
  type ResourceNode,
} from '../nodes';
import { GATHERING_POINTS } from '../layout';

const NOW = 1_000_000;
const noOcc: { x: number; y: number }[] = [];

const mk = (task: ResourceNode['task'], over: Partial<ResourceNode> = {}): ResourceNode => ({
  id: `${task}-0`,
  task,
  remaining: 10,
  max: 10,
  respawnAt: 0,
  pos: { x: 1, y: 1 },
  ...over,
});

describe('资源点初始（ADR 033 多点）', () => {
  it('每类 N 个点（4 浆果 + 3 木 + 3 石 = 10），全满、id 唯一、带分散初始位', () => {
    const n = createNodes();
    expect(n.length).toBe(10);
    const ids = new Set(n.map((x) => x.id));
    expect(ids.size).toBe(10);
    for (const t of TASKS) {
      const mine = nodesByTask(n, t);
      expect(mine.length).toBe(NODE_COUNTS[t]);
      for (const node of mine) {
        expect(node.remaining).toBe(NODE_CONFIG[t].max);
        expect(node.max).toBe(NODE_CONFIG[t].max);
        expect(node.respawnAt).toBe(0);
        expect(GATHERING_POINTS[t].some((p) => p.x === node.pos.x && p.y === node.pos.y)).toBe(true);
      }
    }
  });

  it('多个点初始位置互不重叠', () => {
    const n = createNodes();
    const keys = n.map((x) => `${x.pos.x},${x.pos.y}`);
    expect(new Set(keys).size).toBe(n.length);
  });
});

describe('采集扣减与采空登记', () => {
  it('采集 1 次剩余 -1，不登记刷新', () => {
    const berry = mk('berry', { remaining: NODE_CONFIG.berry.max });
    const next = consumeNode('berry', berry, NOW);
    expect(next.remaining).toBe(NODE_CONFIG.berry.max - 1);
    expect(next.respawnAt).toBe(0);
  });

  it('采到 0 时登记回满倒计时（周期 = 配置）', () => {
    const berry = mk('berry', { remaining: 1 });
    const next = consumeNode('berry', berry, NOW);
    expect(next.remaining).toBe(0);
    expect(next.respawnAt).toBe(NOW + NODE_CONFIG.berry.cycleMs);
  });

  it('采空后再采：不扣、不重置倒计时', () => {
    const once = consumeNode('berry', mk('berry', { remaining: 1 }), NOW);
    const twice = consumeNode('berry', once, NOW + 5);
    expect(twice.remaining).toBe(0);
    expect(twice.respawnAt).toBe(NOW + NODE_CONFIG.berry.cycleMs);
  });

  it('采空判定 isDepleted', () => {
    expect(isDepleted(mk('berry', { remaining: 0 }))).toBe(true);
    expect(isDepleted(mk('berry', { remaining: 1 }))).toBe(false);
  });
});

describe('刷新推进', () => {
  it('到点回满、清倒计时', () => {
    const n = createNodes();
    n[0] = { ...n[0], remaining: 0, respawnAt: NOW + 100 };
    const next = tickNodes(n, NOW + 100, noOcc);
    expect(next[0].remaining).toBe(NODE_CONFIG.berry.max);
    expect(next[0].respawnAt).toBe(0);
  });

  it('未到点保持采空', () => {
    const n = createNodes();
    n[0] = { ...n[0], remaining: 0, respawnAt: NOW + 100 };
    const next = tickNodes(n, NOW + 99, noOcc);
    expect(next[0].remaining).toBe(0);
  });

  it('无倒计时节点不变（引用相同）', () => {
    const n = createNodes();
    const next = tickNodes(n, NOW + 999_999, noOcc);
    expect(next).toBe(n);
  });
});

describe('随机重生换位（docs/05 v2：采空消失 → 随机新位置）', () => {
  it('刷新后位置变化（旧位被占 → 必换新位）', () => {
    const n = createNodes();
    const oldPos = { ...n[0].pos };
    n[0] = { ...n[0], remaining: 0, respawnAt: NOW + 100 };
    // 占用集包含旧位 → 新位置必然 ≠ 旧位
    const next = tickNodes(n, NOW + 100, [{ ...oldPos }]);
    expect(next[0].remaining).toBe(NODE_CONFIG.berry.max);
    expect(next[0].pos).not.toEqual(oldPos);
  });

  it('rollNodePos 避开占用格', () => {
    const rng = () => 0; // 随机恒 0 → 永远落在 (1,1)
    const p = rollNodePos([{ x: 1, y: 1 }], rng);
    expect(`${p.x},${p.y}`).not.toBe('1,1'); // (1,1) 被占 → 不落回被占格
  });

  it('地图几乎满时兜底不卡死', () => {
    const full: { x: number; y: number }[] = [];
    for (let x = 1; x < 19; x++) for (let y = 1; y < 19; y++) full.push({ x, y });
    const p = rollNodePos(full, () => 0);
    expect(p).toBeDefined();
    expect(p.x).toBeGreaterThanOrEqual(1);
  });

  it('多个节点同时刷新：新位置互不重叠', () => {
    const n = createNodes().map((x) => ({ ...x, remaining: 0, respawnAt: NOW + 100 }));
    const next = tickNodes(n, NOW + 100, noOcc);
    const keys = next.map((x) => `${x.pos.x},${x.pos.y}`);
    expect(new Set(keys).size).toBe(next.length);
  });
});

describe('可用性与就近选点（ADR 033）', () => {
  it('anyAvailable：全满 true；全空 false', () => {
    expect(anyAvailable(createNodes())).toBe(true);
    const empty = createNodes().map((x) => ({ ...x, remaining: 0 }));
    expect(anyAvailable(empty)).toBe(false);
  });

  it('taskAvailable：按类型判断', () => {
    const n = createNodes();
    expect(taskAvailable(n, 'berry')).toBe(true);
    const noBerry = n.map((x) => (x.task === 'berry' ? { ...x, remaining: 0 } : x));
    expect(taskAvailable(noBerry, 'berry')).toBe(false);
    expect(taskAvailable(noBerry, 'wood')).toBe(true);
  });

  it('bestNodeFor：选同类型最近可采点', () => {
    const n = createNodes();
    // 只留两个浆果点：近的 (1,1) 采空，远的 (10,10) 有货
    const mine = nodesByTask(n, 'berry');
    const near = mine[0];
    const far = mine[1];
    const mod = n.map((x) =>
      x.id === near.id
        ? { ...x, remaining: 0, pos: { x: 1, y: 1 } }
        : x.id === far.id
          ? { ...x, remaining: 5, pos: { x: 10, y: 10 } }
          : x,
    );
    const target = bestNodeFor(mod, 'berry', { x: 9, y: 9 });
    expect(target.id).toBe(far.id);
  });

  it('bestNodeFor：全部采空 → 选最近残影点（等刷新）', () => {
    const n = createNodes().map((x) => ({ ...x, remaining: 0 }));
    const mine = nodesByTask(n, 'berry');
    const far = mine[1];
    const mod = n.map((x) => (x.id === far.id ? { ...x, pos: { x: 10, y: 10 } } : x));
    const target = bestNodeFor(mod, 'berry', { x: 9, y: 9 });
    expect(target.id).toBe(far.id); // 最近的残影点
  });

  it('totalRemaining：同类型各点剩余之和', () => {
    const n = createNodes();
    const mine = nodesByTask(n, 'berry');
    const mod = n.map((x) => (x.id === mine[0].id ? { ...x, remaining: 0 } : x));
    expect(totalRemaining(mod, 'berry')).toBe(NODE_CONFIG.berry.max * (NODE_COUNTS.berry - 1));
  });
});

describe('离线结算（docs/05 §6 + ADR 033：先刷新再按总量截断）', () => {
  it('离线毛产大于总量时 clamp 到总量', () => {
    const n = createNodes();
    const mine = nodesByTask(n, 'berry');
    const mod = n.map((x) => (x.id === mine[0].id ? { ...x, remaining: 3 } : x));
    const next = applyOfflineToNodes(mod, { berry: 999, wood: 0, stone: 0 }, NOW, noOcc);
    expect(totalRemaining(next, 'berry')).toBe(0); // 只采得完总量
    expect(totalRemaining(next, 'wood')).toBe(NODE_CONFIG.wood.max * NODE_COUNTS.wood); // 其他类型不动
  });

  it('离线毛产小于总量时按量扣减、逐点先扣剩余多的', () => {
    const n = createNodes();
    const mine = nodesByTask(n, 'berry');
    // 点 A 满 20，点 B 满 20 → 离线采 25 → A 扣到 0（登记刷新），B 扣 5
    const mod = n.map((x) => (x.id === mine[0].id ? { ...x, remaining: 20 } : x.id === mine[1].id ? { ...x, remaining: 20 } : x));
    const next = applyOfflineToNodes(mod, { berry: 25, wood: 0, stone: 0 }, NOW, noOcc);
    const after = nodesByTask(next, 'berry');
    const a = after.find((x) => x.id === mine[0].id)!;
    const b = after.find((x) => x.id === mine[1].id)!;
    expect(a.remaining + b.remaining).toBe(15);
    expect(a.respawnAt).toBe(NOW + NODE_CONFIG.berry.cycleMs); // 采空登记
  });

  it('离线时长计入刷新：采空点离线后回满', () => {
    const n = createNodes().map((x) => ({ ...x, remaining: 0, respawnAt: NOW + 100 }));
    const next = applyOfflineToNodes(n, { berry: 0, wood: 0, stone: 0 }, NOW + 1000, noOcc);
    expect(next.every((x) => x.remaining === x.max)).toBe(true);
  });

  it('离线扣减不会扣穿到负', () => {
    const n = createNodes().map((x) => ({ ...x, remaining: 1 }));
    const next = applyOfflineToNodes(n, { berry: 999, wood: 999, stone: 999 }, NOW, noOcc);
    expect(next.every((x) => x.remaining >= 0)).toBe(true);
  });
});
