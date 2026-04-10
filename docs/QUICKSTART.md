# X-Thread 2.0 启动指南

## 方式一：使用启动脚本（推荐）

在项目根目录运行：

```bash
# 首先安装依赖（如果还没安装）
pnpm install

# 启动前端和后端
pnpm dev
```

## 方式二：使用 PowerShell 脚本

```powershell
.\start-dev.ps1
```

## 方式三：分别启动（在不同终端）

### 终端 1 - 启动后端
```bash
cd backend
pnpm dev
```

### 终端 2 - 启动前端
```bash
cd frontend
pnpm dev
```

## 前置条件

确保已启动 Docker 容器：
```bash
docker compose up -d
```

## 访问地址

- 前端: http://localhost:5173
- 后端: http://localhost:3001

