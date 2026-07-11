# 古董局中局·十二兽首 — 公网部署指南

代码已推送至：https://github.com/lhz202607/lhz

## 部署方案：Render 一体化部署（推荐，最简单）

只需部署一个服务，后端同时托管前端静态文件，无需分开部署。

### 步骤一：注册 Render 账号
1. 打开 https://render.com
2. 点击右上角「Sign Up」
3. 选择「GitHub」登录，授权 Render 访问你的 GitHub

### 步骤二：创建 Web Service
1. 登录后点击右上角「New +」→ 选择「Web Service」
2. 在「Build and deploy from a Git repository」页面：
   - 选择你刚授权的 GitHub 账号
   - 找到仓库 `lhz202607/lhz`，点击「Connect」
3. 填写服务配置：
   - **Name**：`antique-game`（或你喜欢的名字）
   - **Region**：选 `Singapore` 或 `Oregon`（离你最近的）
   - **Runtime**：`Node`
   - **Build Command**：
     ```
     pnpm install && cd frontend && pnpm install && pnpm build && cd ../backend && pnpm install && pnpm build
     ```
   - **Start Command**：
     ```
     node backend/dist/index.js
     ```
   - **Instance Type**：`Free`（免费套餐，够用）
4. 点击「Advanced」展开高级设置，添加环境变量：
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `*`
5. 点击页面底部「Create Web Service」

### 步骤三：等待部署完成
- Render 会自动拉取代码、安装依赖、构建、启动
- 部署过程约 3-5 分钟
- 部署成功后，Render 会给你一个公网 URL，类似：
  ```
  https://antique-game.onrender.com
  ```

### 步骤四：验证
- 打开上面的 URL，应该能看到游戏首页
- 点击「创建房间」，把 URL 和房间码分享给朋友
- 朋友打开同一个 URL，输入房间码加入

---

## 常见问题

### Q: 免费套餐会休眠吗？
A: Render 免费套餐在 15 分钟无请求后会休眠，首次访问需等 30 秒唤醒。如需常驻可升级付费套餐。

### Q: 部署失败怎么办？
A: 在 Render 控制台查看构建日志，常见问题：
- 依赖安装失败：检查 `package.json` 是否正确
- 构建失败：检查 TypeScript 编译错误
- 启动失败：检查环境变量是否设置

### Q: 如何更新代码？
A: 本地修改代码后 `git push`，Render 会自动重新部署。

---

## 技术架构说明

```
用户浏览器
    ↓ HTTPS
Render (Node.js 服务)
    ├── /api/* → Express 后端（游戏逻辑 + 房间管理）
    ├── /api/game/* → 游戏接口（创建/加入房间、鉴宝、押币等）
    └── /* → 前端静态文件（React SPA）
```

后端生产模式下自动托管 `frontend/dist` 目录，前后端同源，无跨域问题。
