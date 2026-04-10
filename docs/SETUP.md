# X-Thread 2.0 — 本地启动指南

## 前置要求

| 工具 | 最低版本 | 检查命令 |
|------|---------|----------|
| Node.js | 20+ | `node --version` |
| pnpm | 9+ | `pnpm --version` |
| Docker Desktop | 任意 | `docker --version` |

安装 pnpm（如果没有）：
```bash
npm install -g pnpm
```

---

## 第一步：安装依赖

在项目根目录执行（安装前后端所有依赖）：

```bash
cd x-thread
pnpm install
```

---

## 第二步：启动基础服务（PostgreSQL + Redis + MinIO）

```bash
docker compose up -d
```

验证三个容器都在运行：
```bash
docker compose ps
```

应看到 `xthread-postgres`、`xthread-redis`、`xthread-minio` 状态均为 `running`。

---

## 第三步：配置后端环境变量

`backend/.env` 已从 `.env.example` 复制，默认值可直接使用。

如需配置 AI 功能，编辑 `backend/.env`，填入 API Key：
```env
DEEPSEEK_API_KEY="sk-xxxxxx"
```

不填写也可以启动项目，但 AI 相关能力会返回占位提示或不可用。

---

## 第四步：初始化数据库

```bash
cd backend
npx prisma migrate dev --name init
```

执行成功后会看到：`Your database is now in sync with your schema.`

生成 Prisma Client：
```bash
npx prisma generate
```

回到根目录：
```bash
cd ..
```

---

## 第五步：启动后端

新开一个终端，在项目根目录执行：

```bash
pnpm dev:backend
```

看到如下输出表示启动成功：
```text
X-Thread backend running on http://localhost:3001
```

---

## 第六步：启动前端

再开一个终端，在项目根目录执行：

```bash
pnpm dev:frontend
```

看到如下输出表示启动成功：
```text
Local:   http://localhost:5173/
```

---

## 打开浏览器

访问：`http://localhost:5173`

### 快速测试流程

1. 输入昵称和议题，创建一个房间。
2. 复制 6 位房间码。
3. 另开一个浏览器标签页，使用不同身份加入房间。
4. 在大厅、破冰、讨论、复盘等页面验证流程是否正常。

---

## 常见问题

### 后端启动报 `connect ECONNREFUSED 127.0.0.1:5432`

数据库容器未运行，执行：
```bash
docker compose up -d
```

### `prisma migrate dev` 报认证错误

检查 `backend/.env` 中 `DATABASE_URL` 的用户名密码与 `docker-compose.yml` 一致：

- 用户名：`xthread`
- 密码：`xthread_dev`
- 数据库：`xthread`

### 前端白屏或接口 404

确认后端已启动在 `3001` 端口，Vite 代理会自动将 `/api` 和 `/socket.io` 转发到后端。

### Socket.IO 连接失败

前端连接到 `/room` namespace，确保后端已启动。在浏览器控制台看到 `Connected to WebSocket server` 表示正常。

---

## 停止所有服务

```bash
docker compose down
```

前后端开发服务器可直接使用 `Ctrl+C` 关闭。
