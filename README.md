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

## 快速开始（本地开发）

1. 克隆仓库
   ```bash
   git clone https://github.com/BareerahBenjamin/bareerah-bbs.git
   cd bareerah-bbs
