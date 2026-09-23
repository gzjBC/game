// game/save.ts —— localStorage 存档 v2（M1 多资源/多小人，ADR 006/016）
// schema 预留 meta 层空字段，为 500h 纵深（转生/图鉴/成就/挑战）留路。
// 版本迁移：v1（PoC）→ v2 自动升级，不丢进度。

import { createNodes, TASKS, type ResourceNode, type ResourceNodes } from './nodes';
import { HUT_MAX, SHED_MAX } from './layout';
import { validateSaveInput } from './saveValidation';

export type GatheringTask = 'berry' | 'wood' | 'stone';
export type Age = 'stone' | 'village';

export interface WorkerData {
  id: number;
  name: string;   // 英文名（内部 ID 展示）
  zhName: string; // 中文音译（ADR 007）
  task: GatheringTask | null;
}

export interface Resources {
  berries: number;
  wood: number;
  stone: number;
}

export interface SaveData {
  version: 2;
  seed: number;            // 世界种子（可复现寻路/掉落）
  age: Age;                    // 时代（stone 原始 → village 村庄，火耕科技解锁）
  resources: Resources;
  storage: Resources;        // 各资源存储上限（默认 100，仓库 +50/座，M2）
  resourceNodes: ResourceNodes; // 资源点储量/刷新（M2，docs/05）
  workers: WorkerData[];   // 已招募小人（任务固定，小人"不死只罢工"ADR 008）
  baseCapacity: number;    // 基础人口上限（M1 = 5）
  fireLit: boolean;
  buildings: { huts: number; sheds: number }; // 茅草房(+1人口) / 仓库(+50存储)
  tech: { pottery: boolean; fireFarming: boolean }; // 制陶 / 火耕（解锁村庄）
  lastSavedAt: number;     // 毫秒时间戳（离线结算依据）
  meta: {
    prestigeCount: number;
    globalMult: number;
    lifetimeStats: Record<string, number>;
    seedHistory: number[];
    codex: Record<string, unknown>;
    achievements: string[];
    dailyHistory: Record<string, unknown>;
  };
}

const STORAGE_KEY_V2 = 'high-save-v2';
const STORAGE_KEY_V1 = 'high-save-v1';
export const BASE_CAPACITY = 5;

export function createDefaultSave(): SaveData {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return {
    version: 2,
    seed,
    age: 'stone',
    resources: { berries: 0, wood: 0, stone: 0 },
    storage: { berries: 100, wood: 100, stone: 100 },
    resourceNodes: createNodes(),
    workers: [{ id: 1, name: 'Kelvin', zhName: '凯尔文', task: 'berry' }],
    baseCapacity: BASE_CAPACITY,
    fireLit: false,
    buildings: { huts: 0, sheds: 0 },
    tech: { pottery: false, fireFarming: false },
    lastSavedAt: Date.now(),
    meta: {
      prestigeCount: 0,
      globalMult: 1,
      lifetimeStats: {},
      seedHistory: [seed],
      codex: {},
      achievements: [],
      dailyHistory: {},
    },
  };
}

/** 资源点迁移（ADR 033 多点化）：统一输出 ResourceNode[]。
 * - 新格式（数组）直接迁移，逐点补缺省/防御；
 * - 旧格式（v2 单点对象 { berry:{...}, wood:{...}, stone:{...} }）→ 拆成单点数组。
 * 防御：非法 respawnAt（>now+5min，如调试注入/旧 bug）归 0 并回满，避免永久消失。 */
function migrateNodes(given: unknown, now: number = Date.now()): ResourceNodes {
  const def = createNodes(); // 10 点默认（4 浆果 + 3 木 + 3 石）
  const guard = (n: Partial<ResourceNode> | undefined, fallback: ResourceNode): ResourceNode => {
    const max = Math.max(1, Number(n?.max) || fallback.max);
    const rawRemaining = Number(n?.remaining);
    let remaining = Number.isFinite(rawRemaining) ? rawRemaining : fallback.remaining;
    remaining = Math.min(Math.max(remaining, 0), max);
    let respawnAt = Number(n?.respawnAt) || 0;
    if (respawnAt > now + 5 * 60_000) {
      respawnAt = 0; // 异常：立即回满（玩家立刻有资源，不依赖 tick）
      remaining = max;
    }
    return {
      ...fallback,
      ...(n ?? {}),
      max,
      remaining,
      respawnAt,
      pos: n?.pos && typeof n.pos.x === 'number' ? n.pos : { ...fallback.pos },
    };
  };
  if (Array.isArray(given)) {
    // 新格式：逐点迁移（id/task 缺失用序号+类型推断补齐）
    const out: ResourceNodes = [];
    given.forEach((raw, i) => {
      const n = (raw ?? {}) as Partial<ResourceNode>;
      const t = TASKS.includes(n.task as GatheringTask) ? (n.task as GatheringTask) : 'berry';
      const fallback = def.find((d) => d.task === t) ?? { ...def[0] };
      const node = guard(n, fallback);
      out.push({ ...node, id: n.id || `${t}-${i}`, task: t });
    });
    return out.length > 0 ? out : def;
  }
  // 旧格式：单点对象 → 数组（每类 1 个，补默认位）
  const g = (given ?? {}) as Partial<Record<GatheringTask, Partial<ResourceNode>>>;
  const out: ResourceNodes = [];
  for (const t of TASKS) {
    const raw = g[t];
    if (!raw) continue;
    const fallback = def.find((d) => d.task === t) ?? def[0];
    out.push({ ...guard(raw, fallback), id: `${t}-0`, task: t });
  }
  return out.length > 0 ? out : def;
}

/** 存储上限迁移：已有 storage 字段完整保留（仓库容量不丢）；旧档无 storage → 默认 100 且不低于存量 */
function migrateStorage(res: Partial<Resources> | undefined, given: object | undefined): Resources {
  const g = (given ?? {}) as Partial<Resources>;
  const hasField = g.berries !== undefined || g.wood !== undefined || g.stone !== undefined;
  if (hasField) {
    return {
      berries: typeof g.berries === 'number' ? g.berries : 100,
      wood: typeof g.wood === 'number' ? g.wood : 100,
      stone: typeof g.stone === 'number' ? g.stone : 100,
    };
  }
  return {
    berries: Math.max(100, res?.berries ?? 0),
    wood: Math.max(100, res?.wood ?? 0),
    stone: Math.max(100, res?.stone ?? 0),
  };
}

/** 迁移任意历史存档到 v2（缺失字段用默认值补齐） */
export function migrateSave(raw: unknown): SaveData {
  const def = createDefaultSave();
  const r = (raw ?? {}) as Record<string, unknown>;

  if ((r.version as number) === 2) {
    return {
      ...def,
      ...(r as object),
      resources: { ...def.resources, ...((r.resources as object) ?? {}) },
      storage: migrateStorage(r.resources as Partial<Resources> | undefined, r.storage as object | undefined),
      resourceNodes: migrateNodes(r.resourceNodes as object | undefined),
      workers: Array.isArray(r.workers) && (r.workers as unknown[]).length > 0
        ? (r.workers as WorkerData[])
        : def.workers,
      age: (r.age as Age) ?? 'stone',
      buildings: (() => {
        const b = ((r.buildings as object) ?? {}) as { huts?: number; sheds?: number };
        return { huts: Math.min(b.huts ?? 0, HUT_MAX), sheds: Math.min(b.sheds ?? 0, SHED_MAX) };
      })(),
      tech: { pottery: false, fireFarming: false, ...((r.tech as object) ?? {}) },
      meta: { ...def.meta, ...((r.meta as object) ?? {}) },
    } as SaveData;
  }

  // v1（PoC）：berries / berryGatherers / fireLit → v2
  const v1 = r as { berries?: number; berryGatherers?: number; fireLit?: boolean; seed?: number };
  const seed = typeof v1.seed === 'number' ? v1.seed : def.seed;
  const n = Math.max(1, Math.floor(v1.berryGatherers ?? 1));
  const workers: WorkerData[] = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: def.workers[0].name,
    zhName: def.workers[0].zhName,
    task: i === 0 ? 'berry' : null,
  }));
  return {
    ...def,
    version: 2,
    seed,
    resources: { berries: v1.berries ?? 0, wood: 0, stone: 0 },
    storage: { berries: Math.max(100, v1.berries ?? 0), wood: 100, stone: 100 },
    resourceNodes: createNodes(),
    workers,
    fireLit: v1.fireLit ?? false,
    lastSavedAt: typeof r.lastSavedAt === 'number' ? r.lastSavedAt : def.lastSavedAt,
  };
}

export type SaveResult = { ok: true; savedAt: number } | { ok: false; error: string };

export function saveGame(s: SaveData, beforeReplace?: SaveData, preserveRaw = false): SaveResult {
  const savedAt = Date.now();
  try {
    const json = JSON.stringify({ ...s, lastSavedAt: savedAt });
    const prev = localStorage.getItem(STORAGE_KEY_V2);
    const legacy = prev ? null : localStorage.getItem(STORAGE_KEY_V1);
    // Stable replacement backup is not rotated by autosave. A failed backup aborts replacement.
    if (preserveRaw && (prev || legacy)) localStorage.setItem(STORAGE_KEY_V2 + '.before-replace', (prev || legacy)!);
    else if (beforeReplace) localStorage.setItem(STORAGE_KEY_V2 + '.before-replace', serializeSave(beforeReplace));
    if (!preserveRaw && (prev || legacy)) localStorage.setItem(STORAGE_KEY_V2 + '.bak', (prev || legacy)!);
    localStorage.setItem(STORAGE_KEY_V2, json);
    return { ok: true, savedAt };
  } catch {
    return { ok: false, error: '保存失败：浏览器存储不可用或空间不足。当前进度仍在内存中，请导出备份。' };
  }
}

export function loadGameResult(): { save: SaveData; error: string | null } {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) return { save: parseImportedSave(rawV2), error: null };
    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) return { save: parseImportedSave(rawV1), error: null };
    return { save: createDefaultSave(), error: null };
  } catch {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_V2) ?? localStorage.getItem(STORAGE_KEY_V1);
      // Keep the first damaged snapshot; also leave the primary data untouched.
      if (raw && !localStorage.getItem(STORAGE_KEY_V2 + '.corrupt')) localStorage.setItem(STORAGE_KEY_V2 + '.corrupt', raw);
    } catch { /* Primary data remains intact even if the backup cannot be written. */ }
    return { save: createDefaultSave(), error: '无法读取存档，原数据未覆盖，自动保存已暂停。可导出原档、恢复备份、导入文件或确认重开。' };
  }
}

export function loadGame(): SaveData { return loadGameResult().save; }

export function readSaveBackup(kind: 'original' | 'backup' | 'before-replace'): string {
  const raw = kind === 'original'
    ? localStorage.getItem(STORAGE_KEY_V2) ?? localStorage.getItem(STORAGE_KEY_V1)
    : localStorage.getItem(`${STORAGE_KEY_V2}.${kind === 'backup' ? 'bak' : kind}`);
  if (!raw) throw new Error('没有找到该存档备份');
  return raw;
}

export function clearGame(): void {
  localStorage.removeItem(STORAGE_KEY_V2);
  localStorage.removeItem(STORAGE_KEY_V1);
}

/** 导出为可读 JSON；不修改内存中的存档对象。 */
export function serializeSave(s: SaveData): string {
  return JSON.stringify({ ...s, lastSavedAt: Date.now() }, null, 2);
}

/** 严格解析玩家导入的存档。未知格式直接拒绝，避免被静默迁移成新档。 */
export function parseImportedSave(text: string): SaveData {
  if (text.length > 2_000_000) throw new Error('存档文件过大（上限 2 MB）');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON 存档');
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('存档顶层格式不正确');
  }

  validateSaveInput(raw);
  return migrateSave(raw);
}
