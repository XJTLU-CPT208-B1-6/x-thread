import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MindMap } from '../components/MindMap';
import { PetWidget } from '../components/PetWidget';
import { VoicePanel } from '../components/VoicePanel';
import { useSocket } from '../hooks/useSocket';
import { chatService, mindMapService, roomService } from '../services/api-client';
import { useChatStore } from '../stores/useChatStore';
import { useMindMapStore } from '../stores/useMindMapStore';
import { useRoomStore } from '../stores/useRoomStore';
import { MindMapEdge, MindMapNode } from '../types/mindmap';
import { ChatMessage } from '../types/socket-events';

type BackendMindMapNode = {
  id: string;
  label: string;
  posX: number;
  posY: number;
  authorId: string;
  author?: {
    id: string;
    nickname: string;
    avatar?: string | null;
  } | null;
};

type BackendMindMapEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string | null;
};

type MindMapResponse = {
  nodes?: BackendMindMapNode[];
  edges?: BackendMindMapEdge[];
} | null;

const buildSeedNode = (topic: string): MindMapNode => ({
  id: 'room-topic',
  type: 'customEntity',
  position: { x: 320, y: 160 },
  draggable: false,
  data: {
    keywordZh: topic,
    keywordEn: '',
    authorUid: 'system',
    status: 'active',
    isCenter: true,
  },
});

const mapMindMapNodes = (nodes: BackendMindMapNode[], topic: string): MindMapNode[] => {
  if (nodes.length === 0) {
    return [buildSeedNode(topic)];
  }

  return nodes.map((node, index) => ({
    id: node.id,
    type: 'customEntity',
    position: { x: node.posX ?? 0, y: node.posY ?? 0 },
    data: {
      keywordZh: node.label,
      keywordEn: '',
      authorUid: node.authorId,
      authorAvatar: node.author?.avatar ?? undefined,
      status: 'active',
      isCenter: index === 0,
    },
  }));
};

const mapMindMapEdges = (edges: BackendMindMapEdge[]): MindMapEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.label ?? undefined,
    data: {
      relationLabel: edge.label ?? '',
      aiGenerated: true,
    },
  }));

const normalizeMessages = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((message) => ({
    ...message,
    msgType:
      message.type === 'SYSTEM'
        ? 'system'
        : message.type === 'VOICE_TRANSCRIPT'
          ? 'ai_notify'
          : 'text',
  }));

export default function DiscussPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentRoom, setRoom } = useRoomStore();
  const { messages, setMessages, clear: clearMessages } = useChatStore();
  const { setNodes, setEdges, clear: clearMindMap } = useMindMapStore();

  useSocket(currentRoom?.id);

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    let cancelled = false;

    const loadDiscussionRoom = async () => {
      try {
        clearMessages();
        clearMindMap();

        const room = await roomService.getRoomByCode(code);
        if (cancelled) {
          return;
        }

        setRoom(room);

        const [history, map] = await Promise.all([
          chatService.getMessages(room.id) as Promise<ChatMessage[]>,
          mindMapService.getMap(room.id) as Promise<MindMapResponse>,
        ]);

        if (cancelled) {
          return;
        }

        setMessages(normalizeMessages(history));
        setNodes(mapMindMapNodes(map?.nodes ?? [], room.topic));
        setEdges(mapMindMapEdges(map?.edges ?? []));
      } catch (error) {
        console.error('Failed to load discussion room:', error);
        navigate('/');
      }
    };

    loadDiscussionRoom();

    return () => {
      cancelled = true;
    };
  }, [code, navigate, setRoom, setMessages, setNodes, setEdges, clearMessages, clearMindMap]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <div className="relative z-10 flex w-80 flex-col border-r border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 p-4 font-semibold text-gray-700">
          <span>讨论群聊</span>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">{code}</span>
        </div>

        <div className="flex-grow space-y-3 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.msgType === 'ai_notify' ? 'items-center' : 'items-start'}`}>
              {msg.msgType === 'ai_notify' ? (
                <div className="max-w-xs rounded-full bg-yellow-100 px-3 py-1 text-center text-xs text-yellow-800 shadow-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="relative max-w-[85%] rounded-2xl rounded-tl-sm bg-blue-50 p-3 text-gray-800 shadow-sm">
                  <div className="mb-1 text-xs font-semibold text-blue-600">{msg.nickname || msg.authorId}</div>
                  <div className="text-sm leading-relaxed">{msg.content}</div>
                  <div className="mt-1 text-right text-[10px] text-gray-400">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {messages.length === 0 && (
            <div className="mt-10 text-center text-sm text-gray-400">暂无消息，开始讨论吧</div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <VoicePanel />
        </div>
      </div>

      <div className="relative flex flex-grow flex-col bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
        <div className="absolute top-0 z-10 flex h-14 w-full items-center justify-between border-b border-gray-200 bg-white/80 px-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center space-x-4">
            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="text-xl">讨论</span>
              {currentRoom?.topic || '未设置主题'}
            </h1>
            <span className="rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs text-green-800">
              {currentRoom?.mode === 'REMOTE' ? '远程模式' : '现场模式'}
            </span>
          </div>

          <button
            onClick={() => navigate(`/room/${code}/review`)}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            结束讨论
          </button>
        </div>

        <div className="absolute right-4 top-20 bottom-28 z-20 flex w-80 flex-col rounded-lg border border-gray-200 bg-white/95 shadow-lg backdrop-blur-sm">
          <div className="rounded-t-lg bg-gradient-to-r from-blue-500 to-indigo-500 p-3 text-white">
            <h3 className="font-semibold">聊天记录</h3>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="mt-8 text-center text-gray-400">暂无消息</div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  <div className="mb-1 text-xs text-gray-500">{msg.nickname || msg.authorId}</div>
                  <div className="rounded-lg bg-blue-50 p-2 text-sm text-gray-800">{msg.content}</div>
                  <div className="mt-1 text-right text-[10px] text-gray-400">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-grow pb-24 pt-14">
          <MindMap />
        </div>

        <VoicePanel />
        <PetWidget />
      </div>
    </div>
  );
}
