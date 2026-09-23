// game/nodes.ts —— 资源点储量/采空/刷新纯逻辑（M2，docs/05；2026-09-19 多点化 ADR 033）
// 规则：每点有容量与剩余；采空（remaining=0）登记回满倒计时（绝对时间戳，跨会话）；
// 到点 remaining 回满 = max。离线结算也走同一套（respawnAt 按真实时间流逝）。
// 多点：每类资源 N 个点（NODE_COUNTS），工人就近采集，采空自动换同类型其他点。

import type { GatheringTask } from './save';
import { GATHERING_POINTS, GRID, type GridPoint } from './layout';

export interface ResourceNode {
  id: string; // 唯一 id：`${task}-${idx}`（跨会话稳定）
  task: GatheringTask;
  remaining: number; // 当前剩余量
  max: number; // 储量上限（= 回满值）
  respawnAt: number; // 采空后回满的绝对时间戳（ms）；0 = 无需刷新
  pos: GridPoint; // 当前位置（采空重生后换随机位，docs/05 v2）
}

/** 扁平数组：全部资源点（迁移后统一形态；旧单点对象在 save.ts migrate 时转换） */
export type ResourceNodes = ResourceNode[];

export const TASKS: GatheringTask[] = ['berry', 'wood', 'stone'];

export const NODE_CONFIG: Record<GatheringTask, { max: number; cycleMs: number }> = {
  berry: { max: 20, cycleMs: 120_000 }, // 浆果丛 20 / 120s
  wood: { max: 15, cycleMs: 180_000 }, // 树林 15 / 180s
  stone: { max: 10, cycleMs: 240_000 }, // 石堆 10 / 240s
};

/** 每类资源点数（2026-09-19 用户："三个太少了" → 浆果 4 / 木 3 / 石 3 = 10 点） */
export const NODE_COUNTS: Record<GatheringTask, number> = {
  berry: 4,
  wood: 3,
  stone: 3,
};

/** 全满初始节点（位置取 GATHERING_POINTS 数组，越界/重复自动后补） */
export function createNodes(): ResourceNodes {
  const out: ResourceNodes = [];
  for (const t of TASKS) {
    const spots = GATHERING_POINTS[t];
    for (let i = 0; i < NODE_COUNTS[t]; i++) {
      out.push({
        id: `${t}-${i}`,
        task: t,
        remaining: NODE_CONFIG[t].max,
        max: NODE_CONFIG[t].max,
        respawnAt: 0,
        pos: { ...(spots[i] ?? { x: 1 + i, y: GRID - 2 }) },
      });
    }
  }
  return out;
}

export function nodesByTask(nodes: ResourceNodes, task: GatheringTask): ResourceNode[] {
  return nodes.filter((n) => n.task === task);
}

export function findNode(nodes: ResourceNodes, id: string): ResourceNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function isDepleted(n: ResourceNode): boolean {
  return n.remaining <= 0;
}

export function totalRemaining(nodes: ResourceNodes, task: GatheringTask): number {
  return nodesByTask(nodes, task).reduce((s, n) => s + Math.max(0, n.remaining), 0);
}

/**
 * 采集 1 次：剩余 -1；减到 0 时登记回满倒计时（幂等，重复调用不再重置倒计时）。
 * @returns 扣减后的节点
 */
export function consumeNode(task: GatheringTask, n: ResourceNode, now: number): ResourceNode {
  if (n.remaining <= 0) {
    // 已被采空：确保有刷新登记（幂等；外部置 0 的场景也补登记）
    if (n.respawnAt > 0) return n;
    return { ...n, respawnAt: now + NODE_CONFIG[task].cycleMs };
  }
  const remaining = n.remaining - 1;
  if (remaining > 0) return { ...n, remaining };
  // 本次采空：登记刷新（保留已有 respawnAt 不重置）
  const respawnAt = n.respawnAt > 0 ? n.respawnAt : now + NODE_CONFIG[task].cycleMs;
  return { ...n, remaining: 0, respawnAt };
}

/** 随机重生位：避开 occupied（建筑/山洞/其他资源点/边界），最多尝试 50 次 */
export function rollNodePos(
  occupied: GridPoint[],
  rng: () => number = Math.random,
): GridPoint {
  const occ = new Set(occupied.map((p) => `${p.x},${p.y}`));
  for (let i = 0; i < 50; i++) {
    const x = 1 + Math.floor(rng() * (GRID - 2));
    const y = 1 + Math.floor(rng() * (GRID - 2));
    if (!occ.has(`${x},${y}`)) return { x, y };
  }
  return { x: 1, y: GRID - 2 }; // 兜底（地图几乎满时）
}

/**
 * 推进刷新：到点回满 + 随机换位（docs/05 v2：采空后重生到随机新位置）。
 * occupied 为本次刷新前已占格（建筑/山洞/其他节点旧位）；已 roll 的新位会继续避让。
 */
export function tickNodes(
  nodes: ResourceNodes,
  now: number,
  occupied: GridPoint[],
): ResourceNodes {
  const occ = [...occupied];
  let changed = false;
  const out: ResourceNodes = [];
  for (const n of nodes) {
    if (n.respawnAt > 0 && now >= n.respawnAt) {
      const pos = rollNodePos(occ);
      occ.push(pos); // 后续节点避开刚 roll 的位置
      out.push({ ...n, remaining: n.max, respawnAt: 0, pos });
      changed = true;
    } else {
      out.push(n);
    }
  }
  return changed ? out : nodes;
}

/** 某任务还有可采的点 */
export function taskAvailable(nodes: ResourceNodes, task: GatheringTask): boolean {
  return nodesByTask(nodes, task).some((n) => n.remaining > 0);
}

/** 任一任务还有可采的点 */
export function anyAvailable(nodes: ResourceNodes): boolean {
  return TASKS.some((t) => taskAvailable(nodes, t));
}

export interface NodeTarget {
  id: string; // 目标点 id（采集扣减用）
  x: number;
  y: number;
}

/**
 * 为工人选目标点：该任务中 remaining>0 的最近点；全部采空 → 最近残影点（走过去等刷新）。
 * @param from 当前格（距离基准）
 */
export function bestNodeFor(
  nodes: ResourceNodes,
  task: GatheringTask,
  from: GridPoint,
): NodeTarget {
  const mine = nodesByTask(nodes, task);
  if (mine.length === 0) return { id: `${task}-0`, x: GATHERING_POINTS[task][0].x, y: GATHERING_POINTS[task][0].y };
  const dist = (n: ResourceNode) => Math.abs(n.pos.x - from.x) + Math.abs(n.pos.y - from.y);
  const withStock = mine.filter((n) => n.remaining > 0);
  const pool = withStock.length > 0 ? withStock : mine; // 全空 → 最近残影（等待刷新）
  const best = pool.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  return { id: best.id, x: best.pos.x, y: best.pos.y };
}

/** 离线结算：先把到点刷新的补满，再按总量剩余截断产出并扣减（各点优先扣有剩余者） */
export function applyOfflineToNodes(
  nodes: ResourceNodes,
  gained: Record<GatheringTask, number>,
  now: number,
  occupied: GridPoint[],
): ResourceNodes {
  const refreshed = tickNodes(nodes, now, occupied);
  const out: ResourceNodes = [];
  for (const t of TASKS) {
    // 本类型离线毛采量：按该类型总剩余截断
    let taken = Math.max(0, gained[t]);
    const mine = refreshed.filter((n) => n.task === t);
    const total = mine.reduce((s, n) => s + Math.max(0, n.remaining), 0);
    taken = Math.min(taken, total);
    // 逐点扣减（先扣剩余多的），扣到 0 登记刷新
    for (const n of mine) {
      const take = Math.min(taken, Math.max(0, n.remaining));
      taken -= take;
      const remaining = Math.max(0, n.remaining - take);
      out.push(
        remaining > 0
          ? { ...n, remaining }
          : consumeNode(t, { ...n, remaining: 0 }, now),
      );
    }
  }
  return out;
}
