# 古董局中局·十二兽首 — 部署指南

## 方案一：Vercel 部署（推荐，最简单）

### 1. 准备工作
- 注册 Vercel 账号（支持 GitHub/GitLab 登录）
- 将项目推送到 GitHub 仓库

### 2. 部署步骤
1. 访问 [vercel.com](https://vercel.com) 并登录
2. 点击 "Add New..." → "Project"
3. 选择你的 GitHub 仓库
4. 配置：
   - **Build Command**：`cd frontend && pnpm build`
   - **Output Directory**：`frontend/dist`
   - **Install Command**：`pnpm install`
5. 添加环境变量（如需）
6. 点击 "Deploy"

### 3. Vercel 配置文件（已生成 `vercel.json`）
见项目根目录 `vercel.json`。

### 4. 后端部署
Vercel 只托管前端静态文件。后端需单独部署：
- **Railway** / **Rende** / **Fly.io**（免费额度）
- 或使用 **腾讯云轻量应用服务器**

---

## 方案二：腾讯云部署

### 前端（静态托管）
使用 **腾讯云 COS + CDN**：
1. 构建：`cd frontend && pnpm build`
2. 将 `frontend/dist` 目录上传到 COS 存储桶
3. 开启 CDN 加速，绑定自定义域名

### 后端（Node.js 服务）
使用 **腾讯云 CVM** 或 **腾讯云 CloudBase 云函数**：
1. 安装 Node.js 18+
2. 上传 `backend/` 目录
3. 执行 `pnpm install && pnpm build`（若有 build 步骤）
4. 使用 `pm2` 守护进程：`pm2 start backend/dist/index.js --name antique-game`
5. 配置反向代理（Nginx）：
   ```nginx
   location /api/ {
     proxy_pass http://localhost:3000/;
   }
   ```

---

## 方案三：CloudStudio 内网穿透（临时测试）

若需让外部朋友访问当前 CloudStudio 环境中的服务：
1. 确认 `.cloudstudio` 中 `frontend` 端口为 `5173`（已暴露）
2. 访问 CloudStudio 的「预览」功能，获取公网 URL
3. 分享该 URL 即可（端口已通过代理暴露）

---

## 快速部署检查清单

- [ ] 前端 `pnpm build` 通过
- [ ] 后端 `pnpm start` 正常
- [ ] CORS 配置允许前端域名
- [ ] 环境变量（`NODE_ENV=production`）
- [ ] 域名 DNS 解析完成
