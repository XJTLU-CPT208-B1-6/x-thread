# AI Logs — X-Thread 2.0

This folder documents AI tool usage for CPT208 academic integrity compliance.

## Tools Used

- Claude Sonnet 4.6 (claude-sonnet-4-6) — Scaffold generation, architecture planning
- Cursor — Code editing assistance

## Log Entries

### 2025 — Initial Scaffold

**Prompt used:**
> 新建一个文件夹，然后开始搭建前后端脚手架，后端用NestJS+Fastify+Prisma+PostgreSQL+Redis+Socket.IO，前端用React 18+Vite+TypeScript+Tailwind+Zustand+@xyflow/react，Monorepo结构，根目录含docker-compose.yml

**Components generated:**
- `backend/` — NestJS app structure with modules: auth, rooms, mindmap, chat, ai
- `backend/src/gateways/room.gateway.ts` — Socket.IO gateway for real-time sync
- `backend/prisma/schema.prisma` — Data models: User, Room, RoomMember, MindMapNode, MindMapEdge, ChatMessage, AgendaItem
- `frontend/` — React + Vite app with pages, stores, hooks, lib
- `docker-compose.yml` — PostgreSQL 16 + Redis 7 + MinIO
- Root Monorepo config with pnpm workspace

**How code was verified:**
- Reviewed all generated files for correctness before use
- Confirmed module imports match NestJS v10 API
- Confirmed Prisma schema syntax against Prisma 5 docs
- Confirmed Vite proxy config for Socket.IO WebSocket upgrade

**Ethical considerations:**
- No user data is collected without consent; auth is JWT-based with user-controlled nicknames
- AI-extracted concepts are attributed to their original speaker
- No bias introduced — AI engine (DeepSeek) is used only for concept extraction, not evaluation of ideas
