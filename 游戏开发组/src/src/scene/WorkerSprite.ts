// scene/WorkerSprite.ts —— 小人精灵（M2：图像组 6 张像素 sheet，ADR 003 落地）
// 自包含循环：去采集点 → 采集 → 回休息点 → 休息 → 再出发（任务固定，小人"不死只罢工"ADR 008）
// 状态 → 纹理（idle/pathfinding/moving/harvesting/returning），移动按方向播 walk-{dir} 动画
// 锚点脚底中心（0.5, 1）：sprite.y = 格子底（格中心 + TILE/2），贴地行走

import Phaser from 'phaser';
import type { GatheringTask } from '../game/save';
import type { NodeTarget } from '../game/nodes';
import { useStore, type WorkerState } from '../game/store';
import type GameScene from './GameScene';
import { restSpotFor, type GridPoint } from '../game/layout';

export interface Tile {
  x: number;
  y: number;
}

export const TILE = 24;
export const WORKER_SCALE = 0.75; // 32px 帧缩放到 24px 格（保持像素锐利，Phaser nearest 采样）

export const TASK_LABELS: Record<GatheringTask, string> = {
  berry: '采浆果',
  wood: '伐木',
  stone: '采石',
};

const STATE_TEXTURES: Record<WorkerState, string> = {
  idle: 'villager_idle',
  pathfinding: 'villager_pathfinding',
  moving: 'villager_moving',
  harvesting: 'villager_harvesting',
  returning: 'villager_returning',
};

const STATE_MESSAGES: Record<WorkerState, string> = {
  idle: '休息中',
  pathfinding: '规划路线…',
  moving: '前往采集点',
  harvesting: '采集中！',
  returning: '带着收获返回',
};

const HARVEST_DURATION = 1200; // ms
const REST_DURATION = 400; // ms

type Phase = 'idle' | 'go' | 'harvest' | 'back';
type Dir = 'down' | 'left' | 'right' | 'up';

export class WorkerSprite extends Phaser.GameObjects.Sprite {
  workerId: number;
  task: GatheringTask | null;

  private rest: GridPoint; // 休息格（寻路目标）
  private restX = 0; // 站立脚底像素位置（格底 + 抖动）
  private restY = 0;
  private jx = 0; // 格内抖动（采集站位错开，ADR 026）
  private jy = 0;
  private target: NodeTarget; // 目标采集点（含 id 供扣减，ADR 033 多点）
  private path: Tile[] = [];
  private pathIndex = 0;
  private phase: Phase = 'idle';
  private harvestTimer = 0;
  private paused = false;
  private starving = false;
  private dir: Dir = 'down';
  private readonly onHarvest: (nodeId: string) => void;
  private readonly moveSpeed = 90; // px/s

  constructor(
    scene: GameScene,
    workerId: number,
    task: GatheringTask | null,
    target: NodeTarget,
    onHarvest: (nodeId: string) => void,
  ) {
    // ADR 026：专属休息点（5 格循环 + 格内抖动），多小人不再重叠
    const spot = restSpotFor(workerId);
    super(
      scene,
      spot.tile.x * TILE + TILE / 2 + spot.dx,
      spot.tile.y * TILE + TILE / 2 + spot.dy + TILE / 2, // 脚底对齐格底
      'villager',
      0,
    );
    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setScale(WORKER_SCALE);
    this.workerId = workerId;
    this.task = task;
    this.rest = spot.tile;
    this.restX = spot.tile.x * TILE + TILE / 2 + spot.dx;
    this.restY = spot.tile.y * TILE + TILE / 2 + spot.dy + TILE / 2;
    this.jx = spot.dx; // 采集站位抖动（同任务工人也错开）
    this.jy = spot.dy;
    this.target = target;
    this.onHarvest = onHarvest;
    this.setWorkerState('idle');
    if (task) this.scene.time.delayedCall(200, () => this.startCycle());
  }

  setWorkerState(s: WorkerState, msg?: string) {
    // 换纹理（6 张 sheet 帧布局一致，动画 key/帧序不变，规格文档 §5）
    this.setTexture(STATE_TEXTURES[s]);
    if (s === 'idle') {
      this.anims.stop();
      this.setFrame(0);
    }
    // 饥饿期间所有状态消息统一为"觅食"（防止被后续状态覆盖）
    const m = this.starving ? '食物不足，产出减半' : (msg ?? STATE_MESSAGES[s]);
    useStore.getState().setWorkerState(this.workerId, s, m);
  }

  /** 食物耗尽（ADR 008）：觅食中——照常跑循环但产出被 scene 吞掉（采了自吃） */
  setStarving(p: boolean) {
    if (this.starving === p) return;
    this.starving = p;
    if (p) {
      useStore.getState().setWorkerState(this.workerId, 'idle', '食物不足，产出减半');
    } else {
      this.refreshState();
    }
  }

  private refreshState() {
    const s: WorkerState =
      this.phase === 'harvest'
        ? 'harvesting'
        : this.phase === 'idle'
          ? 'idle'
          : 'moving';
    this.setWorkerState(s);
  }

  /** 开始一轮：先确认任务点还有货（docs/05 §3），再寻路到采集点 */
  startCycle() {
    if (!this.task || this.phase !== 'idle') return;
    const scene = this.scene as GameScene;
    const task = scene.ensureWorkerTask(this.workerId, this.task);
    if (!task) {
      // 全部资源点采空：回休息点等待，2s 重查（任一刷新自动恢复）
      this.setWorkerState('idle', '资源采空了');
      this.scene.time.delayedCall(2000, () => this.startCycle());
      return;
    }
    this.phase = 'go';
    this.paused = false;
    this.setWorkerState('pathfinding');
    this.pathTo(this.rest, this.target);
  }

  /** 换点（scene.ensureWorkerTask 调用）：更新任务与目标采集点 */
  setTask(task: GatheringTask, target: NodeTarget) {
    this.task = task;
    this.target = target;
  }

  /** 当前所在格（换点就近基准） */
  gridPos(): Tile {
    return { x: Math.floor(this.x / TILE), y: Math.floor(this.y / TILE) };
  }

  /** 沿寻路结果走一段（每帧调用） */
  update(delta: number) {
    if (this.phase === 'harvest') {
      this.harvestTimer -= delta;
      if (this.harvestTimer <= 0) this.finishHarvest();
      return;
    }
    if (this.paused || (this.phase !== 'go' && this.phase !== 'back')) return;

    const target = this.path[this.pathIndex];
    if (!target) return;

    const tx = target.x * TILE + TILE / 2;
    const ty = target.y * TILE + TILE / 2;
    const dx = tx - this.x;
    const dy = ty + TILE / 2 - this.y; // 目标脚底 = 格中心 + 半格
    const dist = Math.hypot(dx, dy);
    const step = (this.moveSpeed * delta) / 1000;

    // 播放行走动画（按主方向；换方向即换动画，纹理由 setWorkerState 决定）
    const dir: Dir =
      Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0
          ? 'right'
          : 'left'
        : dy >= 0
          ? 'down'
          : 'up';
    if (dir !== this.dir) {
      this.dir = dir;
      this.anims.play(`walk-${dir}`, true);
    } else if (!this.anims.isPlaying) {
      this.anims.play(`walk-${dir}`, true);
    }

    if (dist <= step) {
      this.setPosition(tx, ty + TILE / 2); // 脚底落到格底
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path = [];
        if (this.phase === 'go') {
          this.phase = 'harvest';
          this.harvestTimer = HARVEST_DURATION;
          this.setWorkerState('harvesting'); // 纹理切换；继续播 walk 动画模拟采集动作
          this.anims.play('walk-down', true);
          this.setPosition(tx + this.jx, ty + this.jy + TILE / 2); // 采集站位错开（防同点重叠）
        } else if (this.phase === 'back') {
          this.arriveHome();
        }
      }
    } else {
      this.setPosition(this.x + (dx / dist) * step, this.y + (dy / dist) * step);
    }
  }

  /** 重新开始一轮（建筑新增后调用：绕开新碰撞格） */
  restart() {
    this.phase = 'idle';
    this.path = [];
    this.pathIndex = 0;
    this.paused = false;
    this.harvestTimer = 0;
    this.startCycle();
  }

  private pathTo(from: Tile, to: Tile) {
    (this.scene as GameScene).pathfind(from, to).then((path) => {
      if (!path || path.length === 0) {
        this.paused = true;
        return;
      }
      this.path = path;
      this.pathIndex = 0;
      this.setWorkerState('moving');
    });
  }

  private finishHarvest() {
    if (!this.task) return;
    this.onHarvest(this.target.id);
    this.phase = 'back';
    this.setWorkerState('returning');
    this.pathTo(this.target, this.rest);
  }

  private arriveHome() {
    this.phase = 'idle';
    this.setPosition(this.restX, this.restY); // 回到带抖动的专属站立点
    this.setWorkerState('idle');
    this.scene.time.delayedCall(REST_DURATION, () => this.startCycle());
  }
}
