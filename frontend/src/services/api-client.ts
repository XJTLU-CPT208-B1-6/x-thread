import axios from 'axios';
import { AccountProfile, getStoredAuthToken } from '../lib/auth';
import { SharedFile, SharedFileTree, SharedFolder } from '../types/shared-file';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const buildQueryParams = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
};

export type MindMapApiNodeType = 'IDEA' | 'QUESTION' | 'FACT' | 'ACTION';
export type AiProvider =
  | 'deepseek'
  | 'kimi'
  | 'qwen'
  | 'glm'
  | 'modelscope'
  | 'openai-compatible';

export type AiProviderSettings = {
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

export type AiConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AuthSession = {
  accessToken: string;
  user: AccountProfile;
};

export type AccountOverviewRoom = {
  roomId: string;
  code: string;
  topic: string;
  phase: string;
  mode: 'ONSITE' | 'REMOTE';
  role: string;
  status: string;
  joinedAt: string;
  lastSeenAt: string;
  leftAt: string | null;
  memberCount: number;
  maxMembers: number;
  roomCreatedAt: string;
  roomUpdatedAt: string;
};

export type AccountOverview = {
  user: AccountProfile;
  aiSettings: {
    provider: AiProvider;
    model: string;
    hasApiKey: boolean;
  };
  activeRooms: AccountOverviewRoom[];
  roomHistory: AccountOverviewRoom[];
};

export type AiSelectedFile = Pick<SharedFile, 'id' | 'filename' | 'mimeType'>;
export type AiMindMapStyle = 'balanced' | 'debate' | 'strategy' | 'study';
export type AiMindMapStructure = 'hierarchy' | 'radial' | 'timeline' | 'compare';
export type AiMindMapContextOptions = {
  includeChatHistory?: boolean;
  selectedFiles?: AiSelectedFile[];
};
export type AiMindMapGenerationOptions = AiMindMapContextOptions & {
  style?: AiMindMapStyle;
  structure?: AiMindMapStructure;
};

type HistoryAccessOptions = {
  history?: boolean;
};

type ChatQueryOptions = HistoryAccessOptions & {
  take?: number;
  query?: string;
  from?: string;
  to?: string;
};

export type MindMapApiNode = {
  id: string;
  label: string;
  type: MindMapApiNodeType;
  posX: number;
  posY: number;
  authorId: string;
  author?: {
    id: string;
    nickname: string;
    avatar?: string | null;
  } | null;
};

export type MindMapApiEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string | null;
};

export type MindMapSnapshotPayload = {
  nodes?: Array<{
    id: string;
    label: string;
    type?: MindMapApiNodeType;
    posX?: number;
    posY?: number;
    authorId?: string;
  }>;
  edges?: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    label?: string;
  }>;
};

export type WhiteboardSnapshot = {
  roomId: string;
  contentHtml: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByNickname: string | null;
};

export const authService = {
  register: async (payload: {
    account: string;
    nickname: string;
    password: string;
  }) => {
    const response = await api.post('/auth/register', payload);
    return response.data as AuthSession;
  },
  login: async (payload: { account: string; password: string }) => {
    const response = await api.post('/auth/login', payload);
    return response.data as AuthSession;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data as { user: AccountProfile };
  },
};

export const accountService = {
  getOverview: async () => {
    const response = await api.get('/account/overview');
    return response.data as AccountOverview;
  },
  updateProfile: async (payload: {
    nickname?: string;
    realName?: string;
    xjtluEmail?: string;
    avatarDataUrl?: string;
    clearAvatar?: boolean;
  }) => {
    const response = await api.put('/account/profile', payload);
    return response.data as { user: AccountProfile };
  },
  cancelAccount: async () => {
    const response = await api.post('/account/cancel');
    return response.data as { ok: boolean };
  },
  getAiSettings: async () => {
    const response = await api.get('/account/ai-settings');
    return response.data as AiProviderSettings;
  },
  updateAiSettings: async (settings: AiProviderSettings) => {
    const response = await api.put('/account/ai-settings', settings);
    return response.data as { settings: AiProviderSettings };
  },
};

export const roomService = {
  createRoom: async (data: { topic: string; mode?: 'ONSITE' | 'REMOTE'; maxMembers?: number; tags?: string[] }) => {
    const response = await api.post('/rooms', data);
    return response.data as { room: any };
  },
  listLobby: async () => {
    const response = await api.get('/rooms/lobby');
    return response.data as any[];
  },
  toggleLock: async (id: string) => {
    const response = await api.post(`/rooms/${id}/lock`);
    return response.data as { room: any };
  },
  updateRoom: async (id: string, dto: { topic?: string; tags?: string[]; maxMembers?: number; isLocked?: boolean }) => {
    const response = await api.patch(`/rooms/${id}`, dto);
    return response.data as { room: any };
  },
  joinRoom: async (code: string) => {
    const response = await api.post('/rooms/join', { code });
    return response.data as { room: any };
  },
  getRoom: async (id: string, options?: HistoryAccessOptions) => {
    const response = await api.get(
      `/rooms/${id}${buildQueryParams({ history: options?.history })}`,
    );
    return response.data;
  },
  getRoomByCode: async (code: string, options?: HistoryAccessOptions) => {
    const response = await api.get(
      `/rooms/code/${code}${buildQueryParams({ history: options?.history })}`,
    );
    return response.data;
  },
  leaveRoom: async (id: string) => {
    const response = await api.post(`/rooms/${id}/leave`);
    return response.data as { ok: boolean; leftAt: string };
  },
  dissolveRoom: async (id: string) => {
    const response = await api.post(`/rooms/${id}/dissolve`);
    return response.data as {
      ok: boolean;
      roomId: string;
      code: string;
      topic: string;
      dissolvedAt: string;
    };
  },
};

export const chatService = {
  getMessages: async (roomId: string, options?: ChatQueryOptions) => {
    const response = await api.get(
      `/rooms/${roomId}/chat${buildQueryParams({
        take: options?.take,
        query: options?.query,
        from: options?.from,
        to: options?.to,
        history: options?.history,
      })}`,
    );
    return response.data;
  },
};

export const mindMapService = {
  getMap: async (roomId: string, options?: HistoryAccessOptions) => {
    const response = await api.get(
      `/rooms/${roomId}/mindmap${buildQueryParams({ history: options?.history })}`,
    );
    return response.data as { nodes?: MindMapApiNode[]; edges?: MindMapApiEdge[] } | null;
  },
  createNode: async (
    roomId: string,
    payload: { label: string; type?: MindMapApiNodeType; posX?: number; posY?: number },
  ) => {
    const response = await api.post(`/rooms/${roomId}/mindmap/nodes`, payload);
    return response.data as MindMapApiNode;
  },
  updateNode: async (
    roomId: string,
    nodeId: string,
    payload: { label?: string; type?: MindMapApiNodeType; posX?: number; posY?: number },
  ) => {
    const response = await api.patch(`/rooms/${roomId}/mindmap/nodes/${nodeId}`, payload);
    return response.data as MindMapApiNode;
  },
  deleteNode: async (roomId: string, nodeId: string) => {
    const response = await api.delete(`/rooms/${roomId}/mindmap/nodes/${nodeId}`);
    return response.data;
  },
  createEdge: async (
    roomId: string,
    payload: { sourceId: string; targetId: string; label?: string },
  ) => {
    const response = await api.post(`/rooms/${roomId}/mindmap/edges`, payload);
    return response.data as MindMapApiEdge;
  },
  deleteEdge: async (roomId: string, edgeId: string) => {
    const response = await api.delete(`/rooms/${roomId}/mindmap/edges/${edgeId}`);
    return response.data;
  },
  replaceSnapshot: async (roomId: string, payload: MindMapSnapshotPayload) => {
    const response = await api.put(`/rooms/${roomId}/mindmap/snapshot`, payload);
    return response.data as { nodes?: MindMapApiNode[]; edges?: MindMapApiEdge[] } | null;
  },
};

export const roomAiService = {
  askQuestion: async (
    roomId: string,
    message: string,
    history: AiConversationMessage[],
    selectedFiles: AiSelectedFile[],
    settings?: AiProviderSettings,
  ) => {
    const response = await api.post(`/ai/rooms/${roomId}/qa`, {
      message,
      history,
      selectedFiles,
      provider: settings?.provider,
      apiKey: settings?.apiKey,
      baseUrl: settings?.baseUrl,
      model: settings?.model,
    });
    return response.data as { answer: string };
  },
  testConnection: async (settings: AiProviderSettings) => {
    const response = await api.post('/ai/test-connection', {
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
    });
    return response.data as { ok: boolean; provider: AiProvider; model: string; message: string };
  },
  fetchModels: async (settings: AiProviderSettings) => {
    const response = await api.post('/ai/models', {
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
    });
    return response.data as { provider: AiProvider; baseUrl: string; models: string[] };
  },
  generateMindMap: async (
    roomId: string,
    options?: AiMindMapGenerationOptions,
    settings?: AiProviderSettings,
  ) => {
    const response = await api.post(`/ai/rooms/${roomId}/generate-mindmap`, {
      includeChatHistory: options?.includeChatHistory,
      selectedFiles: options?.selectedFiles,
      style: options?.style,
      structure: options?.structure,
      provider: settings?.provider,
      apiKey: settings?.apiKey,
      baseUrl: settings?.baseUrl,
      model: settings?.model,
    });
    return response.data as {
      nodes: Array<{ id: string; label: string; type: string }>;
      edges: Array<{ sourceId: string; targetId: string; label: string }>;
    };
  },
  expandNode: async (
    roomId: string,
    nodeLabel: string,
    existingLabels: string[],
    settings?: AiProviderSettings,
  ) => {
    const response = await api.post(`/ai/rooms/${roomId}/expand-node`, {
      nodeLabel,
      existingLabels,
      provider: settings?.provider,
      apiKey: settings?.apiKey,
      baseUrl: settings?.baseUrl,
      model: settings?.model,
    });
    return response.data as {
      nodes: Array<{ label: string; type: string }>;
      edges: Array<{ label: string }>;
    };
  },
  optimizeMindMap: async (
    roomId: string,
    nodes: Array<{ id: string; label: string; type: string }>,
    edges: Array<{ id: string; sourceId: string; targetId: string; label?: string }>,
    options?: AiMindMapContextOptions,
    settings?: AiProviderSettings,
  ) => {
    const response = await api.post(`/ai/rooms/${roomId}/optimize-mindmap`, {
      nodes,
      edges,
      includeChatHistory: options?.includeChatHistory,
      selectedFiles: options?.selectedFiles,
      provider: settings?.provider,
      apiKey: settings?.apiKey,
      baseUrl: settings?.baseUrl,
      model: settings?.model,
    });
    return response.data as {
      nodes: Array<{ id: string; label: string; type: string }>;
      edges: Array<{ sourceId: string; targetId: string; label: string }>;
    };
  },
};

export const whiteboardService = {
  getBoard: async (roomId: string, options?: HistoryAccessOptions) => {
    const response = await api.get(
      `/rooms/${roomId}/whiteboard${buildQueryParams({ history: options?.history })}`,
    );
    return response.data as WhiteboardSnapshot;
  },
  saveBoard: async (roomId: string, contentHtml: string) => {
    const response = await api.put(`/rooms/${roomId}/whiteboard`, { contentHtml });
    return response.data as WhiteboardSnapshot;
  },
};

export const sharedFileService = {
  listFiles: async (roomId: string, options?: HistoryAccessOptions) => {
    const response = await api.get(
      `/rooms/${roomId}/files${buildQueryParams({ history: options?.history })}`,
    );
    return response.data as SharedFileTree;
  },
  createFolder: async (
    roomId: string,
    payload: { name: string; parentId?: string | null },
  ) => {
    const response = await api.post(`/rooms/${roomId}/files/folders`, payload);
    return response.data as SharedFolder;
  },
  renameFolder: async (
    roomId: string,
    folderId: string,
    payload: { name: string },
  ) => {
    const response = await api.patch(`/rooms/${roomId}/files/folders/${folderId}`, payload);
    return response.data as SharedFolder;
  },
  uploadFile: async (
    roomId: string,
    payload: { filename: string; mimeType?: string; dataBase64: string; folderId?: string | null },
  ) => {
    const response = await api.post(`/rooms/${roomId}/files`, payload);
    return response.data as SharedFile;
  },
  downloadFile: async (roomId: string, fileId: string, options?: HistoryAccessOptions) => {
    const response = await api.get(
      `/rooms/${roomId}/files/${fileId}/download${buildQueryParams({
        history: options?.history,
      })}`,
      {
      responseType: 'blob',
      },
    );
    return response.data as Blob;
  },
};

export default api;

export const adminService = {
  listRooms: async () => {
    const response = await api.get('/admin/rooms');
    return response.data as any[];
  },
  forceDissolve: async (roomId: string) => {
    const response = await api.post(`/admin/rooms/${roomId}/dissolve`);
    return response.data as { ok: boolean; roomId: string; topic: string };
  },
  forceDelete: async (roomId: string) => {
    const response = await api.delete(`/admin/rooms/${roomId}`);
    return response.data as { ok: boolean; roomId: string; topic: string };
  },
};
