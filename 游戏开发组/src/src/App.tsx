import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import './App.css';
import { usePhaser } from './hooks/usePhaser';
import { useStore, FIRE_COST, DEBUG_MULTIPLIERS } from './game/store';
import { computeResourceRates } from './game/production';
import { RESOURCE_LABELS, type ResourceKey } from './game/resources';
import { canRecruit, workerCapacity, RECRUIT_COST } from './game/recruit';
import { HUT_COST, SHED_COST, SHED_UNLOCK_HUTS, SHED_STORAGE_BONUS, canBuildHut, canBuildShed } from './game/buildings';
import { HUT_MAX, SHED_MAX } from './game/layout';
import { POTTERY_COST, FIRE_FARMING_COST, canResearchPottery, canResearchFireFarming } from './game/tech';
import { parseImportedSave, serializeSave, readSaveBackup, type SaveData } from './game/save';
import { foodConsumptionPerSec, isStarving } from './game/food';
import { nextGoal, resourceGap } from './game/guidance';
import { APP_VERSION } from './appVersion';

const KEYS: ResourceKey[] = ['berries', 'wood', 'stone'];
const TASK_LABELS = { berry: '采浆果', wood: '伐木', stone: '采石' };
const DEBUG = new URLSearchParams(window.location.search).has('debug');
if (DEBUG) (window as unknown as Record<string, unknown>).__highStore = useStore;

function World() {
  const ref = useRef<HTMLDivElement | null>(null);
  usePhaser(ref);
  return <div className="canvas-panel" ref={ref} aria-label="村庄地图" />;
}

function Action({ label, hint, disabled, onClick }: { label: string; hint: string; disabled: boolean; onClick: () => void }) {
  return <button className="btn action" disabled={disabled} onClick={onClick}><span>{label}</span><small>{hint}</small></button>;
}

function Confirmation({ children, onCancel, onConfirm }: { children: ReactNode; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={onCancel} aria-labelledby="confirmation-title">
    <h2 id="confirmation-title">确认替换当前进度</h2>
    {children}
    <p>替换前会保留一份备份，可从「替换前备份」导出。再次替换时会更新这份备份。</p>
    <div className="actions"><button className="btn ghost" autoFocus onClick={onCancel}>取消</button><button className="btn" onClick={onConfirm}>确认替换</button></div>
  </dialog>;
}

function download(contents: string, name: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const save = useStore(s => s.save);
  const initialized = useStore(s => s.initialized);
  const revision = useStore(s => s.worldRevision);
  const offline = useStore(s => s.offlineReport);
  const saveError = useStore(s => s.saveError);
  const blocked = useStore(s => s.saveBlocked);
  const lastSaved = useStore(s => s.lastSavedDisplay);
  const messages = useStore(s => s.workerMessages);
  const multiplier = useStore(s => s.multiplier);
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<SaveData | 'reset' | null>(null);
  useEffect(() => {
    useStore.getState().init();
    const persist = () => { useStore.getState().persist(); };
    const timer = window.setInterval(persist, 10_000);
    window.addEventListener('beforeunload', persist);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', persist); };
  }, []);

  const st = useStore.getState();
  const goal = nextGoal(save);
  const rates = computeResourceRates(save, isStarving(save));
  const gap = (cost: Partial<SaveData['resources']>) => resourceGap(save.resources, cost);
  function act(action: () => void, message: string) {
    const before = useStore.getState().save;
    action();
    if (useStore.getState().save !== before) { setNotice(message); useStore.getState().persist(); }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('存档文件过大（上限 2 MB）');
      setPending(parseImportedSave(await file.text()));
    } catch (error) { setNotice(error instanceof Error ? error.message : '读取文件失败'); }
  }
  function backup(kind: 'original' | 'backup' | 'before-replace', restore = false) {
    try {
      const raw = readSaveBackup(kind);
      if (restore) setPending(parseImportedSave(raw));
      else download(raw, `high-${kind}.json`);
    } catch (error) { setNotice(error instanceof Error ? error.message : '无法读取备份'); }
  }
  function confirm() {
    if (!pending) return;
    const ok = pending === 'reset' ? st.reset() : st.replaceSave(pending);
    setPending(null);
    setNotice(ok ? '进度已替换并保存。' : '替换失败，当前进度未改变。');
  }

  return <main className="app">
    <section className="world-section">
      <header className="world-heading"><h1>High <span className="tag">{save.age === 'village' ? '村庄' : '原始时代'}</span></h1><span className="version">v{APP_VERSION}</span></header>
      {initialized ? <World key={revision} /> : <p>正在读取营地…</p>}
      <p className="world-caption">小人自动采集 · 资源采空后会在新位置刷新</p>
      <section className="goal-card" aria-label="下一步目标"><small>营地手记 · {Math.min(goal.step, 6)} / 6</small><h2>{goal.title}</h2><p>{goal.detail}</p><progress max={6} value={goal.step - 1} aria-label="营地建设进度" /></section>
    </section>

    <aside className="side-panel">
      {saveError && <div className="hunger" role="alert">{saveError}{blocked && <div className="actions"><button className="btn ghost" onClick={() => backup('original')}>导出原档</button><button className="btn ghost" onClick={() => backup('backup', true)}>恢复自动备份</button></div>}</div>}
      {offline && <section className="offline" aria-label="离线收获"><p>⏳ {offline}</p><p>离线采集按标准在线速率的 20% 估算，最多 8 小时；仍扣除食物，并受资源点储量与仓库容量限制。</p><button className="btn ghost" onClick={st.dismissOffline}>知道了</button></section>}
      <h2>营地资源</h2>
      {isStarving(save) && <p className="hunger">食物不足，采集产出减半；浆果恢复后自动解除，小人不会饿死。</p>}
      <div className="resources">{KEYS.map(key => <div className="resource-card" key={key}>
        <span className="rc-label">{RESOURCE_LABELS[key]}</span><span className="rc-value">{save.resources[key].toFixed(1)}<em className="rc-cap">/{save.storage[key]}</em></span><span className="rc-rate" title="估算速率；实际产出受路程和资源点储量影响">约 +{rates[key].toFixed(2)}/秒</span>
      </div>)}</div>
      <p className="sub">食物消耗 {foodConsumptionPerSec(save.workers.length).toFixed(2)}/秒 · 人口 {save.workers.length}/{workerCapacity(save)}</p>
      <div className="notice" role="status" aria-live="polite">{notice}</div>
      <h2>建设与研究</h2>
      <div className="action-grid">
        <Action label={`🔥 生火 · ${FIRE_COST} 浆果`} hint={save.fireLit ? '篝火已点燃' : gap({ berries: FIRE_COST })} disabled={save.fireLit || save.resources.berries < FIRE_COST} onClick={() => act(st.setFireLit, '篝火点燃了。招募伙伴，一起建设营地。')} />
        <Action label={`👤 招募 · ${RECRUIT_COST} 浆果`} hint={save.workers.length >= workerCapacity(save) ? '人口已满，需要更多茅草房' : gap({ berries: RECRUIT_COST })} disabled={!canRecruit(save)} onClick={() => act(st.recruit, '新伙伴加入，已自动安排采集工作。')} />
        <Action label={`🛖 茅草房 · ${HUT_COST.wood}木 ${HUT_COST.stone}石`} hint={save.buildings.huts >= HUT_MAX ? `已达 ${HUT_MAX} 座上限` : `${save.buildings.huts}/${HUT_MAX} 座 · ${gap(HUT_COST)}`} disabled={!canBuildHut(save)} onClick={() => act(st.buildHut, '茅草房建好了，人口容量 +1。')} />
        <Action label={`🏺 制陶 · ${POTTERY_COST.berries}浆果 ${POTTERY_COST.wood}木`} hint={save.tech.pottery ? '已研究 · 浆果产出 +25%' : gap(POTTERY_COST)} disabled={!canResearchPottery(save)} onClick={() => act(st.researchPottery, '制陶研究完成。')} />
        <Action label={`🏚 仓库 · ${SHED_COST.wood}木 ${SHED_COST.stone}石`} hint={save.buildings.huts < SHED_UNLOCK_HUTS ? `需先建 ${SHED_UNLOCK_HUTS} 座茅草房（已有 ${save.buildings.huts}）` : save.buildings.sheds >= SHED_MAX ? `已达 ${SHED_MAX} 座上限` : `${save.buildings.sheds}/${SHED_MAX} 座 · ${gap(SHED_COST)}`} disabled={!canBuildShed(save)} onClick={() => act(st.buildShed, `仓库建好了，每种资源容量 +${SHED_STORAGE_BONUS}。`)} />
        <Action label={`🌾 火耕 · ${FIRE_FARMING_COST.berries}浆果 ${FIRE_FARMING_COST.stone}石`} hint={save.tech.fireFarming ? '已研究 · 村庄已解锁' : gap(FIRE_FARMING_COST)} disabled={!canResearchFireFarming(save)} onClick={() => act(st.researchFireFarming, '欢迎来到村庄时代！本版目标已达成。')} />
      </div>
      <details><summary>采集伙伴 · {save.workers.length} 人</summary><ul className="workers">{save.workers.map(w => <li className="worker-row" key={w.id}><span className="worker-name">{w.zhName}<em>{w.name}</em></span><span>{w.task ? TASK_LABELS[w.task] : '待命'}</span><span>{messages[w.id] ?? '准备出发'}</span></li>)}</ul></details>
      <details className="save-panel"><summary>存档与备份</summary><p className="sub">每 10 秒自动保存。导入后从存档进度继续，不额外补算离线收益。</p><div className="actions">
        <button className="btn ghost" disabled={blocked} onClick={() => setNotice(st.persist() ? '存档已保存。' : '保存失败，请导出备份。')}>保存</button>
        <button className="btn ghost" onClick={() => download(serializeSave(useStore.getState().save), 'high-save.json')}>导出存档</button>
        <button className="btn ghost" onClick={() => input.current?.click()}>导入存档</button>
        <button className="btn ghost" onClick={() => backup('before-replace')}>替换前备份</button>
        <button className="btn ghost" onClick={() => backup('backup', true)}>恢复自动备份</button>
        <button className="btn ghost danger" onClick={() => setPending('reset')}>重置营地</button>
      </div><input ref={input} type="file" accept=".json,application/json" hidden onChange={importFile} /></details>
      {DEBUG && <div className="debug-card"><p>测试倍速</p><div className="actions">{DEBUG_MULTIPLIERS.map(m => <button key={m} className={`btn ghost ${m === multiplier ? 'active' : ''}`} onClick={() => st.setMultiplier(m)}>{m}x</button>)}</div></div>}
      <footer className="foot">{blocked ? '自动保存已暂停' : `最后存档：${new Date(lastSaved).toLocaleTimeString()}`} · 种子 {save.seed}</footer>
    </aside>
    {pending && <Confirmation onCancel={() => setPending(null)} onConfirm={confirm}>{pending === 'reset' ? <p>将建立新营地，当前人口、资源与建筑会被替换。</p> : <p>导入{pending.age === 'village' ? '村庄' : '原始时代'}存档：{pending.workers.length} 人、{pending.buildings.huts} 座茅草房、{pending.buildings.sheds} 座仓库。</p>}</Confirmation>}
  </main>;
}
