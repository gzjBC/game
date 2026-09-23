# 零基础做「挂机/放置类（Idle / Incremental）」网页游戏：GitHub 资源调研报告

> 调研日期：2026-09-17。star 数、主语言、最近推送时间均经 GitHub REST API 实时核对；链接均为真实可访问的 `https://github.com/owner/repo`。
> 目标画像：有 Python/Java 后端 + LangChain/Agent 经验，游戏零基础；想做一个**浏览器优先**（PC + 手机浏览器）、**现实经营 → 星际基地 → 太空殖民**成长弧线的挂机/放置游戏，当作品集，求职方向是 AI 应用 / Agent 后端。
> 标注：【官方】= 引擎/组织官方仓库；【个人/一方经验】= 个人或社区维护。

---

## 一、结论先行：为什么挂机类 + Web 栈最适合你

1. **挂机游戏几乎不需要图形渲染引擎**。核心是"数字上涨 + 购买 + 转生"，本质是**带状态管理和定时计算的 Web 应用**——和你写后端/Agent 的工作方式完全同构（资源 = 状态机，离线收益 = 时间差任务，存档 = 持久化）。
2. **浏览器即发布渠道**。React/Vue/Svelte + localStorage/IndexedDB 就能跑，GitHub Pages / itch.io 一键部署，天然 PC 浏览器 + 手机浏览器通吃。
3. **数值才是难点，不是技术**。指数增长、转生曲线、大数字处理（double 会溢出到 `Infinity`）、防改时间——这些才是挂机类的工程核心，也是本报告重点。
4. **推荐技术栈**：Vite + TypeScript + React（或 Vue/Svelte）+ Zustand/Pinia 状态管理 + `break_infinity.js` 大数字库 + localStorage（后期上 Node/Express + PostgreSQL 或 Supabase 做云存档）。不用一开始就上 Godot/Unity。

---

## 二、TOP 10 推荐清单（挂机类专题）

| # | 名称 | 链接 | 推荐理由 |
|---|------|------|----------|
| 1 | Phaser | https://github.com/phaserjs/phaser | Web 2D 事实标准框架，若挂机游戏要加点击动画/特效，用它；纯 UI 挂机甚至可以只用 React |
| 2 | phaserjs/examples | https://github.com/phaserjs/examples | Phaser 官方数百个可运行例子，查输入/场景/存档怎么写 |
| 3 | A Dark Room（开源原作） | https://github.com/doublespeakgames/adarkroom | 挂机/文字放置的开源经典，看一个"真游戏"的状态机与内容解锁怎么组织 |
| 4 | Antimatter Dimensions 源码 | https://github.com/IvarK/AntimatterDimensionsSourceCode | 转生/大数字/数值设计的天花板级开源范本，必读 |
| 5 | break_infinity.js | https://github.com/Patashu/break_infinity.js | 挂机游戏必装的大数字库，解决 1e308 溢出；Antimatter Dimensions 同款 |
| 6 | Gooboo | https://github.com/Tendsty/gooboo | 现代、多层功能、Vue 写的开源挂机游戏，看生产级项目结构与平衡数值 |
| 7 | Antimatter Dimensions notations | https://github.com/antimatter-dimensions/notations | 把 1e10000 显示成 "aa" 的数字格式化库，挂机游戏 UI 必备 |
| 8 | LittleJS | https://github.com/KilledByAPixel/LittleJS | 零依赖超轻 JS 引擎，自带例子，想做带画面的挂机可参考 |
| 9 | crgeary/idle | https://github.com/crgeary/idle | TypeScript 挂机游戏 starter 模板（GitHub Template，可一键生成） |
| 10 | godotengine/godot-demo-projects | https://github.com/godotengine/godot-demo-projects | 万一以后想做带场景/动效的版本，官方 Godot 示例仓库 |

---

## 三、经典挂机作品的开源情况与复盘（重要：先分清哪些开源）

| 作品 | 是否开源 / GitHub 可参考 | 说明 |
|------|--------------------------|------|
| Cookie Clicker | ❌ 原作闭源（orteil 未公开完整源码） | 玩法即"点击产资源 + 建筑 + 升级 + 转生"，直接抄机制即可，不必找源码 |
| A Dark Room | ✅ https://github.com/doublespeakgames/adarkroom | 文字挂机经典，8.3k★，MPL-2.0，JS；看它的状态解锁链最有价值 |
| Universal Paperclips | ❌ 闭源 | 哲学向挂机，机制参考即可 |
| Kittens Game | ❌ 闭源 | 复杂资源链设计参考 |
| Melvor Idle | ❌ 商业（Steam） | 类 RuneScape 放置，看其技能/制造树设计 |
| Adventure Capitalist | ❌ 商业 | "地球小生意 → 月球 → 火星"的太空扩张结构，正是你想要的成长弧线参考 |
| Antimatter Dimensions | ✅ https://github.com/IvarK/AntimatterDimensionsSourceCode | 392★，MIT，JS；转生循环与大数字处理教科书 |
| Gooboo | ✅ https://github.com/Tendsty/gooboo | 116★，GPL-3.0，Vue；现代多层功能挂机，生产级 |
| Space Company / Planet Crafter / ONI / Satisfactory / Factory Town | ❌ 商业（多为 3D） | 作为**题材与系统设计参考**（基地建造、科技树、阶段解锁），不要找源码 |

> **题材建议**：你的"地球小镇 → 星际基地 → 太空殖民"弧线，本质就是 Adventure Capitalist 的扩张结构 + ONI/Planet Crafter 的阶段解锁感。挂机类不需要真做 3D 基地，用**资源面板 + 阶段标签页 + 解锁式科技树**就能表达"从地球到星际"的成长。

---

## 四、网页技术栈做挂机游戏（重点）

### 4.1 框架与 UI
- **为什么挂机类特别适合 Web**：没有实时渲染压力，60fps 无所谓；UI 就是 DOM/组件树；`setInterval` 或 requestAnimationFrame 做 tick；天然跨 PC/手机浏览器。
- **推荐组合**：Vite + TypeScript + React（或 Vue/Svelte）+ 状态管理（Zustand / Pinia）。你有后端背景，这就是个带定时器的 CRUD 状态应用。
- **响应式 / PWA**：用 Tailwind 做响应式布局；加一个 manifest.json + Service Worker 即可让手机"添加到主屏幕"，接近 App 体验。
- **不要一开始就上 Phaser**。纯数字/按钮型挂机，React 就够；要加点击特效/动画/像素画面再引入 Phaser（见 TOP1/2）。

### 4.2 存档：localStorage / IndexedDB / 云存档
- **localStorage**：最简单，5–10MB 上限，JSON 序列化整个状态。原型期够用。
- **IndexedDB**：存档变大（多档位/日志）时升级，浏览器原生异步 KV。
- **云存档（后期）**：你的后端背景正好用上——Node/Express + PostgreSQL，或直接 Supabase（自带 Auth + 实时库）。这是你区别于纯前端玩家的加分项，也能做"账号 + 跨设备存档 + 防作弊"。

### 4.3 离线收益（offline progress）——挂机类的灵魂
- **核心公式**：`离线产出 = 生产速率(per sec) × min(离线秒数, 上限秒数)`。
- 退出时记录 `lastTick = Date.now()`；重开时 `elapsed = (now - lastTick)/1000`；对离线产出**设一个上限**（如 8 小时或 24 小时），否则玩家挂一年回来直接毕业。
- **防改系统时间作弊**：客户端拿 `Date.now()` 不可信；若要防作弊，必须**服务端记录上次时间戳**，由后端计算离线收益并下发；纯本地版至少做"时间戳倒退或暴涨"的兜底（把负增量和异常大增量 clamp 掉）。

### 4.4 大数字——必须用专门库
- JS 的 `Number` 在 ~1.8e308 就变 `Infinity`，挂机游戏数字随便就到 1e1000+。
- 用 **break_infinity.js**（TOP5）或 decimal.js 类库；显示层用 **notations** 库（TOP7）转成 "aa/ab/..." 缩写。

---

## 五、数值与增长曲线设计（附公式参考）

- **成本指数增长**：`cost(n) = baseCost × 1.15^n`（每买一个贵 15%，Cookie Clicker 同款）。
- **收益线性叠加**：`income = Σ(建筑数 × 单建筑速率) × 全局倍率 × 转生加成`。
- **转生（prestige）**：用 `log` 或 `sqrt` 压住增长率，避免无限膨胀；经验法则是"当重开能让你多赚 50%–200% 转生货币时就该重开"。
  - 例：`prestigePoint = sqrt(lifetimeEarned / 1e6)`；或基于 `log10(lifetime)` 线性给点（每跨一个数量级给固定点数）。
- **平衡阅读**：
  - Kongregate《The Math of Idle Games》Part I–III（成本曲线 vs 生产曲线、多建筑选择）。
  - GDC EU 2016《Quest for Progress: The Math and Design of Idle Games》PDF（转生周期与公式）。
  - dev.to《I Built 7 Idle Games in 30 Days》实战复盘。
  - 这些是文章/PPT 而非 GitHub 仓库，作为数值设计必读补充。

---

## 六、可直接上手的开源案例与模板

- **doublespeakgames/adarkroom** — https://github.com/doublespeakgames/adarkroom
  - 简介：极简文字挂机冒险，8.3k★，JS，MPL-2.0，维护至 2025。
  - 推荐理由：内容"逐步解锁"的节奏教科书，代码量适中、结构清晰。【个人/一方经验】

- **IvarK/AntimatterDimensionsSourceCode** — https://github.com/IvarK/AntimatterDimensionsSourceCode
  - 简介：Antimatter Dimensions 官方源码，392★，JS，MIT，活跃至 2026。
  - 推荐理由：转生、大数字、多层重置循环的工程范本。【个人/一方经验】

- **Tendsty/gooboo** — https://github.com/Tendsty/gooboo
  - 简介：现代多层功能挂机游戏，116★，JS/Vue，GPL-3.0，活跃至 2026。
  - 推荐理由：看一个"上线运营中"的挂机项目如何组织功能模块与平衡常数（注意 GPL，别直接抄进闭源作品）。【个人/一方经验】

- **crgeary/idle** — https://github.com/crgeary/idle
  - 简介：TypeScript 挂机游戏 starter 模板（GitHub Template）。
  - 推荐理由：一键生成仓库、起手骨架；但目前是极简模板（0 star、代码量小），当脚手架用。【个人/一方经验】

---

## 七、工具与引擎（挂机相关 + 通用附录）

**挂机类专用**
- **Patashu/break_infinity.js** — https://github.com/Patashu/break_infinity.js — 252★，TS，挂机大数字标配。【个人/一方经验】
- **antimatter-dimensions/notations** — https://github.com/antimatter-dimensions/notations — 45★，TS，数字缩写格式化。【个人/一方经验】

**Web 游戏框架（附录，若加画面）**
- **phaserjs/phaser** — https://github.com/phaserjs/phaser — 40.3k★，JS，活跃。【官方】
- **phaserjs/examples** — https://github.com/phaserjs/examples — 1.7k★，JS 官方示例。【官方】
- **KilledByAPixel/LittleJS** — https://github.com/KilledByAPixel/LittleJS — 4.2k★，零依赖轻量 JS 引擎。【个人/一方经验】

**通用引擎（附录，非挂机首选）**
- **godotengine/godot** — https://github.com/godotengine/godot — 117.3k★，C++，活跃。【官方】
- **godotengine/godot-demo-projects** — https://github.com/godotengine/godot-demo-projects — 9.5k★。【官方】
- **pygame/pygame** — https://github.com/pygame/pygame — 8.9k★（Python，你熟悉，但挂机作品不推荐用它发布到浏览器）。【官方】
- **bevyengine/bevy** — https://github.com/bevyengine/bevy — 48.2k★，Rust。【官方】
- **raysan5/raylib** — https://github.com/raysan5/raylib — 34.8k★，C。【个人/一方经验】
- **Unity-Technologies/UnityCsReference** — https://github.com/Unity-Technologies/UnityCsReference — 13.0k★，Unity C# 引擎层参考（Unity 编辑器本身闭源）。【官方】

**美术 / 关卡 / 素材（附录）**
- **aseprite/aseprite** — https://github.com/aseprite/aseprite — 39.5k★，像素画标准（二进制收费、源码开源）。【官方】
- **Orama-Interactive/Pixelorama** — https://github.com/Orama-Interactive/Pixelorama — 10.3k★，免费像素画替代。【个人/社区】
- **mapeditor/tiled** — https://github.com/mapeditor/tiled — 12.9k★，2D 关卡/tileset 编辑器。【官方】
- **deepnight/ldtk** — https://github.com/deepnight/ldtk — 4.2k★，现代 2D 关卡编辑器（JSON 导出对程序友好）。【个人/一方经验】
- **chrismaltby/gb-studio** — https://github.com/chrismaltby/gb-studio — 9.4k★，拖拽式复古游戏制作器。【个人/一方经验】

**版本控制**
- **git-lfs/git-lfs** — https://github.com/git-lfs/git-lfs — 14.5k★，大文件版本管理（挂机类素材少，但截图/音效用得上）。【官方】

**找更多开源游戏的目录**
- **leereilly/games** — https://github.com/leereilly/games — 25.0k★，⚠️ 已归档，仍是找开源游戏的经典目录。【个人/一方经验】
- **michelpereira/awesome-open-source-games** — https://github.com/michelpereira/awesome-open-source-games — 3.1k★，活跃。【个人/一方经验】

---

## 八、挂机类新手常见坑

- **用 Number 存资源** → 很快变 Infinity；从第一行代码就上 break_infinity.js。
- **离线收益直接按真实时间全额发** → 玩家挂一年回来毕业；务必设离线上限 + 软上限。
- **信任客户端时间** → 改系统时间秒刷资源；要正经防作弊就把时间戳和结算放服务端。
- **成本/收益曲线失衡** → 先画两张图（成本曲线 vs 生产曲线）再写数值；转生用 log/sqrt 压。
- **一上来就做美术/主菜单** → 挂机游戏先用数字和按钮把"循环感"做爽，再换皮。
- **存档没做导出/迁移** → 浏览器清缓存就没了；早期就加 JSON 导出/导入。
- **手机浏览器不适配** → 按钮太小、双击缩放、viewport 没设；做响应式 + 禁止双击缩放。

---

## 九、数据与方法说明

- star 数与"最近推送时间"来自 GitHub 官方 REST API，2026-09-17 实时返回，为约数；数字每日变化，以你打开页面为准。
- 凡本报告未通过 API 核实存在性的仓库均未列出（如 Cookie Clicker 原始源码仓库、部分 itch.io 付费模板只作方向提示，不列为可访问 GitHub 资源）。
- 商业作品（Adventure Capitalist / Satisfactory / ONI / Planet Crafter / Melvor 等）无公开源码，仅作题材与系统设计参考。
- 只读取了仓库元数据与 README 描述，未 clone 任何仓库。


---

## 增补：可视化经营（《High》愿景专项）

> 游戏定名《High》：**可视化的放置经营**——不能只有数字，要看到小人（工人/居民）在场景中移动、建设基地。发展线：**小镇 → 城市 → 国家 → 冲出地球 / 太空基地（终局科幻层）**。本节针对"看得见的小人 + 网格场景 + 阶段解锁"补充资源。

### 增补-1 对标 CivIdle（闲城帝国）的开源情况

- **CivIdle 本身闭源**：Steam / cividle.com 商业作品，未公开源码，GitHub 上**没有官方或可信的完整开源 clone**。不要去找"官方 CivIdle 源码"。
- **最接近的开源对标 = Unciv** — https://github.com/yairm210/Unciv
  - 简介：开源《文明 5》重制版，11.3k★，Kotlin（libGDX），MPL-2.0，活跃至 2026。
  - 推荐理由：你要的"科技树 + 时代阶段解锁 + 地块/单位移动"全部能在这里读到实现；虽非 Web 栈，但**系统设计（时代过渡、科技前置条件、奇观/区域）是绝佳参考**。【个人/一方经验】
- **玩法拆解（非源码）**：CivIdle 的核心是"每解锁一个时代/科技，新增一类建筑与一条资源链"——《High》可直接照搬这个"阶段即新内容包"的节奏，而不必复刻其数值。

### 增补-2 网页 Canvas 2D 精灵动画 + 网格寻路

- **Phaser 官方示例** — https://github.com/phaserjs/examples （见前文 TOP2）
  - 重点看其中的：tilemap 加载、精灵移动/动画、路径跟随（path-following）、物理。Phaser 自带 tilemap + arcade/ matter 物理，做"小人沿路走"最快。
- **qiao/PathFinding.js** — https://github.com/qiao/PathFinding.js
  - 简介：综合性网格寻路库（A*、BFS、Dijkstra 等），8.7k★，JS，活跃至 2024。
  - 推荐理由：给"工人从仓库走到工地"的网格 A*，带可视化演示页，零依赖可直接嵌 React。【个人/一方经验】
- **prettymuchbryce/easystarjs** — https://github.com/prettymuchbryce/easystarjs
  - 简介：异步 A* 寻路 API，1.9k★，JS，MIT。
  - 推荐理由：比 PathFinding.js 更轻、API 更傻瓜，适合"网格地形 → 一条路"的简单场景；Phaser 社区常用它。【个人/一方经验】
- **processing/p5.js** — https://github.com/processing/p5.js
  - 简介：创意编程 Canvas 库，24.0k★，JS，活跃至 2026。
  - 推荐理由：若不想上 Phaser、只想用原生 Canvas 画小人在网格上走，p5.js 的绘图/动画 API 最易学。【官方/社区】

> **渲染方案建议**：像素风经营游戏 = tilemap 背景（Tiled/LDtk 导出）+ 精灵层（工人/居民）。Canvas 上开 `image-rendering: pixelated` 做整数倍放大，避免模糊；寻路用上面任一库，工人只在网格点间插值移动，不必真做逐帧物理。

### 增补-3 阶段解锁 / 科技树设计（开罗 / Factorio / CivIdle 式）

- **Unciv**（见增补-1）：科技前置依赖、时代跃迁、奇观一次性奖励的开源实现。
- **Gooboo**（前文 TOP6）：多"功能层"逐个解锁的现代挂机，看它如何用"完成本层目标 → 解锁下一层"维持长期动机。
- **A Dark Room**（前文 TOP3）：极简但节奏极好的"逐步解锁"范本。
- 设计经验：每阶段（小镇/城市/国家/太空）= 一张新地图主题 + 新建筑族 + 新资源链；终局"冲出地球"用一个新画布/新场景层表达，给玩家"世界变大"的视觉跃迁。

### 增补-4 像素美术与免费素材（非 GitHub 仓库，方向提示）

- **Aseprite 免费替代**：前文已列 **Pixelorama**（https://github.com/Orama-Interactive/Pixelorama）。
- **免费像素素材站**（不在 GitHub，仅提示）：OpenGameArt.org、Kenney.nl（CC0 素材包，适合做工人/建筑/地块）、itch.io 免费像素包（如 Ninja Adventure）。
- **地图编辑**：前文 **Tiled** / **LDtk** 直接导出 tilemap，Phaser 可原生加载 Tiled 的 .tmx。

### 增补-5 React + Canvas 混合渲染（UI 用 React，场景用 Canvas）

- **架构模式**（无单一"标准仓库"，这是实践范式）：
  - React 负责菜单、数值面板、科技树、弹窗（DOM，易做响应式与无障碍）。
  - 一个 `<canvas ref>` 挂在页面里，用 `requestAnimationFrame` 渲染场景层（tilemap + 移动中的小人）。
  - 共享状态用 Zustand/Pinia；Canvas 层只读状态，不被 React 重渲染拖累性能。
- **参考**：Phaser 实例化后挂进一个 React `ref` 容器（社区常见做法）；纯 Canvas 则用 p5.js 实例模式挂载到同一节点。
- **优势**：数值面板（数字、进度条）用 React/Tailwind 做响应式，手机浏览器体验好；场景层独立 60fps，互不阻塞。

### 增补后 TOP 10（结合《High》可视化愿景微调）

| # | 名称 | 链接 | 推荐理由 |
|---|------|------|----------|
| 1 | Phaser | https://github.com/phaserjs/phaser | 可视化经营的首选：tilemap + 精灵 + 内置物理/动画，小人移动/建设场景用它 |
| 2 | Phaser 官方示例 | https://github.com/phaserjs/examples | tilemap 加载、精灵移动、寻路跟随的可运行样例 |
| 3 | qiao/PathFinding.js | https://github.com/qiao/PathFinding.js | 工人在网格上寻路走动的核心库 |
| 4 | prettymuchbryce/easystarjs | https://github.com/prettymuchbryce/easystarjs | 更轻的异步 A*，Phaser 常用搭配 |
| 5 | Unciv | https://github.com/yairm210/Unciv | 科技树/时代阶段解锁的开源系统设计参考 |
| 6 | A Dark Room | https://github.com/doublespeakgames/adarkroom | 逐步解锁节奏 + 挂机状态机范本 |
| 7 | break_infinity.js | https://github.com/Patashu/break_infinity.js | 经营数值指数增长的大数字库 |
| 8 | Gooboo | https://github.com/Tendsty/gooboo | 现代多层开源经营/挂机的生产级结构参考 |
| 9 | Tiled | https://github.com/mapeditor/tiled | 画小镇/城市/太空基地地图，导出 tilemap 给 Phaser |
| 10 | p5.js | https://github.com/processing/p5.js | 不想用 Phaser 时，原生 Canvas 画小人移动的轻量替代 |

> 注：本节新增核实仓库为 Unciv、PathFinding.js、easystarjs、p5.js；CivIdle 闭源无官方源码，已据实说明。
