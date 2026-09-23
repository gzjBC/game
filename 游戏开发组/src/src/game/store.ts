// game/store.ts —— Zustand 全局状态（ADR 010：BigNumber 不直接进 store）
// 状态流：scene（Phaser）→ store.action → React 面板订阅渲染。
// M2：食物消耗 tick（scene 每帧调用）+ debug 倍速 multiplier（ADR 011，不存档）。

import { create } from 'zustand';
import { createDefaultSave, loadGameResult, parseImportedSave, saveGame, type SaveData, type GatheringTask } from './save';
import { applyOfflineProgress } from './offline';
import { computeResourceRates } from './production';
import { doRecruit, canRecruit, RECRUIT_COST, workerCapacity } from './recruit';
import { doBuildHut, canBuildHut, HUT_COST } from './buildings';
import { doResearchPottery, canResearchPottery, POTTERY_COST } from './tech';
import { doResearchFireFarming } from './tech';
import { doBuildShed } from './buildings';
import { addResource, type ResourceKey } from './resources';
import { consumeFood } from './food';
import { consumeNode, tickNodes, type ResourceNode } from './nodes';
import { CAVE_TILES, hutTiles, shedTiles } from './layout';
import { SeededRng } from './rng';
import { FIRE_COST } from './rules';
export { FIRE_COST } from './rules';

export type WorkerState = 'idle' | 'pathfinding' | 'moving' | 'harvesting' | 'returning';

export const DEBUG_MULTIPLIERS = [1, 2, 5, 10] as const; // ADR 011 debug 倍速档位

interface HighState {
  save: SaveData;
  workerStates: Record<number, WorkerState>;    // workerId → 状态（scene 写，UI 读）
  workerMessages: Record<number, string>;
  offlineReport: string | null;
  lastSavedDisplay: number;
  multiplier: number;                           // debug 倍速（ADR 011，仅内存不存档）
  initialized: boolean;
  saveBlocked: boolean;
  saveError: string | null;
  worldRevision: number;

  /** 启动：读档 + 离线结算（只做一次） */
  init: () => void;
  dismissOffline: () => void;
  /** 游戏 tick：食物消耗 + 资源点刷新（scene 每帧调用，倍速驱动） */
  tick: (deltaMs: number) => void;
  addResource: (key: ResourceKey, n: number) => void;
  /** 资源点采集 1 次：剩余 -1，采空登记刷新倒计时。返回是否采到 */
  consumeNode: (nodeId: string) => ResourceNode | null;
  setWorkerState: (id: number, s: WorkerState, msg: string) => void;
  assignTask: (id: number, task: GatheringTask) => void;
  setFireLit: () => void;
  recruit: () => void;
  buildHut: () => void;
  buildShed: () => void;
  researchPottery: () => void;
  researchFireFarming: () => void;
  setMultiplier: (m: number) => void;
  persist: () => boolean;
  replaceSave: (next: SaveData) => boolean;
  reset: () => boolean;
}

/** 全局单例（HMR 抗分裂，2026-09-19 招募不 spawn bug 根因）：
 * Vite HMR 重载本模块时复用已存在的实例，避免 App(UI) 与 Phaser 场景各持一个
 * store 副本导致状态不同步（新招募工人 UI 可见但场景不 spawn）。 */
const singletonKey = '__highStoreSingleton';
const g = globalThis as unknown as Record<string, unknown>;
const existing = g[singletonKey] as ReturnType<typeof createStore> | undefined;
export const useStore: ReturnType<typeof createStore> = existing ?? createStore();

export function createStore() {
  const loaded = loadGameResult();
  return create<HighState>((set, get) => ({
  save: loaded.save,
  workerStates: {},
  workerMessages: {},
  offlineReport: null,
  lastSavedDisplay: loaded.save.lastSavedAt,
  multiplier: 1,
  initialized: false,
  saveBlocked: loaded.error !== null,
  saveError: loaded.error,
  worldRevision: 0,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true });
    if (get().saveBlocked) return;
    const saved = get().save;
    const { gained, nodes, report } = applyOfflineProgress(saved);
    set({
      save: {
        ...saved,
        resources: {
          // 浆果为净变化，防御不扣穿到负（挨饿不死）
          berries: Math.max(0, Math.min(Math.max(saved.storage.berries, saved.resources.berries), saved.resources.berries + gained.berries)),
          wood: Math.min(Math.max(saved.storage.wood, saved.resources.wood), saved.resources.wood + gained.wood),
          stone: Math.min(Math.max(saved.storage.stone, saved.resources.stone), saved.resources.stone + gained.stone),
        },
        resourceNodes: nodes, // 离线结算后的节点（已刷新 + 扣减，docs/05 §6）
      },
      offlineReport: report,
    });
    get().persist(); // Advance the saved timestamp immediately after settlement.
  },

  dismissOffline: () => set({ offlineReport: null }),

  tick: (deltaMs) =>
    set((s) => {
      // 资源点刷新占用集：山洞 + 建筑 + 各资源点当前位置（重生换位时避开）
      const occ: { x: number; y: number }[] = [
        ...CAVE_TILES,
        ...hutTiles(s.save.buildings.huts),
        ...shedTiles(s.save.buildings.sheds),
      ];
      for (const n of s.save.resourceNodes) occ.push(n.pos);
      return {
        save: {
          ...s.save,
          resources: consumeFood(s.save.resources, s.save.workers.length, deltaMs),
          resourceNodes: tickNodes(s.save.resourceNodes, Date.now(), occ),
        },
      };
    }),

  addResource: (key, n) =>
    set((s) => ({
      save: {
        ...s.save,
        resources: addResource(s.save.resources, s.save.storage, key, n),
      },
    })),

  consumeNode: (nodeId) => {
    const nodes = get().save.resourceNodes;
    const idx = nodes.findIndex((n) => n.id === nodeId);
    if (idx < 0) return null;
    const node = nodes[idx];
    if (node.remaining <= 0) return null;
    const next = consumeNode(node.task, node, Date.now());
    const copy = [...nodes];
    copy[idx] = next;
    set((s) => ({ save: { ...s.save, resourceNodes: copy } }));
    return next;
  },

  setWorkerState: (id, s, msg) =>
    set((st) => ({
      workerStates: { ...st.workerStates, [id]: s },
      workerMessages: { ...st.workerMessages, [id]: msg },
    })),

  assignTask: (id, task) =>
    set((s) => ({
      save: {
        ...s.save,
        workers: s.save.workers.map((w) => (w.id === id ? { ...w, task } : w)),
      },
    })),

  setFireLit: () => {
    const { save } = get();
    if (save.fireLit || save.resources.berries < FIRE_COST) return;
    set({
      save: {
        ...save,
        resources: { ...save.resources, berries: save.resources.berries - FIRE_COST },
        fireLit: true,
      },
    });
  },

  recruit: () => {
    const { save } = get();
    if (!canRecruit(save)) return;
    // 名字用"世界种子 + 当前人数"派生，同一存档状态 → 同名，可复现
    const rng = new SeededRng((save.seed + save.workers.length * 7919) >>> 0);
    set({ save: doRecruit(save, rng) });
  },

  buildHut: () => {
    const { save } = get();
    if (!canBuildHut(save)) return;
    set({ save: doBuildHut(save) });
  },
  buildShed: () =>
    set((s) => ({ save: doBuildShed(s.save) })),

  researchPottery: () => {
    const { save } = get();
    if (!canResearchPottery(save)) return;
    set({ save: doResearchPottery(save) });
  },
  researchFireFarming: () =>
    set((s) => ({ save: doResearchFireFarming(s.save) })),

  setMultiplier: (m) => set({ multiplier: m }),

  persist: () => {
    if (get().saveBlocked) return false;
    const { save } = get();
    const result = saveGame(save);
    if (!result.ok) { set({ saveError: result.error }); return false; }
    set({ save: { ...save, lastSavedAt: result.savedAt }, lastSavedDisplay: result.savedAt, saveError: null });
    return true;
  },

  replaceSave: (next) => {
    let validated: SaveData;
    try { validated = parseImportedSave(JSON.stringify(next)); }
    catch (error) { set({ saveError: error instanceof Error ? error.message : '存档无效' }); return false; }
    const result = saveGame(validated, get().save, get().saveBlocked);
    if (!result.ok) { set({ saveError: result.error }); return false; }
    set({
      save: { ...validated, lastSavedAt: result.savedAt },
      offlineReport: null,
      workerStates: {},
      workerMessages: {},
      multiplier: 1,
      lastSavedDisplay: result.savedAt,
      initialized: true,
      saveBlocked: false,
      saveError: null,
      worldRevision: get().worldRevision + 1,
    });
    return true;
  },

  reset: () => {
    return get().replaceSave(createDefaultSave());
  },
}));
}
g[singletonKey] = useStore;

// 供 scene/UI 层读取的快捷函数
export function getRates() {
  return computeResourceRates(useStore.getState().save);
}
export function getWorkerCapacity() {
  return workerCapacity(useStore.getState().save);
}
export function getRecruitCost() {
  return RECRUIT_COST;
}
export function getHutCost() {
  return HUT_COST;
}
export function getPotteryCost() {
  return POTTERY_COST;
}
