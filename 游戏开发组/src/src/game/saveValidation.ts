// Validate supplied fields before migration. Missing historical fields may use defaults.
type Obj = Record<string, unknown>;
function object(value: unknown, label: string): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式不正确`);
  return value as Obj;
}
function number(value: unknown, label: string, integer = false, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${label}必须是有效的非负${integer ? '整数' : '数字'}`);
  }
}
function text(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new Error(`${label}格式不正确`);
}
function numericFields(value: unknown, keys: string[], label: string, integer = false) {
  const obj = object(value, label);
  for (const key of keys) if (key in obj) number(obj[key], `${label}.${key}`, integer);
}
export function validateSaveInput(value: unknown): void {
  const r = object(value, '存档');
  if (r.version !== 1 && r.version !== 2) throw new Error('不支持的存档版本');
  if ('seed' in r) number(r.seed, '世界种子', true, 0xffffffff);
  if ('lastSavedAt' in r) number(r.lastSavedAt, '保存时间');
  if ('fireLit' in r && typeof r.fireLit !== 'boolean') throw new Error('篝火状态格式不正确');
  if (r.version === 1) {
    number(r.berries, '浆果');
    if ('berryGatherers' in r) number(r.berryGatherers, '工人数', true, 256);
    return;
  }
  numericFields(r.resources, ['berries', 'wood', 'stone'], '资源');
  if (!['berries', 'wood', 'stone'].some(key => key in object(r.resources, '资源'))) throw new Error('缺少资源数据');
  if ('storage' in r) numericFields(r.storage, ['berries', 'wood', 'stone'], '容量');
  if ('baseCapacity' in r) number(r.baseCapacity, '人口容量', true, 256);
  if ('age' in r && r.age !== 'stone' && r.age !== 'village') throw new Error('时代不受支持');
  if ('buildings' in r) numericFields(r.buildings, ['huts', 'sheds'], '建筑', true);
  if ('tech' in r) {
    const tech = object(r.tech, '科技');
    for (const key of ['pottery', 'fireFarming']) if (key in tech && typeof tech[key] !== 'boolean') throw new Error('科技状态格式不正确');
  }
  if ('workers' in r) {
    if (!Array.isArray(r.workers) || r.workers.length > 256) throw new Error('工人列表格式不正确');
    const ids = new Set();
    for (const raw of r.workers) {
      const w = object(raw, '工人');
      number(w.id, '工人编号', true);
      if (w.id === 0 || ids.has(w.id)) throw new Error('工人编号必须为唯一正整数');
      ids.add(w.id);
      text(w.name, '工人姓名'); text(w.zhName, '工人中文姓名');
      if (w.task !== null && !['berry', 'wood', 'stone'].includes(w.task as string)) throw new Error('工人任务不受支持');
    }
  }
  if ('resourceNodes' in r) {
    const nodes = Array.isArray(r.resourceNodes) ? r.resourceNodes : Object.values(object(r.resourceNodes, '资源点'));
    if (nodes.length > 400) throw new Error('资源点数量过多');
    const ids = new Set();
    for (const raw of nodes) {
      const n = object(raw, '资源点');
      numericFields(n, ['remaining', 'max', 'respawnAt'], '资源点');
      if ('id' in n) { text(n.id, '资源点编号'); if (ids.has(n.id)) throw new Error('资源点编号重复'); ids.add(n.id); }
      if ('task' in n && !['berry', 'wood', 'stone'].includes(n.task as string)) throw new Error('资源点类型不受支持');
      if ('pos' in n) {
        const pos = object(n.pos, '资源点坐标');
        number(pos.x, '横坐标', true, 19); number(pos.y, '纵坐标', true, 19);
      }
    }
  }
  if ('meta' in r) {
    const meta = object(r.meta, '长期进度');
    if ('prestigeCount' in meta) number(meta.prestigeCount, '转生次数', true);
    if ('globalMult' in meta) number(meta.globalMult, '产出倍率');
    for (const key of ['lifetimeStats', 'codex', 'dailyHistory']) if (key in meta) object(meta[key], key);
    if ('seedHistory' in meta) {
      if (!Array.isArray(meta.seedHistory)) throw new Error('种子历史格式不正确');
      for (const seed of meta.seedHistory) number(seed, '历史种子', true, 0xffffffff);
    }
    if ('achievements' in meta && (!Array.isArray(meta.achievements) || meta.achievements.some(v => typeof v !== 'string'))) throw new Error('成就格式不正确');
  }
}
