import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AiQaPanel } from '../components/AiQaPanel';
import { FileSharePanel } from '../components/FileSharePanel';
import { MindMap } from '../components/MindMap';
import { TextWhiteboard } from '../components/TextWhiteboard';
import { mapMindMapEdges, mapMindMapNodes } from '../lib/mindmap';
import { VoicePanel } from '../components/VoicePanel';
import { useSocket } from '../hooks/useSocket';
import {
  AiConversationMessage,
  chatService,
  mindMapService,
  AiSelectedFile,
  AiProviderSettings,
  MindMapApiEdge,
  MindMapApiNode,
  roomAiService,
  roomService,
  sharedFileService,
  whiteboardService,
} from '../services/api-client';
import { useChatStore } from '../stores/useChatStore';
import { useMindMapStore } from '../stores/useMindMapStore';
import { useRoomStore } from '../stores/useRoomStore';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';
import { SharedFile, SharedFileTree } from '../types/shared-file';
import { ChatMessage } from '../types/socket-events';

type FeatureTab = 'mindmap' | 'ai' | 'files' | 'whiteboard';

type MindMapResponse = {
  nodes?: MindMapApiNode[];
  edges?: MindMapApiEdge[];
} | null;

const tabs: Array<{ id: FeatureTab; label: string }> = [
  { id: 'mindmap', label: '\u601d\u7ef4\u5bfc\u56fe' },
  { id: 'ai', label: 'AI\u5bf9\u8bdd' },
  { id: 'whiteboard', label: '\u6587\u5b57\u767d\u677f' },
  { id: 'files', label: '\u6587\u4ef6\u5171\u4eab' },
];

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

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });

export default function DiscussPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentRoom, setRoom } = useRoomStore();
  const { messages, setMessages, clear: clearMessages } = useChatStore();
  const { setNodes, setEdges, clear: clearMindMap } = useMindMapStore();
  const { board, setBoard, clear: clearWhiteboard } = useWhiteboardStore();
  const [activeTab, setActiveTab] = useState<FeatureTab>('mindmap');
  const [fileTree, setFileTree] = useState<SharedFileTree>({ folders: [], files: [] });
  const [filesLoading, setFilesLoading] = useState(false);

  useSocket(currentRoom?.id);

  const loadSharedFiles = async (roomId: string) => {
    setFilesLoading(true);
    try {
      const nextTree = await sharedFileService.listFiles(roomId);
      setFileTree(nextTree);
    } finally {
      setFilesLoading(false);
    }
  };

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
        clearWhiteboard();
        setFileTree({ folders: [], files: [] });

        const room = await roomService.getRoomByCode(code);
        if (cancelled) {
          return;
        }

        setRoom(room);

        const [history, map, nextTree, nextBoard] = await Promise.all([
          chatService.getMessages(room.id) as Promise<ChatMessage[]>,
          mindMapService.getMap(room.id) as Promise<MindMapResponse>,
          sharedFileService.listFiles(room.id),
          whiteboardService.getBoard(room.id),
        ]);

        if (cancelled) {
          return;
        }

        setMessages(normalizeMessages(history));
        setNodes(mapMindMapNodes(map?.nodes ?? [], room.topic));
        setEdges(mapMindMapEdges(map?.edges ?? []));
        setFileTree(nextTree);
        setBoard(nextBoard);
      } catch (error) {
        console.error('Failed to load discussion room:', error);
        navigate('/');
      } finally {
        if (!cancelled) {
          setFilesLoading(false);
        }
      }
    };

    void loadDiscussionRoom();

    return () => {
      cancelled = true;
    };
  }, [code, navigate, setRoom, setMessages, setNodes, setEdges, clearMessages, clearMindMap, clearWhiteboard, setBoard]);

  const handleAskAi = async (
    message: string,
    history: AiConversationMessage[],
    selectedFiles: AiSelectedFile[],
    settings: AiProviderSettings,
  ) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const response = await roomAiService.askQuestion(
      currentRoom.id,
      message,
      history,
      selectedFiles,
      settings,
    );
    return response.answer;
  };

  const handleUploadFile = async (file: File, folderId: string | null) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds 10MB limit');
    }

    const dataBase64 = await readFileAsBase64(file);
    const uploaded = await sharedFileService.uploadFile(currentRoom.id, {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataBase64,
      folderId,
    });

    setFileTree((prev) => ({
      ...prev,
      files: [uploaded, ...prev.files.filter((item) => item.id !== uploaded.id)],
    }));
  };

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const folder = await sharedFileService.createFolder(currentRoom.id, { name, parentId });
    setFileTree((prev) => ({
      ...prev,
      folders: [...prev.folders.filter((item) => item.id !== folder.id), folder],
    }));
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const folder = await sharedFileService.renameFolder(currentRoom.id, folderId, { name });
    setFileTree((prev) => ({
      ...prev,
      folders: prev.folders.map((item) => (item.id === folder.id ? folder : item)),
    }));
  };

  const handleDownloadFile = async (file: SharedFile) => {
    if (!currentRoom?.id) {
      throw new Error('Room is not ready');
    }

    const blob = await sharedFileService.downloadFile(currentRoom.id, file.id);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleBatchDownload = async (files: SharedFile[]) => {
    for (const file of files) {
      // Space out downloads slightly so browsers do not collapse them.
      await handleDownloadFile(file);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  };

  const renderMainPanel = () => {
    return (
      <div className="h-full">
        <div className={activeTab === 'mindmap' ? 'h-full px-6 pb-6 pt-4' : 'hidden'}>
          <MindMap fileTree={fileTree} />
        </div>

        <div className={activeTab === 'ai' ? 'h-full p-6' : 'hidden'}>
          <AiQaPanel onAsk={handleAskAi} fileTree={fileTree} />
        </div>

        <div className={activeTab === 'whiteboard' ? 'h-full p-6' : 'hidden'}>
          {currentRoom?.id && (
            <TextWhiteboard
              roomId={currentRoom.id}
              board={board}
              onBoardChange={setBoard}
            />
          )}
        </div>

        <div className={activeTab === 'files' ? 'h-full p-6' : 'hidden'}>
          <FileSharePanel
            fileTree={fileTree}
            loading={filesLoading}
            onRefresh={() => currentRoom?.id ? loadSharedFiles(currentRoom.id) : Promise.resolve()}
            onUpload={handleUploadFile}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDownload={handleDownloadFile}
            onBatchDownload={handleBatchDownload}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <div className="relative z-10 flex w-80 flex-col border-r border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 p-4 font-semibold text-gray-700">
          <span>{'\u8ba8\u8bba\u7fa4\u804a'}</span>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
            {'\u623f\u95f4\u53f7'} {code}
          </span>
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
            <div className="mt-10 text-center text-sm text-gray-400">
              {'\u6682\u65e0\u6d88\u606f\uff0c\u5f00\u59cb\u8ba8\u8bba\u5427'}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
        <div className="absolute top-0 z-10 flex h-14 w-full items-center justify-between border-b border-gray-200 bg-white/85 px-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center space-x-4">
            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              <span className="text-xl">{'\u8ba8\u8bba'}</span>
              {currentRoom?.topic || '\u672a\u8bbe\u7f6e\u4e3b\u9898'}
            </h1>
            <span className="rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs text-green-800">
              {currentRoom?.mode === 'REMOTE' ? '\u8fdc\u7a0b\u6a21\u5f0f' : '\u73b0\u573a\u6a21\u5f0f'}
            </span>
          </div>

          <button
            onClick={() => navigate(`/room/${code}/review`)}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            {'\u7ed3\u675f\u8ba8\u8bba'}
          </button>
        </div>

        <div className="absolute top-14 z-10 flex h-14 w-full items-center gap-3 border-b border-gray-200 bg-white/70 px-6 backdrop-blur-md">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="h-full pb-24 pt-28">
          {renderMainPanel()}
        </div>

        <VoicePanel />
      </div>
    </div>
  );
}
