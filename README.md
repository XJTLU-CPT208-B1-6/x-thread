# X-Thread 2.0 — 西浦学术语丝

> 语音驱动 + AI 实时思维导图 + 电子宠物伴侣的西浦专属组局讨论平台

CPT208 Human-Centric Computing | Topic B1: XJTLU Group Discussions

---

## ✨ 核心功能

| 功能 | 描述 |
|------|------|
| 🎙️ 语音驱动 | 支持语音实时交流，多种说话模式 |
| 🧠 AI 实时思维导图 | 基于讨论自动生成和更新思维导图 |
| 🐾 电子宠物 | 像素风格宠物，互动、喂食、状态变化 |
| 💬 AI 对话助手 | 深度思考问题，生成会议摘要，破冰 |
| 📁 文件共享 | 支持上传、下载、管理共享文件 |
| 📝 文字白板 | 实时协作文字白板 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 · Vite 5 · TypeScript · Tailwind CSS |
| State | Zustand · React Router v6 |
| Mind Map | @xyflow/react |
| Animation | Framer Motion |
| Real-time | Socket.IO client |
| Canvas | HTML5 Canvas (宠物渲染) |
| Backend | NestJS · Fastify · TypeScript |
| Database | PostgreSQL 16 · Prisma ORM |
| Cache / Queue | Redis 7 · BullMQ |
| AI | DeepSeek Chat API |
| File Storage | MinIO (S3-compatible) |
| Voice (remote) | LiveKit |

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

---

## Quick Start

### 方式一：一键启动（推荐）

```bash
# 1. 确保 Docker 容器运行
docker compose up -d

# 2. 安装依赖
pnpm install

# 3. 启动项目（前端 + 后端）
pnpm dev
```

### 方式二：分别启动

```bash
# 1. Clone & install
git clone <repo-url>
cd x-thread
pnpm install

# 2. Configure environment
cp .env.example backend/.env
# Edit backend/.env — add your DEEPSEEK_API_KEY

# 3. Start infrastructure
docker compose up -d

# 4. Run database migrations
cd backend
npx prisma migrate deploy
npx prisma generate
cd ..

# 5. Start development servers
# Terminal 1 — Backend (http://localhost:3001)
pnpm dev:backend

# Terminal 2 — Frontend (http://localhost:5173)
pnpm dev:frontend
```

---

## 访问地址

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3001

---

## Project Structure

```
x-thread/
├── frontend/          React + Vite app
│   └── src/
│       ├── pages/     HomeWorkspacePage · LobbyPageV2 · IceBreakPage · DiscussPageV2 · ReviewPage
│       ├── components/ MindMap · AiQaPanel · VoicePanel · PetWidget · PetCanvas · FeedButton
│       ├── stores/    useRoomStore · useMindMapStore · useChatStore · usePetStore
│       ├── hooks/     useSocket · useDraggable · useRoomActivityMonitor
│       ├── utils/     SpriteManager · PetStateMachine · PositionStorage
│       └── lib/       api.ts (Axios)
├── backend/           NestJS app
│   └── src/
│       ├── modules/   auth · rooms · mindmap · chat · ai · pet · account · admin
│       ├── gateways/  room.gateway.ts · pet.gateway.ts (Socket.IO)
│       └── prisma/    prisma.service.ts
├── docker-compose.yml postgres + redis + minio
├── .env.example
├── pnpm-workspace.yaml
└── [文档文件]
```

---

## 🐾 电子宠物功能

### 功能特点

- **像素风格渲染** - 使用 Canvas 2D 渲染，支持像素化效果
- **多状态动画** - idle（空闲）、happy（开心）、busy（忙碌）、hungry（饥饿）、reaction（互动）
- **拖拽功能** - 支持鼠标拖拽宠物到任意位置
- **位置持久化** - 使用 localStorage 保存位置
- **喂食系统** - 喂食按钮，冷却 60 秒，增加 20 能量
- **活动监听** - 监听房间活动自动改变宠物状态
- **实时同步** - WebSocket 多端状态同步

### 资源文件

宠物精灵图存放在：`frontend/public/assets/pets/`

```
assets/pets/
├── cat/
│   ├── idle.png      # 空闲状态
│   ├── happy.png     # 开心状态
│   ├── busy.png      # 忙碌状态
│   ├── hungry.png    # 饥饿状态
│   └── reaction.png  # 互动反应
└── dog/
    ├── idle.png
    ├── happy.png
    ├── busy.png
    ├── hungry.png
    └── reaction.png
```

**精灵图规格**: 512×128 像素（每帧 128×128，共 4 帧），PNG 格式

---

## AI Logs

See `/ai-logs/` folder for prompts used in vibe coding (CPT208 requirement).

---

## 📚 相关文档

- [快速启动指南](QUICKSTART.md)
- [本地环境配置](SETUP_LOCAL.md)
- [宠物功能整合文档](PET_INTEGRATION_SUMMARY.md)
- [项目整理报告](PROJECT_ORGANIZATION_REPORT.md)
