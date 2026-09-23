# High 游戏前端

《High》的浏览器客户端。React 负责数值与操作面板，Phaser 负责地图、小人、建筑和寻路，Zustand 作为共享状态层。

## 环境

- Node.js 20+
- npm 10+

## 命令

```bash
npm install
npm run dev
npm exec vitest run
npm run lint
npm run build
npm run preview
```

Debug 模式：打开 `http://localhost:5173/?debug=1`，可切换 1x / 2x / 5x / 10x 倍速。倍速不会写入存档。

## 目录

```text
src/
├── game/       纯游戏规则、存档、数值与单元测试
├── scene/      Phaser 场景与 WorkerSprite
├── hooks/      React 与 Phaser 的生命周期连接
├── App.tsx     操作面板
└── App.css     当前界面样式
```

约束：`game/` 不依赖 React 或 Phaser；场景通过 store action 修改游戏状态；可持久化状态必须保持为可 JSON 序列化的数据。

## 当前能力

- 原始时代 → 村庄阶段。
- 浆果、木材、石头的采集、容量和离线结算。
- 招募、茅草房、仓库、制陶、火耕。
- 多资源点采空、倒计时、随机重生和自动寻路。
- 像素小人状态动画、饥饿觅食、自动存档与历史存档迁移。

当前执行顺序和发布门禁见 [`../../docs/02_路线图.md`](../../docs/02_路线图.md)。
