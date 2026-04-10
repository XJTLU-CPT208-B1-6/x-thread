import React, { useMemo } from 'react';
import { roomAiService, WhiteboardSnapshot, whiteboardService } from '../services/api-client';
import { useLanguageStore } from '../stores/useLanguageStore';

interface TextWhiteboardProps {
  roomId: string;
  board: WhiteboardSnapshot | null;
  onBoardChange: (board: WhiteboardSnapshot) => void;
}

const fontSizeOptions = [{ label: 'S', value: '2' }, { label: 'M', value: '3' }, { label: 'L', value: '5' }, { label: 'XL', value: '6' }];
const textColors = ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#7c3aed', '#ea580c'];
const highlightColors = ['#fef08a', '#bfdbfe', '#fecaca', '#bbf7d0', '#e9d5ff', '#fed7aa'];
const stripHtml = (value: string) => value.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
const hasMeaningfulContent = (value: string) => stripHtml(value).length > 0;

export const TextWhiteboard = ({ roomId, board, onBoardChange }: TextWhiteboardProps) => {
  const { language } = useLanguageStore();
  const copy = useMemo(() => language === 'en' ? {
    notSaved: 'Not saved yet', loading: 'Loading whiteboard...', nobody: 'No one has edited this yet', latest: 'Latest update', saveFailed: 'Whiteboard save failed', summarySaveFailed: 'Failed to save AI summary', summaryFailed: 'AI summary failed', summaryEmpty: 'AI did not return a usable summary', title: 'Collaborative Whiteboard', desc: 'Room members can co-edit a single rich-text whiteboard for notes, conclusions, and follow-up items.', summarize: 'Summarize Board', summarizing: 'Summarizing...', autosaving: 'Autosaving...', autosaveOn: 'Autosave is enabled', summaryHint: 'Generate a draft from chat, files, mind map, and current whiteboard content.', clearFormat: 'Clear Format', fontSize: 'Size', weight: 'Weight', color: 'Color', highlight: 'Highlight', formatHint: 'Select text first, then apply size, weight, color, or highlight. Everyone sees the update immediately.', placeholder: 'Start writing together here...',
  } : {
    notSaved: '尚未保存', loading: '正在加载白板...', nobody: '还没有人编辑', latest: '最近更新', saveFailed: '白板保存失败', summarySaveFailed: 'AI 总结保存失败', summaryFailed: 'AI 总结失败', summaryEmpty: 'AI 没有返回可用总结', title: '共同文字白板', desc: '房间成员可共同编辑一张文字白板，适合整理结论、草稿和协作记录。', summarize: '总结全文', summarizing: '正在总结...', autosaving: '正在自动保存...', autosaveOn: '自动保存已开启', summaryHint: '按聊天、导图、文件和当前白板生成整理稿。', clearFormat: '清除格式', fontSize: '字号', weight: '粗细', color: '颜色', highlight: '高亮', formatHint: '先选中文字再应用字号、粗细、颜色和高亮效果，所有人都会看到实时更新。', placeholder: '在这里开始共同编辑...',
  }, [language]);

  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeRef = React.useRef<Range | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [summarizing, setSummarizing] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fontSize, setFontSize] = React.useState('3');
  const [weight, setWeight] = React.useState<'400' | '600' | '700'>('400');

  const formatTime = (value: string | null) => value ? new Date(value).toLocaleString() : copy.notSaved;
  const updatedSummary = !board ? copy.loading : !board.updatedByNickname ? copy.nobody : `${copy.latest}: ${board.updatedByNickname} | ${formatTime(board.updatedAt)}`;
  const buildSummaryBlock = (summaryHtml: string) => [`<div data-ai-summary="true">`, `<p><strong>AI Summary</strong> | ${new Date().toLocaleString()}</p>`, summaryHtml, '</div>'].join('');
  const mergeSummaryIntoBoard = (currentHtml: string, summaryHtml: string) => hasMeaningfulContent(currentHtml) ? `${currentHtml}<div><br></div>${buildSummaryBlock(summaryHtml)}` : buildSummaryBlock(summaryHtml);

  const cacheSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) rangeRef.current = range.cloneRange();
  };
  const restoreSelection = () => {
    if (!editorRef.current || !rangeRef.current) return;
    const selection = window.getSelection();
    if (!selection) return;
    editorRef.current.focus(); selection.removeAllRanges(); selection.addRange(rangeRef.current);
  };
  const createDraftBoard = (contentHtml: string): WhiteboardSnapshot => ({ roomId, contentHtml, updatedAt: board?.updatedAt ?? null, updatedByUserId: board?.updatedByUserId ?? null, updatedByNickname: board?.updatedByNickname ?? null });
  const persistBoard = async (contentHtml: string, fallbackMessage = copy.saveFailed) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    try { setSaving(true); setError(''); const nextBoard = await whiteboardService.saveBoard(roomId, contentHtml); onBoardChange(nextBoard); return nextBoard; }
    catch (err: any) { setError(err?.response?.data?.message ?? err?.message ?? fallbackMessage); throw err; }
    finally { setSaving(false); }
  };
  const queueSave = (contentHtml: string) => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveTimerRef.current = setTimeout(() => { void persistBoard(contentHtml).catch(() => undefined); }, 450); };
  const updateLocalBoard = (contentHtml: string) => onBoardChange(createDraftBoard(contentHtml));
  const handleGenerateSummary = async () => {
    if (summarizing) return;
    try {
      setSummarizing(true); setError('');
      const currentHtml = editorRef.current?.innerHTML ?? board?.contentHtml ?? '';
      const { summaryHtml } = await roomAiService.generateWhiteboardSummary(roomId, currentHtml);
      if (!summaryHtml.trim()) throw new Error(copy.summaryEmpty);
      const mergedHtml = mergeSummaryIntoBoard(currentHtml, summaryHtml);
      if (editorRef.current) editorRef.current.innerHTML = mergedHtml;
      updateLocalBoard(mergedHtml);
      await persistBoard(mergedHtml, copy.summarySaveFailed);
    } catch (err: any) { setError(err?.response?.data?.message ?? err?.message ?? copy.summaryFailed); }
    finally { setSummarizing(false); }
  };
  const applyCommand = (command: string, value?: string) => { restoreSelection(); document.execCommand('styleWithCSS', false, 'true'); document.execCommand(command, false, value); cacheSelection(); if (editorRef.current) { const contentHtml = editorRef.current.innerHTML; updateLocalBoard(contentHtml); queueSave(contentHtml); } };
  const applyFontWeight = (nextWeight: '400' | '600' | '700') => { setWeight(nextWeight); restoreSelection(); const selection = window.getSelection(); if (!selection || selection.rangeCount === 0) return; const range = selection.getRangeAt(0); if (range.collapsed) return; const span = document.createElement('span'); span.style.fontWeight = nextWeight; span.appendChild(range.extractContents()); range.insertNode(span); range.selectNodeContents(span); selection.removeAllRanges(); selection.addRange(range); cacheSelection(); if (editorRef.current) { const contentHtml = editorRef.current.innerHTML; updateLocalBoard(contentHtml); queueSave(contentHtml); } };
  const handleInput = () => { if (!editorRef.current) return; const contentHtml = editorRef.current.innerHTML; updateLocalBoard(contentHtml); queueSave(contentHtml); cacheSelection(); };

  React.useEffect(() => {
    const loadBoard = async () => { try { setLoading(true); onBoardChange(await whiteboardService.getBoard(roomId)); } catch (err: any) { setError(err?.response?.data?.message ?? err?.message ?? copy.saveFailed); } finally { setLoading(false); } };
    void loadBoard();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [copy.saveFailed, onBoardChange, roomId]);

  React.useEffect(() => { if (editorRef.current) { const nextHtml = board?.contentHtml || ''; if (editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml; } }, [board]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-xl font-semibold text-slate-900">{copy.title}</h3><p className="mt-1 text-sm text-slate-500">{copy.desc}</p></div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[240px] sm:items-end"><button type="button" onClick={() => void handleGenerateSummary()} disabled={loading || summarizing} className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{summarizing ? copy.summarizing : copy.summarize}</button><div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"><div>{updatedSummary}</div><div className="mt-1 text-xs text-slate-400">{saving ? copy.autosaving : copy.autosaveOn}</div><div className="mt-1 text-xs text-slate-400">{copy.summaryHint}</div></div></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('bold')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">B</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('underline')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 underline transition hover:bg-slate-100">U</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('removeFormat')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100">{copy.clearFormat}</button><div className="mx-1 h-6 w-px bg-slate-200" /><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"><span className="text-xs font-medium text-slate-500">{copy.fontSize}</span>{fontSizeOptions.map((option) => <button key={option.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setFontSize(option.value); applyCommand('fontSize', option.value); }} className={`rounded-md px-2 py-1 text-xs transition ${fontSize === option.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{option.label}</button>)}</div><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"><span className="text-xs font-medium text-slate-500">{copy.weight}</span>{([['400', 'N'], ['600', 'M'], ['700', 'B']] as const).map(([value, label]) => <button key={value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyFontWeight(value)} className={`rounded-md px-2 py-1 text-xs transition ${weight === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}</div><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"><span className="text-xs font-medium text-slate-500">{copy.color}</span>{textColors.map((color) => <button key={color} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('foreColor', color)} className="h-6 w-6 rounded-full border border-slate-200" style={{ backgroundColor: color }} />)}</div><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"><span className="text-xs font-medium text-slate-500">{copy.highlight}</span>{highlightColors.map((color) => <button key={color} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand('hiliteColor', color)} className="h-6 w-6 rounded-md border border-slate-200" style={{ backgroundColor: color }} />)}</div></div>
      {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{copy.formatHint}</div>
      <div className="mt-4 flex-1 min-h-0 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_96%,#f8fafc_100%)] p-4"><div ref={editorRef} contentEditable suppressContentEditableWarning onInput={handleInput} onKeyUp={cacheSelection} onMouseUp={cacheSelection} onFocus={cacheSelection} className="h-full min-h-[420px] overflow-y-auto rounded-xl bg-white p-6 text-[16px] leading-8 text-slate-800 outline-none" style={{ whiteSpace: 'pre-wrap' }} data-placeholder={loading ? copy.loading : copy.placeholder} /></div>
    </div>
  );
};
