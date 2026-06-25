# 项目展示 + 复古交互优化 设计文档

## 概述

为 Bareerah 的小屋网站新增两个功能模块：
1. **项目展示区** — 在「个人简介」tab 底部展示开源项目，Win95 窗口风格卡片
2. **复古微动效 & 趣味彩蛋** — 增强全站的 BBS/Win95 沉浸感

## Part 1：项目展示区

### 位置

在「个人简介」tab 的「联系方式」卡片下方新增，作为"关于我"的自然延伸。不新增 tab。

### 数据结构

Supabase 新增 `projects` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键，默认 `gen_random_uuid()` |
| name | text | 项目名称 |
| description | text | 简介（纯文本，简短） |
| tech_stack | text[] | 技术栈标签数组 |
| github_url | text | GitHub 仓库链接 |
| demo_url | text | 线上演示链接（可为空） |
| cover_url | text | 封面图 URL（Supabase Storage） |
| sort_order | int | 排序权重（数值越小越靠前） |
| created_at | timestamptz | 创建时间，默认 `now()` |

### 卡片设计

每张卡片是一个 Win95 窗口风格容器：

- **标题栏**：`bg-[#000080] text-white`，左侧项目名，右侧 `_ □ ×` 装饰按钮（复用现有 `.titlebar-btn` 样式）
- **封面图**：标题栏下方，`border-2 border-black shadow-[2px_2px_0_#000]`，`object-cover` 固定高度
- **内容区**：简介文字 + 技术栈彩色徽章（复用现有 `tech-badge` 样式，`px-3 py-1 text-xs font-bold border-2 border-black shadow-[2px_2px_0_#000]`）
- **底部链接**：GitHub 和 Demo 按钮，用 `bg-[#c0c0c0] border-2 border-black shadow-[2px_2px_0_#000]` 的 Win95 按钮风格，hover 时 `translate` 按下效果

### 布局

- 外层：Win95 窗口容器，标题栏 `📂 项目展示 / Projects`
- 内部：`grid grid-cols-1 md:grid-cols-2 gap-6`
- 卡片 hover：复用 `.post-card` 的 `translate(-2px, -2px)` + 加深阴影效果

### 管理功能

管理员模式下：
- 项目展示区顶部出现 `[+ 添加项目]` 按钮
- 点击后弹出内联表单（和博客编辑器风格一致）：标题、简介、技术栈（逗号分隔）、GitHub URL、Demo URL、封面图 URL、排序权重
- 每张卡片右上角显示 `[编辑]` `[删除]` 按钮
- CRUD 操作直接调用 Supabase client

### 数据流

```
App.jsx
├── useEffect: supabase.from('projects').select('*').order('sort_order')
├── state: projects, editingProject, newProjectMode
├── handleSaveProject() → supabase.from('projects').insert/update
├── handleDeleteProject() → supabase.from('projects').delete
└── 渲染: 个人简介 tab 底部，内联 JSX（和现有各 tab 渲染方式一致）
```

## Part 2：复古微动效 & 趣味彩蛋

### 2a. 全局点击像素涟漪

在页面任意位置点击时，在点击坐标处产生一个像素爆炸效果。

**实现：**
- 在 `App.jsx` 的最外层 `<div>` 上添加 `onClick` 处理
- 动态创建一个 `<span>` 元素，定位在点击坐标处（`position: fixed`）
- 使用 CSS `@keyframes pixel-ripple`：从小到大扩散，opacity 从 1 到 0，持续 400ms
- 动画结束后移除 DOM 节点
- 样式：8×8px 的小方块，颜色随机从 `[#000080, #00cc44, #ff0000, #ffcc00]` 中选取

**CSS：**
```css
@keyframes pixel-ripple {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(3); opacity: 0; }
}
.pixel-burst {
  position: fixed;
  width: 8px;
  height: 8px;
  pointer-events: none;
  z-index: 9999;
  animation: pixel-ripple 0.4s ease-out forwards;
}
```

### 2b. Tab 切换滑动过渡

当前 tab 切换是瞬间替换。改进为带方向感的淡入淡出。

**实现：**
- 内容区包裹一个 `<div className="tab-content">`，添加 CSS transition
- 切换时：新内容从下方滑入 + 淡入，持续 300ms
- 使用短时长 + `ease-out` 保持轻快感（不做苹果式丝滑过渡）
- 用 `useState` 追踪动画状态，配合 CSS class 切换

**CSS：**
```css
.tab-content {
  transition: opacity 0.25s ease-out, transform 0.3s ease-out;
}
.tab-content.entering {
  opacity: 0;
  transform: translateY(12px);
}
.tab-content.active {
  opacity: 1;
  transform: translateY(0);
}
```

### 2c. 表单提交终端反馈

留言/评论提交成功后，用终端风格反馈替代 `alert`。

**实现：**
- 新增 `TerminalFeedback` 内联组件（在 App.jsx 内定义，和 `VisitorReplyForm` 同级）
- 接收 `message` 和 `visible` props
- 显示在表单上方，黑底绿字（`#00cc44`），Courier New 字体
- 文字逐字出现（打字机效果），使用 `setInterval` 每 30ms 显示一个字符
- 自动显示时间戳：`> TIMESTAMP: YYYY-MM-DD HH:MM:SS`
- 2 秒后自动淡出消失

**样式：**
```
┌──────────────────────────────────────┐
│ > MESSAGE SENT SUCCESSFULLY ✓        │
│ > TIMESTAMP: 2026-06-25 17:30:22     │
└──────────────────────────────────────┘
```
- `bg-black text-[#00cc44] font-bbs text-xs p-3 border border-[#00cc44]`

### 2d. 导航栏走马灯

在导航栏右侧显示最近一篇日志标题的滚动文字。

**实现：**
- 读取 `posts[0]?.title`（已有的最新日志数据）
- 用 CSS `@keyframes marquee` 实现横向无限滚动
- 样式：`text-[10px] text-yellow-300`，最大宽度 200px，`overflow: hidden`
- 仅在有日志数据时显示

**CSS：**
```css
@keyframes marquee {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.nav-marquee {
  animation: marquee 15s linear infinite;
}
```

### 2e. 页脚复古装饰线

页脚版权信息上方加一条像素风格分隔线。

**实现：**
- 在 `<footer>` 内容顶部插入一个 `<div>`
- 使用 CSS 渐变模拟点阵图案：
```css
.footer-pixel-line {
  height: 4px;
  background: repeating-linear-gradient(
    90deg,
    #808080 0px, #808080 4px,
    transparent 4px, transparent 8px
  );
}
```

### 2f. 隐藏彩蛋：猫咪连击

首页的 🐱 emoji 可点击，连续快速点击 5 次触发彩蛋。

**实现：**
- 在首页欢迎区的 🐱 emoji 上添加点击事件
- 用 `useRef` 记录点击时间戳数组，判断 2 秒内是否达到 5 次
- 触发后：
  - 🐱 emoji 放大（`scale(2)`）并弹跳（`bounce` keyframes）
  - 周围出现 6 个 🐟 emoji 从中心向四周飞散
  - 底部终端文字：`> CHEAT CODE ACTIVATED: +9 LIVES`（绿色，打字机效果）
- 3 秒后所有元素恢复正常

## 不做的事情

- 不新增 tab，项目展示放在个人简介里
- 不引入新的 npm 依赖，所有动效用 CSS + 原生 JS 实现
- 不改变现有的 Supabase 表结构（只新增 `projects` 表）
- 不做鼠标跟随特效（过于干扰）
- 不做音效反馈（浏览器 autoplay 限制多）
