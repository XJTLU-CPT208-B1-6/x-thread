# X-Thread 2.0 — 本地启动完整指南（无 Docker）

## 需要安装的软件

### 1. Node.js 20+

确保本机已安装 Node.js 20 或更高版本。

### 2. pnpm

确保已安装 pnpm。

### 3. PostgreSQL 16

下载地址：
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

安装时建议使用如下配置：

- Password：`xthread_dev`
- Port：`5432`

### 4. Redis（Windows 可使用 Memurai）

下载地址：
https://www.memurai.com/get-memurai

安装完成后，Redis 兼容服务应运行在 `6379` 端口。

---

## 启动步骤

### 第一步：创建数据库

使用 `psql` 或其他 PostgreSQL 客户端执行：

```sql
CREATE DATABASE xthread;
CREATE USER xthread WITH PASSWORD 'xthread_dev';
GRANT ALL PRIVILEGES ON DATABASE xthread TO xthread;
```

### 第二步：安装项目依赖

```bash
cd E:/XJTLU/大三/CPT208/cw/x-thread
pnpm install
```

### 第三步：初始化数据库表

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

### 第四步：启动后端

```bash
cd E:/XJTLU/大三/CPT208/cw/x-thread
pnpm dev:backend
```

### 第五步：启动前端

```bash
cd E:/XJTLU/大三/CPT208/cw/x-thread
pnpm dev:frontend
```

### 第六步：打开浏览器

访问：`http://localhost:5173`

---

## 常见问题

### `prisma migrate dev` 报 `password authentication failed`

检查 `backend/.env` 中的 `DATABASE_URL`：

```env
DATABASE_URL="postgresql://xthread:xthread_dev@localhost:5432/xthread"
```

### `prisma migrate dev` 报 `database "xthread" does not exist`

重新执行数据库创建命令并确认权限已授予。

### 后端报 `connect ECONNREFUSED 127.0.0.1:6379`

说明 Redis 服务未启动，请确认本地 Redis / Memurai 正常运行。

### 前端白屏或接口 404

确认后端服务运行在 `3001` 端口，Vite 会自动将 `/api` 和 `/socket.io` 代理到后端。

---

## 停止服务

- 前后端开发服务器：在终端按 `Ctrl+C`
- PostgreSQL 和 Redis：按系统服务方式停止
