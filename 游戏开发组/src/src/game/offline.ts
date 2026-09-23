// game/offline.ts —— 离线收益结算（ADR 009：与在线共用权威公式；ADR 023：离线速度 = 在线 1/5）
// v1 规则：离线 8h 上限；离线也吃饭（食物不足则挨饿，不会饿死 ADR 008）。

import type { SaveData } from './save';
import { computeOfflineGain, type ProductionRates } from './production';
import { foodConsumptionPerSec } from './food';
import { applyOfflineToNodes, totalRemaining, type ResourceNodes } from './nodes';
import { CAVE_TILES, hutTiles, shedTiles } from './layout';

export const OFFLINE_CAP_SECONDS = 8 * 3600; // 8 小时上限
export const OFFLINE_SPEED_MULT = 0.2; // ADR 023：离线速度 = 在线 × 1/5

export interface OfflineResult {
  offlineSeconds: number;
  /** 要加到存档上的变化量（浆果为净变化：毛产出 − 食物消耗） */
  gained: ProductionRates;
  /** 结算后的资源点状态（已按真实时间刷新 + 扣减采量） */
  nodes: ResourceNodes;
  report: string | null;
}

export function applyOfflineProgress(s: SaveData): OfflineResult {
  const offlineSeconds = Math.max(0, Math.floor((Date.now() - s.lastSavedAt) / 1000));
  const capped = Math.min(offlineSeconds, OFFLINE_CAP_SECONDS);

  if (capped <= 0) {
    return {
      offlineSeconds: 0,
      gained: { berries: 0, wood: 0, stone: 0 },
      nodes: s.resourceNodes,
      report: null,
    };
  }

  // 在线速率 × 秒 × 0.2 速度系数（木/石）
  const base = computeOfflineGain(s, capped);
  const now = Date.now();

  // 各类型离线"毛采量"受该类型总储量约束（ADR 033 多点：总量 = 各点剩余之和）
  const berryTaken = Math.min(base.berries * OFFLINE_SPEED_MULT, totalRemaining(s.resourceNodes, 'berry'));
  const woodTaken = Math.min(base.wood * OFFLINE_SPEED_MULT, totalRemaining(s.resourceNodes, 'wood'));
  const stoneTaken = Math.min(base.stone * OFFLINE_SPEED_MULT, totalRemaining(s.resourceNodes, 'stone'));

  // 浆果：毛采量 − 食物消耗（离线也吃饭，可为负：挨饿，不回正也不饿死）
  const foodNeed = foodConsumptionPerSec(s.workers.length) * capped;
  const berries = berryTaken - foodNeed;

  // 资源点离线刷新占用集（同 store tick：山洞 + 建筑 + 各点当前位置）
  const occ: { x: number; y: number }[] = [
    ...CAVE_TILES,
    ...hutTiles(s.buildings.huts),
    ...shedTiles(s.buildings.sheds),
  ];
  for (const n of s.resourceNodes) occ.push(n.pos);
  const nodes = applyOfflineToNodes(
    s.resourceNodes,
    { berry: berryTaken, wood: woodTaken, stone: stoneTaken },
    now,
    occ,
  );

  const parts = [
    berries !== 0 ? `${berries.toFixed(1)} 浆果` : '',
    woodTaken > 0 ? `${woodTaken.toFixed(1)} 木材` : '',
    stoneTaken > 0 ? `${stoneTaken.toFixed(1)} 石头` : '',
  ].filter(Boolean);

  const report = `离线 ${Math.floor(capped / 60)} 分 ${capped % 60} 秒，${parts.join('、')}`;
  return { offlineSeconds: capped, gained: { berries, wood: woodTaken, stone: stoneTaken }, nodes, report };
}
