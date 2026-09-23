// scene/GameScene.ts —— Phaser 场景（M1：多采集点 + 多小人 + 茅草房）
// 三层架构铁律：scene 只依赖 game 层（store），不 import React。
// easystarjs 是 UMD 导出：构造函数在 exports.js 上，不在 default 上（ADR 021）。

import Phaser from 'phaser';
import EasyStarModule, { type EasyStar as EasyStarType } from 'easystarjs';
import { WorkerSprite, TILE, type Tile } from './WorkerSprite';
import { useStore } from '../game/store';
import { TASK_TO_RESOURCE } from '../game/production';
import { HUNGER_RATE, isStarving } from '../game/food';
import { CAVE_TILES, HOME, HUT_MAX, SHED_MAX, hutSlot, hutTiles, shedSlot, shedTiles } from '../game/layout';
import type { GatheringTask } from '../game/save';
import { bestNodeFor, type NodeTarget } from '../game/nodes';

const EasyStar = EasyStarModule.js;

export const GRID_W = 20;
export const GRID_H = 20;

export const CAVE: Tile = { x: 0, y: 0 }; // 山洞（左上）

// 采集点默认位/随机重生位在 game/layout.ts（scene 只读 store 的节点 pos）

const GATHERING_COLORS: Record<GatheringTask, number> = {
  berry: 0xcc2244,
  wood: 0x3a7a3a,
  stone: 0x999999,
};

const GATHERING_LABELS: Record<GatheringTask, string> = {
  berry: '浆果丛',
  wood: '树林',
  stone: '石堆',
};

export default class GameScene extends Phaser.Scene {
  private easyStar!: EasyStarType;
  private workers = new Map<number, WorkerSprite>();
  private huts: Phaser.GameObjects.Graphics[] = [];
  private sheds: Phaser.GameObjects.Rectangle[] = [];
  private fire!: Phaser.GameObjects.Rectangle;
  private labelTexts: Phaser.GameObjects.Text[] = [];
  private nodeCircles = new Map<string, Phaser.GameObjects.Arc>();
  private nodeLabels = new Map<string, Phaser.GameObjects.Text>();
  private walkable: number[][] = []; // 0 可行 / 1 障碍（建筑碰撞）

  constructor() {
    super('GameScene');
  }

  preload() {
    // 像素小人（图像组产出，ADR 003）：6 张 sheet，帧布局一致（4 方向 × 4 帧，32px）
    const dir = 'assets/sprites/';
    this.load.spritesheet('villager', `${dir}villager_high_walk.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });
    for (const state of ['idle', 'pathfinding', 'moving', 'harvesting', 'returning'] as const) {
      this.load.spritesheet(`villager_${state}`, `${dir}villager_high_${state}.png`, {
        frameWidth: 32,
        frameHeight: 32,
      });
    }
  }

  /** 碰撞网格：山洞 + 全部茅草房占格置 1（不可通行），同步给 easystar */
  private applyBlockedGrid() {
    this.walkable = Array.from({ length: GRID_H }, () => Array<number>(GRID_W).fill(0));
    for (const t of CAVE_TILES) this.walkable[t.y][t.x] = 1;
    const huts = Math.min(useStore.getState().save.buildings.huts, HUT_MAX);
    const sheds = Math.min(useStore.getState().save.buildings.sheds, SHED_MAX);
    for (const t of hutTiles(huts)) {
      this.walkable[t.y][t.x] = 1;
    }
    for (const t of shedTiles(sheds)) {
      this.walkable[t.y][t.x] = 1;
    }
    this.easyStar = new EasyStar();
    this.easyStar.setGrid(this.walkable);
    this.easyStar.setAcceptableTiles([0]);
    this.easyStar.enableDiagonals();
    // 迭代量调高：debug 倍速下多工人并发寻路不阻塞（5x 时计算吞吐）
    this.easyStar.setIterationsPerCalculation(1000);
  }

  /** 行走动画（4 方向，注册在默认纹理；状态纹理帧布局一致可直接换肤播放） */
  private registerWorkerAnims() {
    const defs = [
      ['walk-down', 0],
      ['walk-left', 4],
      ['walk-right', 8],
      ['walk-up', 12],
    ] as const;
    for (const [key, start] of defs) {
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('villager', { start, end: start + 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  create() {
    // HMR 单例诊断（2026-09-19）：场景侧 store 引用暴露
    (window as unknown as Record<string, unknown>).__highStoreScene = useStore;
    this.registerWorkerAnims();
    this.applyBlockedGrid();

    this.drawGrid();

    // 山洞（左上 2×2 格，深棕色）
    this.add
      .rectangle(CAVE.x * TILE + TILE, CAVE.y * TILE + TILE, TILE * 2, TILE * 2, 0x3a2a1a)
      .setStrokeStyle(2, 0x554433);
    this.labelTexts.push(
      this.add.text(CAVE.x * TILE + TILE, CAVE.y * TILE + TILE + 26, '山洞', {
        fontSize: '10px',
        color: '#bbaa88',
      }).setOrigin(0.5),
    );

    // 三个采集点（圆点 + 名字）
    for (const n of useStore.getState().save.resourceNodes) {
      const cx = n.pos.x * TILE + TILE / 2;
      const cy = n.pos.y * TILE + TILE / 2;
      const circle = this.add.circle(cx, cy, 9, GATHERING_COLORS[n.task]);
      this.nodeCircles.set(n.id, circle);
      const label = this.add.text(cx, cy + 16, GATHERING_LABELS[n.task], {
        fontSize: '10px',
        color: '#8a9a8a',
      }).setOrigin(0.5);
      this.nodeLabels.set(n.id, label);
      this.labelTexts.push(label);
    }

    // 篝火（生火后显示）
    this.fire = this.add
      .rectangle(CAVE.x * TILE + TILE * 2 + 12, CAVE.y * TILE + TILE / 2, 14, 14, 0xff8800)
      .setVisible(false);

    // debug 钩子（?debug=1）：读工人实时位置，供浏览器控制台/自动化验收
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as Record<string, unknown>).__highDebug = {
        scene: this,
        workers: () =>
          Array.from(this.workers.entries()).map(([id, w]) => ({
            id,
            task: w.task,
            phase: (w as unknown as { phase: string }).phase,
            tile: [Math.round(w.x / TILE), Math.round(w.y / TILE)],
            px: Math.round(w.x),
            py: Math.round(w.y),
          })),
      };
    }

    // 初始小人 + 读档恢复
    this.syncWorkers();
    this.syncHuts();
    this.syncSheds();
    if (useStore.getState().save.fireLit) this.fire.setVisible(true);
  }

  /** 画一座像素风茅草房（ADR 037：屋顶/墙/门/窗/烟囱，替换原双色块） */
  private drawHut(hx: number, hy: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    // 地面阴影
    g.fillStyle(0x000000, 0.12);
    g.fillRect(-10, 9, 20, 4);
    // 墙身（米色土墙）
    g.fillStyle(0xc8a86a);
    g.fillRect(-10, -4, 20, 14);
    // 木纹竖线
    g.fillStyle(0x8a6a3a);
    for (let i = 0; i < 4; i++) g.fillRect(-8 + i * 5, -4, 1, 14);
    // 门（深棕）
    g.fillStyle(0x5a3a1a);
    g.fillRect(-3, 2, 6, 8);
    g.fillStyle(0x3a2210);
    g.fillRect(-3, 2, 6, 1);
    // 窗（暖黄 + 框）
    g.fillStyle(0xffd76a);
    g.fillRect(2, -1, 4, 4);
    g.fillStyle(0x5a3a1a);
    g.fillRect(2, -1, 4, 1);
    g.fillRect(5, -1, 1, 4);
    // 茅草屋顶（梯形 + 高光）
    g.fillStyle(0x8a7a3a);
    g.fillTriangle(-12, -4, 12, -4, 0, -15);
    g.fillStyle(0xa89a4a);
    g.fillTriangle(-9, -4, 9, -4, 0, -12);
    // 屋脊
    g.fillStyle(0x6a5a2a);
    g.fillRect(-1, -16, 2, 2);
    // 烟囱
    g.fillStyle(0x8a6a4a);
    g.fillRect(5, -12, 3, 5);
    g.setPosition(hx, hy);
    return g;
  }

  update(_t: number, delta: number) {
    // 持续推进寻路计算直到回调触发（easystarjs 异步）
    this.easyStar.calculate();

    const st = useStore.getState();
    const starving = isStarving(st.save);
    const gdt = delta * st.multiplier; // debug 倍速（ADR 011，游戏内时间加速）

    // 食物消耗（倍速驱动；只有有食物才扣，不会扣穿到负）
    st.tick(gdt);

    for (const w of this.workers.values()) w.setStarving(starving);
    for (const w of this.workers.values()) w.update(gdt);

    // 轮询同步（挂机场景开销可忽略）：新招募的小人 / 新茅草房 / 篝火
    this.syncWorkers();
    if (this.syncHuts() || this.syncSheds()) this.onBuildingsChanged();
    if (!this.fire.visible && st.save.fireLit) this.fire.setVisible(true);
    this.syncNodes();
  }

  /** 寻路接口（供 WorkerSprite 调用），返回 Promise<Tile[]> */
  pathfind(from: Tile, to: Tile): Promise<Tile[]> {
    return new Promise((resolve) => {
      this.easyStar.findPath(from.x, from.y, to.x, to.y, (path) => {
        resolve(path ?? []);
      });
    });
  }

  private drawGrid() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x2a3a2a, 1);
    for (let i = 0; i <= GRID_W; i++) g.lineBetween(i * TILE, 0, i * TILE, GRID_H * TILE);
    for (let j = 0; j <= GRID_H; j++) g.lineBetween(0, j * TILE, GRID_W * TILE, j * TILE);
  }

  /** 资源点目标格：读存档节点当前位置（采空重生后自动跟随新位置） */
  /** 工人目标点：该任务最近可采点；全空 → 最近残影点（过去等刷新）。携带 node id 供采集扣减 */
  private nodeTarget(task: GatheringTask, from: Tile = HOME): NodeTarget {
    const nodes = useStore.getState().save.resourceNodes;
    return bestNodeFor(nodes, task, from);
  }

  /** 资源点视觉（docs/05 v2 + 09-19 可发现性）：采空 → 残影+琥珀色倒计时（"🕐 39s"）；
   * 玩家随时知道资源点位置与恢复时间；刷新 → 正常图标 + 名字（在随机新位置出现） */
  private syncNodes() {
    const nodes = useStore.getState().save.resourceNodes;
    const now = Date.now();
    for (const n of nodes) {
      const circle = this.nodeCircles.get(n.id);
      const label = this.nodeLabels.get(n.id);
      if (!circle) continue;
      const depleted = n.remaining <= 0;
      const cx = n.pos.x * TILE + TILE / 2;
      const cy = n.pos.y * TILE + TILE / 2;
      if (depleted) {
        const secs = Math.max(0, Math.ceil((n.respawnAt - now) / 1000));
        circle.setVisible(true).setAlpha(0.25).setFillStyle(GATHERING_COLORS[n.task]).setRadius(9);
        circle.setPosition(cx, cy);
        label?.setVisible(true);
        label?.setPosition(cx, cy + 16);
        label?.setText(`🕐 ${secs}s`).setColor('#c8a06a');
      } else {
        circle.setVisible(true).setAlpha(1);
        circle.setPosition(cx, cy);
        label?.setVisible(true);
        label?.setPosition(cx, cy + 16);
        label?.setText(GATHERING_LABELS[n.task]).setColor('#8a9a8a');
      }
    }
  }

  /** 让 store 里的小人都有对应精灵（新招募的自动补上） */
  private syncWorkers() {
    const workers = useStore.getState().save.workers;
    for (const wd of workers) {
      if (!this.workers.has(wd.id)) this.spawnWorker(wd);
    }
  }

  private spawnWorker(wd: { id: number; task: GatheringTask | null }) {
    try {
      const task = wd.task ?? this.pickLeastOccupiedTask() ?? 'berry';
      // 分配结果写回 store（否则 UI 任务/产出速率不含新工人）
      if (task !== wd.task) useStore.getState().assignTask(wd.id, task);
      const target = this.nodeTarget(task);
      const sprite = new WorkerSprite(this, wd.id, task, target, (nodeId) => {
        const st = useStore.getState();
        // 资源点（ADR 033 多点）：按 nodeId 扣减指定点，采空则本次不产（自动换点）
        const node = st.consumeNode(nodeId);
        if (!node) return;
        // 饥饿（ADR 036）：不再全吞，产出减半入库 → 食物缓慢恢复 → 解除饥饿
        const qty = isStarving(st.save) ? HUNGER_RATE : 1;
        st.addResource(TASK_TO_RESOURCE[node.task], qty);
      });
      this.workers.set(wd.id, sprite);
    } catch (e) {
      // 防静默失败（2026-09-19 招募不 spawn bug 诊断）：暴露到 console + debug 钩子
      console.error('[scene] spawnWorker 失败 id=' + wd.id, e);
      (window as unknown as Record<string, unknown>).__highSpawnError = String(e);
    }
  }

  /** 均衡分配：从"还有货"的采集点里选当前干活人数最少的；全空返回 null */
  private pickLeastOccupiedTask(): GatheringTask | null {
    const counts: Record<GatheringTask, number> = { berry: 0, wood: 0, stone: 0 };
    for (const w of this.workers.values()) {
      if (w.task) counts[w.task]++;
    }
    const nodes = useStore.getState().save.resourceNodes;
    const avail = (Object.keys(counts) as GatheringTask[]).filter((t) =>
      nodes.some((n) => n.task === t && n.remaining > 0),
    );
    if (avail.length === 0) return null;
    return avail.sort((a, b) => counts[a] - counts[b])[0];
  }

  /**
   * 出发前给工人定任务（M2，docs/05 §3）：当前点有货 → 维持；采空 → 换到有人数最少的有货点；
   * 全部采空 → null（工人回山洞"资源采空了"，2s 重查）。
   */
  ensureWorkerTask(id: number, current: GatheringTask): GatheringTask | null {
    const nodes = useStore.getState().save.resourceNodes;
    if (nodes.some((n) => n.task === current && n.remaining > 0)) return current;
    const alt = this.pickLeastOccupiedTask();
    if (alt) {
      const st = useStore.getState();
      st.assignTask(id, alt);
      const from = this.workers.get(id)?.gridPos() ?? HOME;
      this.workers.get(id)?.setTask(alt, this.nodeTarget(alt, from)); // 同步 sprite 任务（换最近目标点）
    }
    return alt;
  }

  /** 茅草房渲染：山洞右侧整数格横向排开（占格碰撞，中间留 1 格通道）。返回是否有变化 */
  private syncHuts(): boolean {
    const huts = Math.min(useStore.getState().save.buildings.huts, HUT_MAX);
    let changed = false;
    while (this.huts.length < huts) {
      changed = true;
      const slot = hutSlot(this.huts.length);
      const hx = slot.x * TILE + TILE / 2;
      const hy = slot.y * TILE + TILE / 2;
      this.huts.push(this.drawHut(hx, hy));
      this.labelTexts.push(
        this.add.text(hx, hy + 16, '茅草房', { fontSize: '9px', color: '#a89a6a' }).setOrigin(0.5),
      );
    }
    while (this.huts.length > huts) {
      changed = true;
      const h = this.huts.pop();
      if (h) h.destroy();
    }
    return changed;
  }

  /** 仓库渲染：茅草房正下方一行横向排开（占格碰撞） */
  private syncSheds(): boolean {
    const sheds = useStore.getState().save.buildings.sheds;
    let changed = false;
    while (this.sheds.length < sheds) {
      changed = true;
      const slot = shedSlot(this.sheds.length);
      const hx = slot.x * TILE + TILE / 2;
      const hy = slot.y * TILE + TILE / 2;
      const box = this.add.rectangle(hx, hy, TILE - 4, TILE - 6, 0x6a4a2a).setStrokeStyle(1, 0x3a2a1a);
      const roof = this.add.rectangle(hx, hy - 8, TILE - 2, 5, 0x2a1a0a);
      this.sheds.push(box, roof);
      this.labelTexts.push(
        this.add.text(hx, hy + 16, '仓库', { fontSize: '9px', color: '#c9a877' }).setOrigin(0.5),
      );
    }
    while (this.sheds.length > sheds * 2) {
      changed = true;
      const s = this.sheds.pop();
      if (s) s.destroy();
    }
    return changed;
  }

  /** 新建筑出现后：刷新碰撞网格 + 让在途工人重新寻路（绕开新建筑） */
  private onBuildingsChanged() {
    this.applyBlockedGrid();
    for (const w of this.workers.values()) w.restart();
  }
}
