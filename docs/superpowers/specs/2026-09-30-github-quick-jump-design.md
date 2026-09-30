# GitHub Quick Jump — 设计文档

- 日期：2026-09-30
- 状态：已确认，待实现

## 1. 目标

在任意 GitHub 仓库页面，注入一个可拖动的悬浮圆形按钮。点击后展开快捷跳转项，把当前仓库的 `owner/repo` 拼接到第三方服务地址前缀上，在新标签页打开。

该按钮同样注入到这 6 个第三方站点，因此跳转过去之后仍可一键切换到其他服务。在第三方站点上，列表末尾额外出现 **GitHub** 项，可一键跳回仓库页。

除内置的 6 个第三方服务外，用户还可以在选项页自行添加跳转地址（地址模板支持 `{owner}` / `{repo}` 占位符），自定义项追加在列表末尾。

灵感来源：B 站视频《GitHub 改一下网址，解锁 6 种打开方式》。

## 2. 范围

**做**
- Chrome / Edge，Manifest V3
- 仅在仓库页注入：GitHub 仓库页（含子页面，如 `/owner/repo/issues`）以及 6 个第三方站点的仓库页
- 悬浮球可拖动、位置持久化、吸附左右边缘
- 点击展开跳转项，新标签页打开；内置 7 项（6 个第三方服务 + GitHub 回跳）
- 当前所在的那一项置灰标「当前」，不可点击
- 选项页管理自定义跳转地址：增删改，存 `chrome.storage.sync`，自定义项追加在内置项之后
- 扩展图标与悬浮球视觉一致（深色圆底 + 白色章鱼猫）

**不做（YAGNI）**
- 自定义项的排序 / 分组 / 启用开关
- 在面板内直接编辑自定义项（编辑只在选项页进行）
- Firefox 兼容
- 国际化
- 后台 service worker
- 工具栏 action 按钮（只配扩展图标，不加无功能的按钮）

## 3. 技术方案

选中方案：**content script + Shadow DOM 注入**。

| 备选 | 结论 |
| --- | --- |
| content script + 普通 DOM | 样式易被 GitHub 全局 CSS 污染，长期易碎 |
| 扩展 action popup / side panel | 不满足"页面内悬浮球"的交互要求 |

Shadow DOM 让按钮与面板的样式与宿主页面完全隔离，GitHub 改版不会带崩样式。

## 4. 文件结构

```
github-quick-jump/
├── manifest.json
├── content.js
├── options.html            # 自定义地址管理页（选项页）
├── options.js
├── icons/
│   ├── icon.svg            # 图标源文件（深色圆底 + 白色章鱼猫）
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── render_icons.py     # 由 icon.svg 生成各尺寸 PNG
├── tests/
│   └── verify-custom.js    # 自定义服务解析/合并逻辑的断言测试（node 运行）
└── docs/superpowers/specs/2026-09-30-github-quick-jump-design.md
```

无构建工具、无运行时依赖、无 CSS 文件（悬浮球样式内联在 Shadow DOM 中，选项页样式内联在 `options.html`）。

### 扩展图标

Chrome 的扩展图标不支持 SVG，必须是位图。`icons/icon.svg` 是源文件（与悬浮球同一套视觉：`#1c1e22` 圆底 + 白色章鱼猫），由 `icons/render_icons.py` 用无头 Chrome 渲染 SVG、再用 Pillow 降采样生成 16/32/48/128 四个 PNG。改了 SVG 后重跑该脚本即可。

图标用 `<mask>` 实现：遮罩圆减去章鱼猫路径的填充区域（该路径填充得到的是「圆盘挖空猫」的补集），从而得到白色猫剪影，且边缘无接缝。

## 5. 模块划分

全部位于 `content.js`，各自职责单一：

| 模块 | 职责 | 依赖 |
| --- | --- | --- |
| `parseRepo(hostname, pathname)` | 按域名解析 `{owner, repo}`；非仓库页返回 `null` | `GITHUB_HOSTS` / `STACKBLITZ_HOSTS` / `PLAIN_HOSTS` |
| `SERVICES` | 7 个内置跳转目标的常量表 `{id, label, desc, url(owner, repo)}` | 无 |
| `sanitizeCustom(raw)` | 清洗 `chrome.storage.sync` 里的自定义项：丢弃非对象/空名称/非 http(s) 模板，trim 字段，生成 `custom:0…n` 形式的 id | `isHttpUrl` |
| `activeServices()` | 合并内置与自定义服务，内置在前、自定义在后 | `SERVICES` |
| `currentServiceId(hostname)` | 判定当前页面属于哪个服务（GitHub 单独判定，其余查 `SERVICE_BY_HOST`） | `GITHUB_HOSTS` / `SERVICE_BY_HOST` |
| `buildWidget()` | 建 Shadow DOM 宿主，渲染主按钮 + 垂直面板 | 无 |
| `renderItems(info)` | 刷新各跳转项 `href`，并把当前所在项置灰标「当前」 | `activeServices` / `currentServiceId` |
| `enableDrag()` | 指针拖拽、位移阈值判定、边缘吸附、位置持久化 | `chrome.storage` |
| `openPanel()` / `closePanel()` / `togglePanel()` | 展开/收起，含上下方向与左右对齐自适应 | 无 |
| `watchRoute()` | 监听 SPA 路由变化（patch history + popstate）并重新解析 | `history` API |

## 6. 服务、站点与 URL 解析

### 6.1 跳转目标

| 标签 | 用途说明 | URL 模板 |
| --- | --- | --- |
| GitDiagram | 看架构图 | `https://gitdiagram.com/{owner}/{repo}` |
| DeepWiki | 读项目讲解 | `https://deepwiki.com/{owner}/{repo}` |
| Gitingest | 整理给 AI | `https://gitingest.com/{owner}/{repo}` |
| GitHub1s | 在线读源码 | `https://github1s.com/{owner}/{repo}` |
| GitHub.dev | 在线改代码 | `https://github.dev/{owner}/{repo}` |
| StackBlitz | 在线运行 | `https://stackblitz.com/github/{owner}/{repo}` |
| GitHub | 回到仓库页 | `https://github.com/{owner}/{repo}` |

前 6 项是第三方服务，第 7 项 GitHub 是回跳入口，固定排在列表末尾。

每个跳转项在面板中渲染为「圆点 + 服务名 + 用途说明」：服务名常规字重、浅色；用途说明右对齐、12px、灰色。面板最小宽度 212px。

**当前所在服务**：`currentServiceId(hostname)` 判定当前页面属于哪个服务——`github.com` 返回 `'github'`，6 个第三方站点从 `SERVICE_BY_HOST` 查表。命中的那一项会置灰、圆点转为灰色、用途说明替换为「当前」，并移除 `href` 使其不可点击，避免误点重复跳转。因此：

- 在 GitHub 上：GitHub 项为「当前」，其余 6 项可点
- 在第三方站点上：该站点项为「当前」，其余 5 个第三方服务 + GitHub 共 6 项可点

### 6.2 注入范围与反解析

`parseRepo(hostname, pathname)` 按宿主域名选择解析规则，从 URL 反推出 `owner/repo`：

| 域名 | 路径规则 | 说明 |
| --- | --- | --- |
| `github.com` / `www.github.com` | 取前两段，并排除保留路径 | 见 §9 |
| `stackblitz.com` / `www.stackblitz.com` | 首段必须是 `github`，取第 2、3 段 | `stackblitz.com/github/{owner}/{repo}` |
| 其余 5 个站点（含 `www.` 前缀） | 取前两段 | `gitdiagram.com` / `deepwiki.com` / `gitingest.com` / `github1s.com` / `github.dev` |

各站点后续路径段（如 `deepwiki.com/{owner}/{repo}/{page}`、`stackblitz.com/github/{owner}/{repo}/tree/main`）一律忽略，只取 `owner/repo`。

跳转模板与反解析规则互为逆运算，因此在任一站点上都能解析出仓库并跳回其余 5 个站点。

域名清单以 `SERVICE_BY_HOST`（域名 → 服务 id）为唯一来源：`PLAIN_HOSTS` 由它派生（排除 stackblitz），「当前所在服务」标记也从它查表，避免域名列表多处维护产生漂移。

### 6.3 manifest 注入声明

`content_scripts.matches` 覆盖 `github.com` 及 6 个第三方域名；声明式 content script 无需额外 `host_permissions`。

`options_ui` 声明选项页 `options.html`（`open_in_tab: true`），在 `chrome://extensions` 的扩展详情里点「扩展程序选项」打开。

### 6.4 自定义地址

自定义地址存于 `chrome.storage.sync` 的 `gh-quick-jump-custom` 键，值是一个数组，每项为 `{label, desc, template}`：

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `label` | 是 | 面板左侧显示的名称，最长 20 字符 |
| `desc` | 否 | 面板右侧的用途说明，最长 12 字符；留空则面板右侧不显示内容 |
| `template` | 是 | 完整 http(s) 链接，可含 `{owner}` / `{repo}` 占位符；无占位符时即为固定地址 |

**占位符替换**：`{owner}` / `{repo}` 分别替换为 `encodeURIComponent(owner)` / `encodeURIComponent(repo)`，因此含空格或斜杠的异常仓库名不会破坏 URL 结构。

**写入侧（`options.js`）**：表单提交时校验名称非空、模板是 http(s) 链接，通过后写入 storage；支持就地编辑与删除。输入模板时实时显示以 `vuejs/core` 为例的预览。

**读取侧（`content.js`）**：启动时 `chrome.storage.sync.get` 读取并交给 `sanitizeCustom` 清洗；同时监听 `chrome.storage.onChanged`，用户改完选项页后无需刷新已打开的仓库页，面板即时更新。

**不可信输入的处理**：storage 内容可能被手工改坏或被其他扩展写入，因此渲染前一律走 `sanitizeCustom` —— 丢弃非对象项、空名称、非 http(s) 模板（挡住 `javascript:` 等危险 scheme 与相对路径），字段统一 trim，id 重新生成保证唯一。清洗后模板只作为 `<a href>` 使用，且始终带 `rel="noopener noreferrer"`。

**与「当前」判定的关系**：`currentServiceId` 只认内置服务与 `SERVICE_BY_HOST`，自定义项不参与判定，因此永远不会出现「自定义项被置灰」的情况。

**样式区分**：自定义项圆点用蓝色（`#58a6ff`），内置项用绿色（`#7ee787`），便于一眼区分来源。

## 7. 数据流

```
URL 变化（首次加载 / SPA 跳转）
  → parseRepo(location.hostname, location.pathname)
      ├─ null  → 隐藏悬浮球，收起面板
      └─ {owner, repo} → 显示悬浮球；仓库变化时 renderItems 刷新各跳转项 href
  → 点击主按钮 → togglePanel() 展开
  → 点击跳转项 → <a target="_blank" rel="noopener noreferrer"> 新标签打开 → 收起面板

chrome.storage.sync 的 gh-quick-jump-custom 变化（首次读取 / onChanged）
  → sanitizeCustom(raw) → customServices
  → renderItems(currentInfo) 重绘面板（内置 7 项 + 自定义项）
```

同一套流程在 GitHub 与 6 个第三方站点上完全一致，差别只在 `parseRepo` 的域名分支。

## 8. 交互细节

- **主按钮**：直径 48px 圆形，内联 GitHub 章鱼猫 SVG（不依赖网络资源，规避 CSP 与图标加载失败）
- **拖拽**：`pointerdown` → `pointermove` → `pointerup`；位移超过 4px 判定为拖拽，不触发点击；`pointerup` 后吸附到最近的左/右边缘（边距 12px），垂直位置限制在视口内
- **持久化**：存储 `{side: 'left'|'right', top: number}` 到 `chrome.storage.local`
- **面板方向**：展开前先量出面板实际高度，比较按钮上下两侧的可用空间，朝空间更大的一侧展开（按钮靠上则向下、靠下则向上）；面板高度限制在该侧可用空间内，超出部分面板内部滚动，避免面板整体跑出视口。左右方向按按钮所在半屏对齐，避免面板越出屏幕边缘
- **关闭方式**：点击面板外部、按 Esc、点击任一跳转项后自动收起
- **主题**：固定深色半透明底 + 白色图标，浅色/深色主题下都清晰

## 9. 边界情况

| 情况 | 处理 |
| --- | --- |
| GitHub 首页 / 搜索页 / 用户主页 / 设置页 | `parseRepo` 返回 `null`，不注入 |
| GitHub 仓库子页面（`/issues`、`/pulls` 等） | 取路径前两段，仍可用 |
| GitHub 保留路径（`settings`/`marketplace`/`explore`/`orgs`/`users`/`topics` 等）作为第一段 | 视为非仓库页 |
| 第三方站点首页（`deepwiki.com/`、`github.dev/` 等） | 路径不足两段，返回 `null`，不注入 |
| `stackblitz.com` 非 `/github/` 路径（如 `/edit/abc`） | 首段不是 `github`，返回 `null` |
| 第三方站点未识别的域名 | 不在白名单内，返回 `null` |
| 私有 / 不存在的仓库 | 不校验，直接拼接；第三方服务返回 404 可接受 |
| 扩展被重复注入 | 以宿主元素 id 判重 |
| SPA 替换 `document.body` | `update()` 中检测 `host.isConnected`，脱离时重新挂载 |
| 当前页面所在的服务 | 该项置灰标「当前」，移除 `href` 不可点击 |
| 在第三方站点上想回到 GitHub | 列表末尾固定有 GitHub 项，指向 `github.com/{owner}/{repo}` |
| iframe 内 | `all_frames` 默认 false，不注入 |
| 自定义地址模板非 http(s)（`javascript:`、相对路径等） | `sanitizeCustom` 丢弃该条，不渲染 |
| 自定义地址名称为空 | 丢弃该条 |
| 自定义地址模板不含占位符 | 保留，作为固定地址打开 |
| storage 里是 `null` / 非数组 / 混入非对象项 | 逐项过滤，最终退化为「只有内置 7 项」 |
| 自定义地址很多导致面板高于视口 | 面板高度受限于展开侧可用空间，内部滚动 |
| 在选项页增删改后已打开的仓库页 | 监听 `chrome.storage.onChanged`，面板即时更新，无需刷新 |

## 10. 测试方式

### 10.1 自动化（自定义地址逻辑）

`tests/verify-custom.js` 用 node 直接运行，把 `content.js` 中 `'use strict'` 到 `buildWidget` 之间的纯逻辑段取出求值，断言 `sanitizeCustom` / `activeServices` / `currentServiceId` 的行为：

```
node tests/verify-custom.js
```

覆盖：脏数据过滤（空名称、非 http(s) 模板、`javascript:`、相对路径、非对象项）、字段 trim、模板占位符替换与 URL 编码、无占位符的固定地址、id 唯一性、合并顺序（内置在前、自定义在后）、自定义项不参与「当前」判定。

### 10.2 手动（交互）

1. `chrome://extensions` 开启开发者模式 → 加载已解压的扩展
2. 打开 `https://github.com/vuejs/core`，确认悬浮球出现
3. 拖动按钮，刷新页面确认位置保持
4. 依次点击 6 个跳转项，核对新标签 URL 拼接正确
5. **在跳转后的第三方站点（如 `deepwiki.com/vuejs/core`）确认悬浮球同样出现，列表末尾有 GitHub 项，点击可跳回 `github.com/vuejs/core`**
6. **在第三方站点确认对应项已置灰标「当前」且点击无反应**
7. **在 `https://github.com/vuejs/core` 确认 GitHub 项显示为「当前」且置灰**
8. **在 `https://stackblitz.com/edit/abc`、`https://deepwiki.com/` 确认不出现悬浮球**
9. 从仓库页点进 Issues 再返回，确认按钮不重复注入、不闪烁
10. 打开 `https://github.com/explore`，确认不出现悬浮球
11. 按 Esc 与点击空白处，确认面板收起
12. 打开扩展选项页，添加一条 `https://sourcegraph.com/github.com/{owner}/{repo}`，名称 Sourcegraph、说明「全局搜索」，确认预览正确
13. 回到已打开的仓库页，展开面板：自定义项应**立即**出现在内置 7 项之后，圆点为蓝色
14. 点击自定义项，核对新标签 URL 的 `{owner}` / `{repo}` 已被替换
15. 在选项页编辑该条并保存，回到仓库页确认面板同步更新；再删除该条，确认面板中消失
16. 添加一条模板为 `javascript:alert(1)` 的地址，确认表单报错、无法保存
17. 连续添加 8 条以上自定义地址，确认面板在视口内且可内部滚动（按钮贴近屏幕顶部与底部各试一次）