import React, { KeyboardEvent, memo, useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MindMapNodeData, MindMapNodeType } from '../types/mindmap';

const nodeTypeLabels: Record<MindMapNodeType, string> = {
  IDEA: '\u60f3\u6cd5',
  QUESTION: '\u95ee\u9898',
  FACT: '\u4e8b\u5b9e',
  ACTION: '\u884c\u52a8',
};

type NodeEntityProps = {
  id: string;
  data: MindMapNodeData;
  isConnectable: boolean;
  selected?: boolean;
};

export const NodeEntity = memo(({ id, data, isConnectable, selected }: NodeEntityProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.keywordZh);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(data.keywordZh);
  }, [data.keywordZh]);

  const handleSave = async () => {
    const nextLabel = draft.trim();
    if (!nextLabel) {
      setDraft(data.keywordZh);
      setEditing(false);
      return;
    }

    if (nextLabel === data.keywordZh) {
      setEditing(false);
      return;
    }

    if (!data.onRequestUpdate) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await data.onRequestUpdate(id, nextLabel);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update node:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!data.onRequestDelete) {
      return;
    }

    if (!window.confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u8282\u70b9\u5417\uff1f')) {
      return;
    }

    try {
      await data.onRequestDelete(id);
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleSave();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(data.keywordZh);
      setEditing(false);
    }
  };

  const typeLabel = nodeTypeLabels[data.nodeType ?? 'IDEA'];
  const handleClassName = data.handleClassName ?? 'bg-blue-500';
  const containerClassName = data.containerClassName ?? 'border-blue-500 bg-white';
  const badgeClassName = data.badgeClassName ?? 'bg-blue-600 text-white';
  const metaTextClassName = data.metaTextClassName ?? 'text-gray-500';
  const bodyClassName = data.bodyClassName ?? 'bg-slate-50';
  const actionButtonClassName =
    data.actionButtonClassName ?? 'border-gray-200 text-gray-600 hover:border-blue-200 hover:text-blue-600';

  return (
    <div
      className={`
        min-w-[220px] rounded-2xl border-2 px-4 py-3 shadow-md transition
        ${data.status === 'discarded' ? 'border-gray-300 bg-gray-50 opacity-50' : containerClassName}
        ${data.isCenter ? 'scale-[1.03] shadow-lg' : ''}
        ${selected ? 'ring-2 ring-slate-300' : ''}
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className={`h-3 w-3 ${handleClassName}`}
      />

      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {data.authorAvatar && (
            <img
              src={data.authorAvatar}
              alt="author"
              className="h-7 w-7 rounded-full object-cover"
            />
          )}
          <div className="flex flex-col">
            <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${badgeClassName}`}>
              {typeLabel}
            </span>
            <span className={`mt-1 text-xs ${metaTextClassName}`}>
              {(data.authorName ?? data.authorUid) || '\u533f\u540d'}
            </span>
          </div>
        </div>

        <div className="nodrag flex gap-1">
          {data.canEdit !== false && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setEditing(true);
              }}
              className={`rounded-md border px-2 py-1 text-[11px] transition ${actionButtonClassName}`}
            >
              {editing ? '\u7f16\u8f91\u4e2d' : '\u7f16\u8f91'}
            </button>
          )}
          {data.canDelete !== false && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void handleDelete();
              }}
              className="rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-600 transition hover:bg-red-50"
            >
              {'\u5220\u9664'}
            </button>
          )}
        </div>
      </div>

      <div className={`rounded-xl px-3 py-2 ${bodyClassName}`}>
        {editing ? (
          <div className="nodrag flex flex-col gap-2">
            <input
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none ring-0 focus:border-blue-500"
              placeholder="\u8f93\u5165\u8282\u70b9\u6807\u9898"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleSave();
                }}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving ? '\u4fdd\u5b58\u4e2d...' : '\u4fdd\u5b58'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDraft(data.keywordZh);
                  setEditing(false);
                }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
              >
                {'\u53d6\u6d88'}
              </button>
            </div>
          </div>
        ) : (
          <div
            role={data.canEdit === false ? undefined : 'button'}
            tabIndex={data.canEdit === false ? -1 : 0}
            onDoubleClick={() => {
              if (data.canEdit !== false) {
                setEditing(true);
              }
            }}
            onKeyDown={(event) => {
              if (data.canEdit !== false && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                setEditing(true);
              }
            }}
            className={`${data.canEdit === false ? '' : 'cursor-text'} outline-none`}
          >
            <div className="text-sm font-semibold leading-6 text-gray-800">{data.keywordZh}</div>
            {data.keywordEn && (
              <div className="text-xs text-gray-500">{data.keywordEn}</div>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        isConnectable={isConnectable}
        className={`h-3 w-3 ${handleClassName}`}
      />
    </div>
  );
});
