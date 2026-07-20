# Technical

## 1. 技术栈

- JavaScript ES modules、Vite 5 与 Three.js 0.160.0。
- Canvas/WebGL 渲染低多边形等距场景；HTML/CSS 负责 HUD、结算、排行榜和角色商店。
- `vite.config.js` 使用 `base: './'`，因此构建产物可部署在任意子路径。
- Aigram bridge 提供按游戏 UUID 隔离的排行榜、资料页打开和分数超越通知；本地 `localStorage` 保存最高分及角色收藏。

## 2. 目录结构

- `index.html`：页面入口、HUD、角色仓库筛选、车票收藏状态、实时 Three.js 角色预览和 Aigram 排行榜 UI。
- `game.js`：Three.js 场景、跳跃物理、命中判定、音效、52 位角色实例替换、动物专属动作和分数提交。
- `src/character-library.js`：共享正式角色库的 52 个 GLB 资产 URL、目录元数据、预载/三次重试和可释放克隆工厂。
- `src/assets/characters/`：从共享角色库同步的 52 个正式 GLB，按 people / archetypes / monsters / animals / office / villains 等来源保留文件名。
- `builders/characters.js`：在正式 GLB 仍加载时保留的紧凑后备角色构建器。
- `src/engine-3d/characters-base.js`、`archetypes.js`、`monsters.js`：可复用的方块角色模型与骨骼摆动数据。
- `cartridge/`：天空主题、场景色彩与运行文案配置。
- `doc/requirements.md`、`doc/visual.md`、`doc/technical.md`：产品、视觉和实现说明。

## 3. 核心模块

- 主循环：`game.js` 以 `requestAnimationFrame` 更新蓄力、抛物线、镜头、天气、粒子和 WebGL 合成器；DOM 只在分数、连击和结算变化时更新。
- 角色选择：`startGame({ selectedCharacter })` 接收已装备角色；`setCharacter()` 只接受 52 项 `CHARACTER_CATALOG` 中的 key，并且在待机/结算时立刻重建角色网格。`preloadCharacterLibrary()` 完成后会将当前后备角色替换为对应正式 GLB；`reset()` 始终重用当前装备，不再随机抽取角色。
- 动物动作：`ANIMAL_KEYS` 在 `game.js` 把动物送入独立的待机、蓄力和空中姿态。青蛙、奔跃动物、鸟类与重型动物分别改变根节点压缩、俯仰、步幅与落地回弹；有 `rig_legL/rig_legR` 的 GLB 同时摆动腿部。
- 动物尺度：`buildHeroMesh()` 用 `Box3` 计算动物 GLB 的原始高度和最长水平轴；按目标高度 2.46、普通动物水平上限 1.98、猪/牛/熊水平上限 2.16 求最小适配比例，再应用游戏的全局 `HERO_SCALE`。这避免宽体动物占满站台。
- 收藏存档：`index.html` 的 `sl.collection.v1` 保存 `{ tickets, unlocked, equipped }`。初始角色为 `commuter`；结算时 `awardTickets()` 按分数增加 5–25 张车票；购买成功后立即写回并装备。角色仓库可筛选全部/人物/怪物/动物，并显示 `收藏 X / 52`。`setLivePreview()` 将当前 GLB 装入商店专用 Three.js 画布，`renderLivePreview()` 在商店打开时以 requestAnimationFrame 缓慢转身、浮动并在关闭时停止循环；`thumbFor()` 只为两侧相邻角色生成缓存 PNG。
- 交互隔离：全局 Pointer 事件在角色商店、收藏入口和排行榜上直接返回，避免 UI 点击误触蓄力。商店内卡片使用 Click，底部抽屉内部可滚动。
- 平台：`public/aigram-bridge.js` 的排行榜 API 仍在死亡时提交分数；HTML 内保留冠军入口、榜单和 `score_beat` 通知流程。

## 4. 扩展点

- 增减角色或调整价格：编辑 `src/character-library.js` 中的分类数组和 `CHARACTER_CATALOG`；新增正式模型需同步放入 `src/assets/characters/`，并保持总数校验准确。
- 调整车票产出与解锁节奏：编辑 `index.html` 的 `awardTickets()` 和 `src/character-library.js` 中的 `CHARACTER_CATALOG.cost`。
- 调整跳跃手感、得分与判定：编辑 `game.js` 顶部常量、`judgeLanding()` 与 `jumpDist()`。
- 调整商店视觉、响应式布局或状态：编辑 `index.html` 中 `#shop`、`.character-card` 和相关 CSS 变量，并同步更新 `doc/visual.md`。
- 调整云海、站台和文案：编辑 `cartridge/`；替换角色模型则编辑 `src/engine-3d/` 下的模型构建器。
