# Technical

## 1. 技术栈

- JavaScript ES modules、Vite 5 与 Three.js 0.160.0。
- Canvas/WebGL 渲染低多边形等距场景；HTML/CSS 负责 HUD、结算、排行榜和角色商店。
- `vite.config.js` 使用 `base: './'`，因此构建产物可部署在任意子路径。
- Aigram bridge 提供按游戏 UUID 隔离的排行榜、资料页打开和分数超越通知；本地 `localStorage` 保存最高分及角色收藏。

## 2. 目录结构

- `index.html`：页面入口、HUD、角色商店、车票收藏状态、离屏 Three.js 角色缩略渲染和 Aigram 排行榜 UI。
- `game.js`：Three.js 场景、跳跃物理、命中判定、音效、角色实例替换和分数提交。
- `builders/characters.js`：合并角色模型，并导出六位可收藏角色的 `CHARACTER_CATALOG` 元数据。
- `src/engine-3d/characters-base.js`、`archetypes.js`、`monsters.js`：可复用的方块角色模型与骨骼摆动数据。
- `cartridge/`：天空主题、场景色彩与运行文案配置。
- `doc/requirements.md`、`doc/visual.md`、`doc/technical.md`：产品、视觉和实现说明。

## 3. 核心模块

- 主循环：`game.js` 以 `requestAnimationFrame` 更新蓄力、抛物线、镜头、天气、粒子和 WebGL 合成器；DOM 只在分数、连击和结算变化时更新。
- 角色选择：`startGame({ selectedCharacter })` 接收已装备角色；`setCharacter()` 只接受 `CHARACTER_CATALOG` 中的 key，并且在待机/结算时立刻重建角色网格。`reset()` 始终重用当前装备，不再随机抽取角色。
- 收藏存档：`index.html` 的 `sl.collection.v1` 保存 `{ tickets, unlocked, equipped }`。初始角色为 `shopkeeper`；结算时 `awardTickets()` 按分数增加 1–8 张车票；购买成功后立即写回并装备。`setLivePreview()` 将当前 `CHARACTERS` 模型装入商店专用 Three.js 画布，`renderLivePreview()` 在商店打开时以 requestAnimationFrame 缓慢转身、浮动并在关闭时停止循环；`thumbFor()` 只为两侧相邻角色生成缓存 PNG。
- 交互隔离：全局 Pointer 事件在角色商店、收藏入口和排行榜上直接返回，避免 UI 点击误触蓄力。商店内卡片使用 Click，底部抽屉内部可滚动。
- 平台：`public/aigram-bridge.js` 的排行榜 API 仍在死亡时提交分数；HTML 内保留冠军入口、榜单和 `score_beat` 通知流程。

## 4. 扩展点

- 增减角色或调整价格：编辑 `builders/characters.js` 中的 `CHARACTER_CATALOG`；key 必须存在于 `CHARACTERS`。
- 调整车票产出与解锁节奏：编辑 `index.html` 的 `awardTickets()` 和 `CHARACTER_CATALOG.cost`。
- 调整跳跃手感、得分与判定：编辑 `game.js` 顶部常量、`judgeLanding()` 与 `jumpDist()`。
- 调整商店视觉、响应式布局或状态：编辑 `index.html` 中 `#shop`、`.character-card` 和相关 CSS 变量，并同步更新 `doc/visual.md`。
- 调整云海、站台和文案：编辑 `cartridge/`；替换角色模型则编辑 `src/engine-3d/` 下的模型构建器。
