# X-Thread 2.0 — 本地启动完整指南（无 Docker）

## 需要安装的软件

### 1. Node.js 20+
已安装，跳过。

### 2. pnpm
已安装，跳过。

### 3. PostgreSQL 16

**下载地址：**
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

选择 **Windows x86-64，版本 16.x**，下载后运行安装程序。

安装时的关键配置：
- Password（超级用户密码）：`xthread_dev`
- Port：`5432`（默认，不要改）
- Stack Builder：**不勾选**，直接 Finish

安装完成后 PostgreSQL 服务会自动在后台运行，**无需每次手动启动**。

### 4. Redis（Memurai，Windows 原生兼容版）

**下载地址：**
https://www.memurai.com/get-memurai

点击 "Download Free" → 填写邮箱 → 下载 `.msi` 安装包，运行安装。

安装完成后 Memurai 作为 Windows 服务自动运行在 `6379` 端口，**无需每次手动启动**。

---

## 安装完成后的启动步骤

### 第一步：创建数据库

打开开始菜单，搜索 **SQL Shell (psql)**，打开后：

```
Server [localhost]:        ← 直接回车
Database [postgres]:       ← 直接回车
Port [5432]:               ← 直接回车
Username [postgres]:       ← 直接回车
Password for user postgres: xthread_dev
```

登录成功后执行以下命令（每行回车一次）：

```sql
CREATE DATABASE xthread;
CREATE USER xthread WITH PASSWORD 'xthread_dev';
GRANT ALL PRIVILEGES ON DATABASE xthread TO xthread;
\q
```

### 第二步：安装项目依赖

打开终端，进入项目目录：

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

执行成功后会看到：
```
Your database is now in sync with your schema.
```

### 第四步：启动后端

**开一个新终端**，在项目根目录执行：

```bash
cd E:/XJTLU/大三/CPT208/cw/x-thread
pnpm dev:backend
```

看到以下输出表示成功：
```
X-Thread backend running on http://localhost:3001
```

### 第五步：启动前端

**再开一个新终端**，在项目根目录执行：

```bash
cd E:/XJTLU/大三/CPT208/cw/x-thread
pnpm dev:frontend
```

看到以下输出表示成功：
```
Local:   http://localhost:5173/
```

### 第六步：打开浏览器

访问：**http://localhost:5173**

**快速测试流程：**
1. 输入昵称 + 议题，点击「立即创建」
2. 复制右上角的 6 位房间码
3. 另开一个浏览器标签，用不同昵称 + 房间码，点击「进入房间」
4. 两个标签都在 Lobby 后，点「开始讨论」进入讨论页

---

## 常见问题

### `prisma migrate dev` 报 `password authentication failed`
检查 `backend/.env` 中 DATABASE_URL：
```
DATABASE_URL="postgresql://xthread:xthread_dev@localhost:5432/xthread"
```
确认第一步 SQL 命令都执行成功了。

### `prisma migrate dev` 报 `database "xthread" does not exist`
重新打开 SQL Shell (psql) 执行：
```sql
CREATE DATABASE xthread;
GRANT ALL PRIVILEGES ON DATABASE xthread TO xthread;
\q
```

### 后端报 `connect ECONNREFUSED 127.0.0.1:6379`
Redis (Memurai) 没有运行。打开「服务」（Win+R 输入 `services.msc`），找到 **Memurai**，右键「启动」。

### 后端报 `nest: command not found` 或 `Cannot find module`
在 backend 目录重新安装依赖：
```bash
cd backend
npm install
cd ..
```

### 前端白屏 / 接口 404
确认后端在 `3001` 端口运行。Vite 会自动把 `/api` 和 `/socket.io` 代理到后端。

---

## 停止服务

前后端开发服务器：直接在终端按 `Ctrl+C`

PostgreSQL 和 Redis 作为系统服务运行，不需要手动停止。如需停止：
- Win+R → `services.msc` → 找到 **postgresql-x64-16** 和 **Memurai** → 右键停止
