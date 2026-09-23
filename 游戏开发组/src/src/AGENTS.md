# 《High》游戏开发组 — Agent 协同守则（写给 Codex / 其他 AI agent）

## 项目一句话
《High》：可视化挂机/放置经营 Web 游戏（像素风，浏览器优先 PC+手机）。成长线：原始(山洞)→村庄(茅草房)→小镇→城市→国家→太空终局。当前（2026-09-23）：M2 村庄阶段已完成，正在 R0/R1 质量收口与首玩体验。游戏机制完整决策表见项目根 `项目记忆.md`（ADR 001-037，MainAgent 维护，勿直接改）。

## 技术栈与命令（代码根 = 本目录）
- Vite 8 + TypeScript 6 + React 19 + Zustand 5 + **Phaser 4.2.1** + easystarjs 0.4.4 + Vitest 5 + oxlint
- `npm run dev`：开发（localhost:5173，可加 `?debug=1`）
- `npm run check`：**= lint + test + build，任何代码改动后必须跑通**
- 单测：`src/game/__tests__/`（当前 95 例，Vitest）

## 目录结构
- `src/game/`：纯逻辑（save / store / nodes / food / production / buildings / tech / offline / resources / layout / rng / names / recruit / saveValidation）
- `src/scene/`：Phaser 场景（GameScene / WorkerSprite）
- `src/hooks/`、`src/types/`、`src/assets/`、`src/App.tsx`、`src/appVersion.ts`：React 层
- `public/assets/sprites/`：像素素材（villager 6 张 128×128 sheet，4 方向×4 帧×32px）

## 硬约束（违反会破坏存档/运行，必须遵守）
1. **存档**：localStorage key `high-save-v2`（v1 已废弃）。字段语义别改；`migrateSave` 必须兼容旧档；写档前 `.bak` 备份、读档失败原档存 `.corrupt` 再重建（ADR 035）。存档结构见 `src/game/save.ts` 类型定义。
2. **调试钩子**：`window.__highStore`（{getState,setState}）、`window.__highStoreScene`、`window.__highDebug`（scene/workers）——浏览器验收依赖，别删。
3. **Phaser 是 v4.2.1 不是 v3**（API 有差异，别按 v3 教程写）；easystarjs 0.4.4 是 UMD 导出（构造函数在 exports.js，方法 `setIterationsPerCalculation`，异步回调）。
4. **WorkerSprite 不能用 `setState`/`state` 命名**（与 Phaser 冲突）。
5. **离线收益 = 在线 × 0.2（ADR 023）、8h 上限**；离线结算必须 `max(0)` 防负收益；资源点离线按类型总量 clamp。
6. **全局 store 单例**：`window.__highStoreSingleton`（修 HMR 双实例 bug，ADR 034），不要引入第二份 store 实例。
7. **协同规则**：改文件前先看上级目录 `协同任务.md` 认领任务；不要与另一个 agent 同时改同一文件；改完跑 `npm run check` 并更新任务状态；**不要动 `项目记忆.md`、`测试组/`、`图像绘画组/`**。
8. **建筑/布局常量集中在 `src/game/layout.ts`**（HUT_MAX=8、SHED_MAX=8、GRID=20）；数值集中在 game 层各模块，别在 scene/UI 写魔法数字。

## 当前进度（2026-09-23）
- M2 村庄阶段完成（ADR 001-037）：食物系统 / debug 倍速 / 建筑碰撞 / 像素小人 / 村庄+仓库 / 资源点 10 点+采空随机重生+残影倒计时 / 饥饿减半（ADR 036）/ 茅草房 8 上限+新外观（ADR 037）
- R0 已做：check 脚本 ✅ / 版本号 0.1.0-alpha.1 ✅ / README ✅ / saveValidation.ts ✅ / lint 待清零
- R1 待办：目标提示 / 不可用按钮资源缺口 / 离线收益摘要可关闭 / 重置二次确认 / 存档导入导出 / 生火建造研究反馈
- 完整路线图与门禁：项目根 `docs/02_路线图.md`；机制设计：`docs/04*.md`

## 验收标准
- `npm run check` 全绿；改动不影响旧存档兼容（用 `migrateSave` 路径验证）；浏览器 `?debug=1` 实测关键路径。
