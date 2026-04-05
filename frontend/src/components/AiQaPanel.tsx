import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  clearAiConversation,
  getAiProviderMeta,
  isCustomAiProvider,
  loadAiConversation,
  loadAiSettings,
  resolveAiEndpointLabel,
  saveAiConversation,
} from '../lib/ai-settings';
import {
  AiConversationMessage,
  AiProviderSettings,
  AiSelectedFile,
} from '../services/api-client';
import { SharedFile, SharedFileTree } from '../types/shared-file';

interface AiQaPanelProps {
  onAsk: (
    message: string,
    history: AiConversationMessage[],
    selectedFiles: AiSelectedFile[],
    settings: AiProviderSettings,
  ) => Promise<string>;
  fileTree: SharedFileTree;
}

type ChatBubble = AiConversationMessage & {
  id: string;
  pending?: boolean;
};

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const isImageFile = (file: Pick<SharedFile, 'mimeType'>) =>
  file.mimeType.startsWith('image/');

export const AiQaPanel = ({ onAsk, fileTree }: AiQaPanelProps) => {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatBubble[]>(() =>
    loadAiConversation(code).map((message, index) => ({
      ...message,
      id: `history-${index}`,
    })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const settings = useMemo(() => loadAiSettings(), [loading]);
  const providerMeta = useMemo(() => getAiProviderMeta(settings.provider), [settings.provider]);
  const endpointLabel = useMemo(() => resolveAiEndpointLabel(settings), [settings]);
  const availableFiles = useMemo(
    () =>
      [...fileTree.files].sort((a, b) => {
        const imageDelta = Number(isImageFile(b)) - Number(isImageFile(a));
        if (imageDelta !== 0) {
          return imageDelta;
        }
        return b.uploadedAt.localeCompare(a.uploadedAt);
      }),
    [fileTree.files],
  );
  const selectedFiles = useMemo(
    () =>
      selectedFileIds
        .map((fileId) => availableFiles.find((file) => file.id === fileId))
        .filter((file): file is SharedFile => Boolean(file)),
    [availableFiles, selectedFileIds],
  );

  useEffect(() => {
    setMessages(
      loadAiConversation(code).map((message, index) => ({
        ...message,
        id: `history-${index}`,
      })),
    );
    setDraft('');
    setSelectedFileIds([]);
    setShowFilePicker(false);
    setError('');
  }, [code]);

  useEffect(() => {
    setSelectedFileIds((current) =>
      current.filter((fileId) => availableFiles.some((file) => file.id === fileId)),
    );
  }, [availableFiles]);

  useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    saveAiConversation(
      code,
      messages
        .filter((message) => !message.pending)
        .map(({ role, content }) => ({ role, content })),
    );
  }, [code, messages]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    );
  };

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || loading) {
      return;
    }

    if (!settings.apiKey.trim()) {
      setError('\u8bf7\u5148\u5728 AI \u8bbe\u7f6e\u9875\u9762\u586b\u5199 API Key');
      return;
    }

    if (isCustomAiProvider(settings.provider) && !settings.baseUrl?.trim()) {
      setError('\u8bf7\u5148\u5728 AI \u8bbe\u7f6e\u9875\u9762\u586b\u5199 Base URL');
      return;
    }

    setLoading(true);
    setError('');

    const history = messages.map(({ role, content }) => ({ role, content }));
    const timestamp = Date.now();
    const userMessage: ChatBubble = {
      id: `user-${timestamp}`,
      role: 'user',
      content: trimmed,
    };
    const pendingAssistantId = `assistant-${timestamp}`;
    const pendingAssistant: ChatBubble = {
      id: pendingAssistantId,
      role: 'assistant',
      content: '',
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, pendingAssistant]);
    setDraft('');

    try {
      const nextAnswer = await onAsk(
        trimmed,
        history,
        selectedFiles.map((file) => ({
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
        })),
        settings,
      );
      setMessages((prev) =>
        prev.map((message) =>
          message.id === pendingAssistantId
            ? { ...message, content: nextAnswer, pending: false }
            : message,
        ),
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((message) => message.id !== pendingAssistantId));
      setError(err?.response?.data?.message ?? 'AI response failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{'\u667a\u80fd\u5bf9\u8bdd'}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {'\u53d1\u6d88\u606f\u3001\u9009\u62e9\u623f\u95f4\u91cc\u7684\u6587\u4ef6/\u56fe\u7247\u4f5c\u4e3a\u5f15\u7528\uff0cAI \u4f1a\u57fa\u4e8e\u5f53\u524d\u8ba8\u8bba\u7ee7\u7eed\u56de\u7b54'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(code ? `/room/${code}/ai-settings` : '/')}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {'\u6253\u5f00 AI \u8bbe\u7f6e'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{'\u5e73\u53f0'}</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{providerMeta.label}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{'\u6a21\u578b'}</div>
          <div className="mt-1 truncate text-sm font-medium text-slate-900">
            {settings.model || providerMeta.defaultModel}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{'\u63a5\u53e3'}</div>
          <div className="mt-1 truncate text-sm font-medium text-slate-900">{endpointLabel}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{'API Key'}</div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {settings.apiKey.trim() ? '\u5df2\u586b\u5199' : '\u672a\u586b\u5199'}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{'\u5df2\u9009\u6587\u4ef6'}</div>
          <div className="mt-1 text-sm font-medium text-slate-900">
            {selectedFiles.length > 0 ? `${selectedFiles.length} \u4e2a` : '\u672a\u9009\u62e9'}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm text-slate-600">
          {'\u53ef\u5c06\u623f\u95f4\u5df2\u5171\u4eab\u7684\u6587\u4ef6\u6216\u56fe\u7247\u52a0\u5165\u672c\u6b21\u63d0\u95ee\u5f15\u7528'}
        </div>
        <button
          type="button"
          onClick={() => setShowFilePicker((current) => !current)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {showFilePicker ? '\u6536\u8d77\u6587\u4ef6\u9009\u62e9' : '\u9009\u62e9\u6587\u4ef6/\u56fe\u7247'}
        </button>
      </div>

      {showFilePicker && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {availableFiles.length === 0 ? (
            <div className="text-sm text-slate-400">{'\u8fd9\u4e2a\u623f\u95f4\u8fd8\u6ca1\u6709\u5171\u4eab\u6587\u4ef6'}</div>
          ) : (
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {availableFiles.map((file) => {
                const selected = selectedFileIds.includes(file.id);
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => toggleFileSelection(file.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white hover:bg-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">{file.filename}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                          {isImageFile(file) ? 'Image' : 'File'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {file.uploaderNickname} | {formatFileSize(file.sizeBytes)}
                      </div>
                    </div>
                    <span
                      className={`ml-3 rounded-full px-2 py-1 text-xs font-medium ${
                        selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {selected ? '\u5df2\u9009' : '\u9009\u62e9'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div
        ref={viewportRef}
        className="mt-4 flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-5"
      >
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400">
            {'\u8fd8\u6ca1\u6709\u5bf9\u8bdd\uff0c\u53d1\u9001\u7b2c\u4e00\u6761\u6d88\u606f\u5f00\u59cb\u5427\u3002'}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-blue-600 text-white'
                      : 'rounded-bl-sm bg-white text-slate-700'
                  }`}
                >
                  <div
                    className={`mb-1 text-[11px] font-semibold ${
                      message.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {message.role === 'user' ? '\u4f60' : 'AI'}
                  </div>
                  <div className="whitespace-pre-wrap leading-7">
                    {message.pending ? '\u6b63\u5728\u601d\u8003\u4e2d...' : message.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {selectedFiles.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {'\u672c\u6b21\u63d0\u95ee\u5f15\u7528'}
            </div>
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
              {selectedFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => toggleFileSelection(file.id)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition hover:bg-blue-100"
                >
                  {file.filename}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder={'\u4f8b\u5982\uff1a\u7ed3\u5408\u6211\u9009\u7684\u8fd9\u51e0\u4e2a\u6587\u4ef6\uff0c\u5e2e\u6211\u6574\u7406\u4e00\u4e0b\u5f53\u524d\u8ba8\u8bba\u7ed3\u8bba'}
            className="min-h-28 max-h-56 w-full resize-y overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {'\u8f93\u5165\u6846\u53ef\u4e0a\u4e0b\u62d6\u52a8\uff0c\u4e5f\u53ef\u7528\u9f20\u6807\u6eda\u8f6e\u4e0a\u4e0b\u6eda\u52a8\u3002Enter \u53d1\u9001\uff0cShift + Enter \u6362\u884c'}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDraft('');
                  setMessages([]);
                  setSelectedFileIds([]);
                  setError('');
                  clearAiConversation(code);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                {'\u6e05\u7a7a'}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading || !draft.trim() || !settings.apiKey.trim()}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? '\u7b49\u5f85\u56de\u590d...' : '\u53d1\u9001'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
