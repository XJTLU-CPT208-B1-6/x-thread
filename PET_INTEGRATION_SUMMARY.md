# 🐾 X-Thread 宠物功能文件清单

## 📁 文件组织结构

所有宠物功能相关文件已完整放置在 `x-thread/` 文件夹中。

---

## 🖥️ 后端文件 (backend/)

### 1. 数据库层
| 文件 | 说明 |
|------|------|
| `prisma/schema.prisma` | 包含 Pet 模型定义 |
| `prisma/migrations/20260407075403_add_pet_model/migration.sql` | 宠物表迁移文件 |

### 2. 业务逻辑层
| 文件 | 说明 |
|------|------|
| `src/modules/pet/pet.module.ts` | 宠物模块定义 |
| `src/modules/pet/pet.service.ts` | 宠物服务实现 |
| `src/modules/pet/pet.controller.ts` | 宠物 API 控制器 |
| `src/modules/pet/dto/pet.dto.ts` | 宠物 DTO 定义 |
| `src/modules/pet/dto/index.ts` | DTO 导出 |

### 3. WebSocket 层
| 文件 | 说明 |
|------|------|
| `src/gateways/pet.gateway.ts` | 宠物实时同步网关 |
| `src/gateways/gateway.module.ts` | 网关模块（包含 PetGateway） |
| `src/app.module.ts` | 主应用模块（导入 PetModule） |

### 4. 测试文件
| 文件 | 说明 |
|------|------|
| `src/modules/pet/pet.service.spec.ts` | 服务单元测试 |
| `src/modules/pet/pet.service.pbt.spec.ts` | 服务 PBT 测试 |
| `src/modules/pet/pet.controller.spec.ts` | 控制器测试 |
| `src/modules/pet/dto/pet.dto.spec.ts` | DTO 测试 |
| `src/gateways/pet.gateway.spec.ts` | 网关单元测试 |
| `src/gateways/pet.gateway.property.spec.ts` | 网关属性测试 |
| `src/gateways/pet.gateway.integration.spec.ts` | 网关集成测试 |

---

## 🎨 前端文件 (frontend/)

### 1. 类型定义
| 文件 | 说明 |
|------|------|
| `src/types/pet.ts` | 宠物相关类型定义 |

### 2. 状态管理
| 文件 | 说明 |
|------|------|
| `src/stores/usePetStore.ts` | Zustand 宠物状态管理 |

### 3. API 服务
| 文件 | 说明 |
|------|------|
| `src/services/api-client.ts` | 包含 petService API 客户端 |

### 4. WebSocket 服务
| 文件 | 说明 |
|------|------|
| `src/services/socket-service.ts` | Socket.IO 服务（包含 pet-updated 事件监听） |

### 5. 工具类
| 文件 | 说明 |
|------|------|
| `src/utils/SpriteManager.ts` | 精灵图资源管理器 |
| `src/utils/PetStateMachine.ts` | 宠物状态机 |
| `src/utils/PositionStorage.ts` | 位置存储服务 |

### 6. 自定义 Hooks
| 文件 | 说明 |
|------|------|
| `src/hooks/useDraggable.ts` | 拖拽功能 Hook |
| `src/hooks/useRoomActivityMonitor.ts` | 房间活动监听 Hook |

### 7. React 组件
| 文件 | 说明 |
|------|------|
| `src/components/PetCanvas.tsx` | Canvas 渲染组件 |
| `src/components/FeedButton.tsx` | 喂食按钮组件 |
| `src/components/PetWidget.tsx` | 主宠物组件 |

### 8. 页面集成
| 文件 | 说明 |
|------|------|
| `src/pages/DiscussPage.tsx` | 讨论页（集成 PetWidget） |

### 9. 资源文件
| 文件 | 说明 |
|------|------|
| `public/assets/pets/README.md` | 精灵图资源说明 |
| `public/assets/pets/cat/` | 猫咪精灵图目录 |
| `public/assets/pets/dog/` | 狗狗精灵图目录 |

---

## 🔧 配置文件

| 文件 | 说明 |
|------|------|
| `backend/.env` | 后端环境变量配置 |
| `frontend/package.json` | 前端依赖配置 |
| `backend/package.json` | 后端依赖配置 |
| `docker-compose.yml` | Docker 服务配置 |

---

## ✅ 验证状态

- ✅ 所有文件已正确放置在 x-thread/ 目录下
- ✅ 所有引用路径正确
- ✅ TypeScript 编译通过（前端）
- ✅ TypeScript 编译通过（后端）
- ✅ 数据库迁移已应用
- ✅ Docker 容器正在运行
- ✅ 项目可以正常启动

---

## 🚀 启动项目

```bash
# 1. 确保 Docker 容器运行
docker compose up -d

# 2. 安装依赖
pnpm install

# 3. 启动项目
pnpm dev
```

访问：http://localhost:5173
