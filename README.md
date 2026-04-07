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
| Backend | NestJS · Fastify · TypeScript |
| Database | PostgreSQL 16 · Prisma ORM |
| Cache / Queue | Redis 7 · BullMQ |
| AI | DeepSeek Chat API |
| File Storage | MinIO (S3-compatible) |
| Voice (remote) | LiveKit |

---

## Prerequisites

- Node.js >= 18
- pnpm >= 9
- Docker & Docker Compose

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo-url>
cd x-thread
pnpm install
```

### 2. Configure environment

```bash
cp .env.example backend/.env
# Edit backend/.env — add your DEEPSEEK_API_KEY
```

### 3. Start infrastructure

```bash
docker-compose up -d
```

### 4. Run database migrations

```bash
pnpm --filter backend prisma:migrate
pnpm --filter backend prisma:generate
```

### 5. Start development servers

```bash
# Terminal 1 — Backend (http://localhost:3001)
pnpm dev:backend

# Terminal 2 — Frontend (http://localhost:5173)
pnpm dev:frontend
```

---

## Project Structure

```
x-thread/
├── frontend/          React + Vite app
│   └── src/
│       ├── pages/     HomePage · LobbyPage · IceBreakPage · DiscussPage · ReviewPage
│       ├── components/ MindMap · ChatPanel · VoicePanel · PetWidget
│       ├── stores/    useRoomStore · useMindMapStore · useChatStore
│       ├── hooks/     useSocket
│       └── lib/       api.ts (Axios)
├── backend/           NestJS app
│   └── src/
│       ├── modules/   auth · rooms · mindmap · chat · ai · pet
│       ├── gateways/  room.gateway.ts (Socket.IO)
│       └── prisma/    prisma.service.ts
├── docker-compose.yml postgres + redis + minio
├── .env.example
└── pnpm-workspace.yaml
```

---

## AI Logs

See `/ai-logs/` folder for prompts used in vibe coding (CPT208 requirement).
