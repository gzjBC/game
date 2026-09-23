import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSave, loadGameResult, migrateSave, parseImportedSave, readSaveBackup, saveGame, serializeSave } from '../save';
import { createStore } from '../store';

const KEY = 'high-save-v2';
let data: Map<string, string>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T05:00:00Z'));
  data = new Map();
  storage = { getItem: vi.fn((key: string) => data.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { data.set(key, value); }), removeItem: vi.fn((key: string) => { data.delete(key); }) };
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('导入与历史存档', () => {
  it('导出/导入保留村庄进度且不修改原对象时间', () => {
    const s = createDefaultSave(); s.age = 'village'; s.tech.fireFarming = true; s.lastSavedAt -= 300_000;
    s.resources = { berries: 50, wood: 60, stone: 70 };
    const timestamp = s.lastSavedAt;
    const parsed = parseImportedSave(serializeSave(s));
    expect(parsed.age).toBe('village'); expect(parsed.resources).toEqual(s.resources); expect(parsed.workers).toEqual(s.workers);
    expect(s.lastSavedAt).toBe(timestamp);
  });
  it('v1 和单资源点 v2 历史样本可迁移，旧超容量建筑按规则收敛', () => {
    const v1 = parseImportedSave(JSON.stringify({ version: 1, berries: 42, berryGatherers: 3, fireLit: true, lastSavedAt: 1000 }));
    expect(v1.resources.berries).toBe(42); expect(v1.workers).toHaveLength(3); expect(v1.lastSavedAt).toBe(1000);
    const v2 = parseImportedSave(JSON.stringify({ version: 2, resources: { berries: 150 }, buildings: { huts: 40 }, resourceNodes: { berry: { max: 20, respawnAt: 0 } } }));
    expect(v2.buildings.huts).toBe(8); expect(v2.storage.berries).toBe(150); expect(v2.resourceNodes[0].remaining).toBe(20);
  });
  it.each(['{', 'null', '[]', '{"version":3}', '{"version":"2","resources":{"berries":1}}', '{"version":2}', '{"version":2,"resources":{"berries":"5"}}', '{"version":2,"resources":{"berries":1e999}}'])('拒绝非法输入 %s 且不写存储', raw => {
    expect(() => parseImportedSave(raw)).toThrow(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each(['worker-id', 'coordinate', 'building', 'age'])('拒绝危险字段：%s', field => {
    const s = createDefaultSave();
    if (field === 'worker-id') s.workers.push({ ...s.workers[0] });
    if (field === 'coordinate') s.resourceNodes[0].pos.y = 100;
    if (field === 'building') s.buildings.huts = -1;
    if (field === 'age') Object.assign(s, { age: 'unknown' });
    expect(() => parseImportedSave(JSON.stringify(s))).toThrow();
  });
  it('迁移缺少剩余量/编号的多资源点时产出有限数字与唯一编号', () => {
    const s = migrateSave({ version: 2, resourceNodes: [{ task: 'berry' }, { task: 'berry' }] });
    expect(new Set(s.resourceNodes.map(n => n.id)).size).toBe(2);
    expect(s.resourceNodes.every(n => Number.isFinite(n.remaining))).toBe(true);
  });
});

describe('保存、替换与坏档保护', () => {
  it('坏档保留主档并备份到 corrupt；自动保存不能覆盖', () => {
    data.set(KEY, '{broken');
    const store = createStore(); store.getState().init(); store.getState().persist();
    expect(store.getState().saveBlocked).toBe(true);
    expect(data.get(KEY)).toBe('{broken'); expect(data.get(KEY + '.corrupt')).toBe('{broken');
  });
  it('备份存储失败时仍保留原主档', () => {
    data.set(KEY, '{broken'); storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    expect(loadGameResult().error).toBeTruthy(); expect(data.get(KEY)).toBe('{broken');
  });
  it('普通保存不修改入参时间，并保留上一份主档', () => {
    const s = createDefaultSave(); s.lastSavedAt = 1000; data.set(KEY, JSON.stringify(s));
    const previous = data.get(KEY);
    expect(saveGame(s).ok).toBe(true); expect(s.lastSavedAt).toBe(1000); expect(data.get(KEY + '.bak')).toBe(previous);
  });
  it('保存失败不更新成功时间', () => {
    const store = createStore(); const before = store.getState().lastSavedDisplay;
    vi.advanceTimersByTime(10_000);
    storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    expect(store.getState().persist()).toBe(false);
    expect(store.getState().lastSavedDisplay).toBe(before); expect(store.getState().saveError).toContain('保存失败');
  });
  it('替换备份记录当前内存进度，后续自动保存不会覆盖这份备份', () => {
    const store = createStore(); store.getState().addResource('wood', 33);
    const next = createDefaultSave(); next.buildings.huts = 2;
    expect(store.getState().replaceSave(next)).toBe(true);
    const backup = readSaveBackup('before-replace'); expect(JSON.parse(backup).resources.wood).toBe(33);
    store.getState().persist(); expect(readSaveBackup('before-replace')).toBe(backup);
    expect(store.getState().worldRevision).toBe(1);
  });
  it.each(['backup', 'main'])('替换写入 %s 失败时内存、主档和世界版本不变', stage => {
    const store = createStore(); store.getState().persist(); const before = store.getState().save; const raw = data.get(KEY);
    storage.setItem.mockImplementation((key, value) => {
      if (key === (stage === 'main' ? KEY : KEY + '.before-replace')) throw new Error('quota');
      data.set(key, value);
    });
    expect(store.getState().replaceSave(createDefaultSave())).toBe(false);
    expect(store.getState().save).toBe(before); expect(data.get(KEY)).toBe(raw); expect(store.getState().worldRevision).toBe(0);
  });
  it('从坏档确认重开也保留原始字节和已有自动备份', () => {
    data.set(KEY, '{broken'); data.set(KEY + '.bak', JSON.stringify(createDefaultSave()));
    const previousBackup = data.get(KEY + '.bak'); const store = createStore();
    expect(store.getState().reset()).toBe(true); expect(readSaveBackup('before-replace')).toBe('{broken');
    expect(data.get(KEY + '.bak')).toBe(previousBackup); expect(store.getState().saveBlocked).toBe(false);
  });
});

describe('离线结算只执行一次', () => {
  it('关闭摘要再初始化不会重复结算，刷新后不再结算同一时间段', () => {
    const s = createDefaultSave(); s.resources.berries = 20; s.lastSavedAt -= 300_000; data.set(KEY, JSON.stringify(s));
    const store = createStore(); store.getState().init(); expect(store.getState().save.resources.berries).toBeCloseTo(21);
    const settled = store.getState().save; store.getState().dismissOffline(); store.getState().init();
    expect(store.getState().save).toBe(settled); expect(store.getState().offlineReport).toBeNull();
    const reloaded = createStore(); reloaded.getState().init(); expect(reloaded.getState().save.resources.berries).toBeCloseTo(21);
  });
  it('没有离线摘要的启动也不能再次加载并覆盖在线进度', () => {
    const store = createStore(); store.getState().init(); store.getState().addResource('wood', 8);
    store.getState().init(); expect(store.getState().save.resources.wood).toBe(8);
  });
  it('结算资源不超过容量、食物不会扣到负数', () => {
    const s = createDefaultSave(); s.workers[0].task = 'wood'; s.resources.wood = 99; s.lastSavedAt -= 8 * 3600_000;
    data.set(KEY, JSON.stringify(s)); const store = createStore(); store.getState().init();
    expect(store.getState().save.resources.wood).toBe(100); expect(store.getState().save.resources.berries).toBe(0);
  });
});
