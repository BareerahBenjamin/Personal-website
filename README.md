# 🐱 Bareerah 的小屋

> 一个赛博复古风个人网站 / 博客系统，灵感来自 2000 年代 BBS 论坛与 Win95 美学。

**线上地址**：https://bareerahsite.dpdns.org/

![进入动画](https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/person/Automation.png)
![网站截图](https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/person/intro.png)  

---

## ✨ 功能特色

**界面风格**
- 经典 Win95 / BBS 复古界面（Courier New 字体、灰蓝配色、立体像素边框）
- 首屏 56k 拨号连接进场动画（Win95 弹窗 + 终端逐行输出）
- CRT 扫描线纹理、标题闪烁、在线人数绿色指示灯等微动效
- 滚动进入渐显动画（IntersectionObserver）
- 响应式布局，支持手机浏览

**内容功能**
- Markdown 渲染博客日志（支持代码高亮、图片、表格）
- 按标签动态筛选文章
- 文章阅读时长估算 + 浏览量统计（Supabase RPC）
- 实时留言板（Supabase Realtime 推送）
- 留言 / 评论支持访客互相回复（树形结构）
- 帖子独立讨论区

**站长功能**
- 管理员后台（新建 / 编辑 / 删除日志）
- 站长回复留言并自动发送邮件通知（Supabase Edge Function + Resend）
- 在线人数实时显示（Supabase Presence）
- 浮动音乐播放器（支持播放列表、上下曲切换）

---

## 🛠 技术栈

| 分类 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite |
| 样式 | Tailwind CSS + 自定义复古 CSS |
| Markdown | react-markdown + remark-gfm + rehype-raw + remark-breaks |
| 后端 & 数据库 | Supabase（PostgreSQL + Realtime + Presence + Storage） |
| 邮件通知 | Supabase Edge Function + Resend API |
| 部署 | Vercel / Netlify / Cloudflare Pages |
| 其他 | localStorage 记住用户信息、useMemo 优化筛选、sessionStorage 控制进场动画 |

---

## 📁 项目结构

```bash
bareerah-bbs/
├── public/                          # 静态资源
├── src/
│   ├── App.jsx                      # 主组件（全部页面逻辑）
│   ├── Intro.jsx                    # 进场动画组件（56k 拨号风格）
│   ├── index.css                    # Tailwind + 复古样式 + 微动效
│   └── main.jsx
├── supabase/
│   └── functions/
│       └── send-reply-email/
│           └── index.ts             # 留言回复邮件通知 Edge Function
├── .env.example                     # 环境变量模板
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/BareerahBenjamin/bareerah-bbs.git
cd bareerah-bbs
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 并重命名为 `.env`，填入你的 Supabase 项目信息：

```text
VITE_SUPABASE_URL=你的 Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=你的 anon public key
VITE_ADMIN_PASSWORD=你的管理员密码
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 5. 构建生产版本

```bash
npm run build
```

---

## 🗄 Supabase 表结构

### `logs` — 博客文章表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| title | text | 文章标题 |
| content | text | Markdown 正文 |
| date | date | 发布日期 |
| tags | text[] | 标签数组 |
| views | int | 浏览量 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 最后编辑时间 |

### `message` — 全局留言板

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| name | text | 留言者昵称 |
| email | text | 邮箱（不公开） |
| content | text | 留言内容（支持 Markdown） |
| reply | text | 站长回复内容 |
| parent_id | uuid | 父留言 ID（访客互回） |
| time | timestamptz | 留言时间 |

### `post_comments` — 文章评论区

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| log_id | uuid | 关联文章 ID |
| name | text | 评论者昵称 |
| email | text | 邮箱（不公开） |
| content | text | 评论内容 |
| parent_id | uuid | 父评论 ID（访客互回） |
| created_at | timestamptz | 评论时间 |

### RPC 函数

```sql
-- 浏览量 +1（防止客户端并发竞争）
increment_views(post_id uuid)
```

---

## 📬 邮件通知部署（可选）

站长回复留言后自动发邮件通知访客，基于 Supabase Edge Function + Resend 实现。

### 部署 Edge Function

```bash
supabase functions deploy send-reply-email
```

### 在 Supabase Dashboard → Edge Functions → Secrets 中配置

```text
RESEND_API_KEY=re_xxxxxxxxxxxx
SITE_FROM_EMAIL=noreply@yourdomain.com   # 必须是 Resend 已验证的域名
SITE_NAME=Bareerah 的小屋
SITE_URL=https://bareerahsite.dpdns.org
```

---

## 🔐 管理员功能

点击页面底部版权区的 `.` 符号，输入管理员密码后进入管理模式，可以：

- 新建 / 编辑 / 删除博客日志
- 回复留言板留言并自动邮件通知访客
- 删除留言 / 评论（包含子回复）

管理员状态通过 `localStorage` 持久化，刷新页面不会退出。点击 `[退出管理员]` 手动注销。

---

## 🎨 设计细节

- **进场动画**：仿 Win95 弹窗 + 56k 拨号终端逐行输出，同一 tab 内只播放一次（`sessionStorage` 控制）
- **CRT 质感**：header 与个人简介卡片叠加扫描线纹理，模拟老式显示器效果
- **微动效**：标题随机闪烁、在线指示灯脉冲、头像外圈缓慢旋转、技术徽章悬停位移
- **联系方式**：升级为 Win95 窗口面板，悬停整行深蓝反转
- **滚动动画**：切换 tab 时版块从下方淡入（`IntersectionObserver`）

---

## 📦 主要依赖

```json
{
  "react": "^18",
  "vite": "^5",
  "tailwindcss": "^3",
  "@supabase/supabase-js": "^2.97",
  "react-markdown": "^9",
  "remark-gfm": "^4",
  "rehype-raw": "^7",
  "remark-breaks": "^4"
}
```

---

## 📄 License

MIT © 2026 [Bareerah Benjamin](https://github.com/BareerahBenjamin)
