import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WhiteboardSnapshot, whiteboardService } from '../services/api-client';

interface TextWhiteboardProps {
  roomId: string;
  board: WhiteboardSnapshot | null;
  onBoardChange: (board: WhiteboardSnapshot) => void;
}

const fontSizeOptions = [
  { label: 'S', value: '2' },
  { label: 'M', value: '3' },
  { label: 'L', value: '5' },
  { label: 'XL', value: '6' },
];

const textColors = ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c'];
const highlightColors = ['#fef08a', '#bfdbfe', '#fecaca', '#bbf7d0', '#e9d5ff', '#fed7aa'];

const formatTime = (value: string | null) => {
  if (!value) {
    return '\u5c1a\u672a\u4fdd\u5b58';
  }

  return new Date(value).toLocaleString();
};

export const TextWhiteboard = ({
  roomId,
  board,
  onBoardChange,
}: TextWhiteboardProps) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState('3');
  const [weight, setWeight] = useState<'400' | '600' | '700'>('400');

  const updatedSummary = useMemo(() => {
    if (!board) {
      return '\u6b63\u5728\u52a0\u8f7d\u767d\u677f...';
    }

    if (!board.updatedByNickname) {
      return '\u8fd8\u6ca1\u6709\u4eba\u7f16\u8f91';
    }

    return `\u6700\u8fd1\u66f4\u65b0\uff1a${board.updatedByNickname} | ${formatTime(board.updatedAt)}`;
  }, [board]);

  const cacheSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      rangeRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!editorRef.current || !rangeRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    editorRef.current.focus();
    selection.removeAllRanges();
    selection.addRange(rangeRef.current);
  };

  const queueSave = (contentHtml: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        const nextBoard = await whiteboardService.saveBoard(roomId, contentHtml);
        onBoardChange(nextBoard);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? err?.message ?? 'Whiteboard save failed');
      } finally {
        setSaving(false);
      }
    }, 450);
  };

  const applyCommand = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    cacheSelection();
    if (editorRef.current) {
      const contentHtml = editorRef.current.innerHTML;
      onBoardChange({
        roomId,
        contentHtml,
        updatedAt: board?.updatedAt ?? null,
        updatedByUserId: board?.updatedByUserId ?? null,
        updatedByNickname: board?.updatedByNickname ?? null,
      });
      queueSave(contentHtml);
    }
  };

  const applyFontWeight = (nextWeight: '400' | '600' | '700') => {
    setWeight(nextWeight);
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      return;
    }

    const span = document.createElement('span');
    span.style.fontWeight = nextWeight;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    range.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(range);
    cacheSelection();

    if (editorRef.current) {
      const contentHtml = editorRef.current.innerHTML;
      onBoardChange({
        roomId,
        contentHtml,
        updatedAt: board?.updatedAt ?? null,
        updatedByUserId: board?.updatedByUserId ?? null,
        updatedByNickname: board?.updatedByNickname ?? null,
      });
      queueSave(contentHtml);
    }
  };

  const handleInput = () => {
    if (!editorRef.current) {
      return;
    }

    const contentHtml = editorRef.current.innerHTML;
    onBoardChange({
      roomId,
      contentHtml,
      updatedAt: board?.updatedAt ?? null,
      updatedByUserId: board?.updatedByUserId ?? null,
      updatedByNickname: board?.updatedByNickname ?? null,
    });
    queueSave(contentHtml);
    cacheSelection();
  };

  useEffect(() => {
    const loadBoard = async () => {
      try {
        setLoading(true);
        const nextBoard = await whiteboardService.getBoard(roomId);
        onBoardChange(nextBoard);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? err?.message ?? 'Whiteboard load failed');
      } finally {
        setLoading(false);
      }
    };

    void loadBoard();

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [roomId, onBoardChange]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const nextHtml = board?.contentHtml || '';
    if (editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
  }, [board]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{'\u5171\u540c\u6587\u5b57\u767d\u677f'}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {'\u623f\u95f4\u6210\u5458\u53ef\u5171\u540c\u7f16\u8f91\u4e00\u5f20\u6587\u5b57\u767d\u677f\uff0c\u9002\u5408\u6574\u7406\u7ed3\u8bba\u3001\u8349\u7a3f\u548c\u534f\u4f5c\u8bb0\u5f55'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <div>{updatedSummary}</div>
          <div className="mt-1 text-xs text-slate-400">
            {saving ? '\u6b63\u5728\u81ea\u52a8\u4fdd\u5b58...' : '\u81ea\u52a8\u4fdd\u5b58\u5df2\u5f00\u542f'}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCommand('bold')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCommand('underline')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 underline transition hover:bg-slate-100"
        >
          U
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyCommand('removeFormat')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
        >
          {'\u6e05\u9664\u683c\u5f0f'}
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
          <span className="text-xs font-medium text-slate-500">{'\u5b57\u53f7'}</span>
          {fontSizeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setFontSize(option.value);
                applyCommand('fontSize', option.value);
              }}
              className={`rounded-md px-2 py-1 text-xs transition ${
                fontSize === option.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
          <span className="text-xs font-medium text-slate-500">{'\u7c97\u7ec6'}</span>
          {([
            ['400', 'N'],
            ['600', 'M'],
            ['700', 'B'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyFontWeight(value)}
              className={`rounded-md px-2 py-1 text-xs transition ${
                weight === value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
          <span className="text-xs font-medium text-slate-500">{'\u989c\u8272'}</span>
          {textColors.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand('foreColor', color)}
              className="h-6 w-6 rounded-full border border-slate-200"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
          <span className="text-xs font-medium text-slate-500">{'\u9ad8\u4eae'}</span>
          {highlightColors.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCommand('hiliteColor', color)}
              className="h-6 w-6 rounded-md border border-slate-200"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        {'\u5148\u9009\u4e2d\u6587\u5b57\u518d\u5e94\u7528\u5b57\u53f7\u3001\u7c97\u7ec6\u3001\u989c\u8272\u548c\u9ad8\u4eae\u6548\u679c\uff0c\u6240\u6709\u4eba\u90fd\u4f1a\u770b\u5230\u5b9e\u65f6\u66f4\u65b0\u3002'}
      </div>

      <div className="mt-4 flex-1 min-h-0 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_96%,#f8fafc_100%)] p-4">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyUp={cacheSelection}
          onMouseUp={cacheSelection}
          onFocus={cacheSelection}
          className="h-full min-h-[420px] overflow-y-auto rounded-xl bg-white p-6 text-[16px] leading-8 text-slate-800 outline-none"
          style={{ whiteSpace: 'pre-wrap' }}
          data-placeholder={loading ? '\u6b63\u5728\u52a0\u8f7d\u767d\u677f...' : '\u5728\u8fd9\u91cc\u5f00\u59cb\u5171\u540c\u7f16\u8f91...'}
        />
      </div>
    </div>
  );
};
