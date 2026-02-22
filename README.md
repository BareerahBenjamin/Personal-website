# Bareerah 的小屋

一个带有早期论坛复古风格的个人网站 / 博客系统  
使用 React + Vite + Tailwind CSS + Supabase 实现

![网站截图](https://qvpowobddnudxijvbgph.supabase.co/storage/v1/object/public/person/index.png)  

## 项目特色

- 经典 2000 年代 BBS 风格界面（Courier New 字体、灰蓝配色、立体边框）
- 支持 Markdown 渲染的博客文章（日志）
- 实时留言板 + 帖子独立评论区
- 真实浏览量统计（Supabase RPC 实现）
- 在线人数显示（Supabase Presence）
- 按标签动态筛选文章
- 管理员后台（新建 / 编辑 / 删除日志）
- 响应式布局，支持手机浏览
- 部署友好（Vercel / Netlify / Cloudflare Pages）

## 技术栈

- 前端框架：React 18 + Vite
- 样式：Tailwind CSS + 自定义复古样式
- Markdown 渲染：react-markdown + remark-gfm + rehype-raw + remark-breaks
- 后端 & 数据库：Supabase（PostgreSQL + Realtime + Presence + Storage）
- 部署平台：Vercel / Netlify / Cloudflare Pages
- 其他：localStorage 记住用户信息、useMemo 优化标签筛选

## 线上地址

- Vercel ：https://personal-website-ten-alpha-51.vercel.app/

## 项目结构
   ```bash
   bareerah-bbs/   
   ├── public/               # 静态资源   
   ├── src/   
   │   ├── App.jsx           # 主组件（全部逻辑在此）   
   │   ├── index.css         # Tailwind + 复古样式   
   │   └── main.jsx   
   ├── .env.example          # 环境变量模板   
   ├── vite.config.js   
   ├── tailwind.config.js   
   ├── postcss.config.js      
   └── README.md   
   ```

## 快速开始（本地开发）

1. 克隆仓库
   ```bash
   git clone https://github.com/BareerahBenjamin/bareerah-bbs.git
   cd bareerah-bbs
   ```

2. 安装依赖
   ```Bash
   npm install
   ```
3. 创建 .env 文件（复制 .env.example 并修改）
   ```text
   VITE_SUPABASE_URL=你的 Supabase 项目 URL
   VITE_SUPABASE_ANON_KEY=你的 anon public key
   VITE_ADMIN_PASSWORD=你的管理员密码（用于脚本文档中的 prompt 验证）
   ```
4. 启动开发服务器
   ```Bash
   npm run dev
   ```
   访问 http://localhost:5173
5. 构建生产版本
   ```Bash
   npm run build
   ```

## Supabase 表结构（参考）

- logs：文章表（id, title, content, date, tags[], views, created_at, updated_at）
- messages：全局留言板
- post_comments：每篇日志的评论（log_id, name, email, content, created_at）
- 函数：increment_views（用于浏览量 +1）

## 管理员功能

- 输入密码进入编辑模式（当前通过 footer 的小点 + prompt 触发）
- 支持新建、编辑、删除日志
- 建议：上线前改为更安全的认证方式（Supabase Auth 或 JWT）
