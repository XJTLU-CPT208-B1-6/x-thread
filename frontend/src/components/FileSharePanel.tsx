import React, { ChangeEvent, useMemo, useState } from 'react';
import { useLanguageStore } from '../stores/useLanguageStore';
import { SharedFile, SharedFileTree, SharedFolder } from '../types/shared-file';

interface FileSharePanelProps {
  fileTree: SharedFileTree;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onUpload: (file: File, folderId: string | null) => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDownload: (file: SharedFile) => Promise<void>;
  onBatchDownload: (files: SharedFile[]) => Promise<void>;
  readOnly?: boolean;
  title?: string;
  description?: string;
}

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = sizeBytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatTime = (value: string) => new Date(value).toLocaleString();

const MOBILE_SCROLL_AREA_STYLE: React.CSSProperties = {
  WebkitOverflowScrolling: 'touch',
  overscrollBehavior: 'contain',
  touchAction: 'pan-y',
};

const buildBreadcrumbs = (folders: SharedFolder[], folderId: string | null) => {
  const items: SharedFolder[] = [];
  let currentId = folderId;
  while (currentId) {
    const nextFolder = folders.find((folder) => folder.id === currentId);
    if (!nextFolder) break;
    items.unshift(nextFolder);
    currentId = nextFolder.parentId;
  }
  return items;
};

const isFileExpired = (file: SharedFile) => new Date(file.expiresAt).getTime() < Date.now();

export const FileSharePanel = ({
  fileTree,
  loading,
  onRefresh,
  onUpload,
  onCreateFolder,
  onRenameFolder,
  onDownload,
  onBatchDownload,
  readOnly = false,
  title,
  description,
}: FileSharePanelProps) => {
  const { language } = useLanguageStore();
  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            title: title ?? 'File Sharing',
            description: description ?? 'Browse shared files by folder. Downloads stay valid for 7 days.',
            uploadFailed: 'Upload failed',
            createFolderFailed: 'Failed to create folder',
            renameFolderFailed: 'Failed to rename folder',
            refresh: 'Refresh',
            batchDownload: 'Download Current Folder',
            uploading: 'Uploading...',
            uploadHere: 'Upload Here',
            root: 'Root',
            newFolder: 'New Folder Name',
            createFolder: 'Create Folder',
            notice: 'Single file limit: 10MB. Batch download only includes unexpired files in the current folder.',
            loading: 'Loading files...',
            empty: 'This folder is empty',
            rename: 'Rename',
            save: 'Save',
            cancel: 'Cancel',
            expired: 'Download expired',
            expiresAt: (time: string) => `Download until ${time}`,
            download: 'Download',
          }
        : {
            title: title ?? '文件共享',
            description: description ?? '支持按目录查看共享文件。下载有效期为 7 天，过期文件仍保留记录但不可下载。',
            uploadFailed: '上传失败',
            createFolderFailed: '创建文件夹失败',
            renameFolderFailed: '重命名文件夹失败',
            refresh: '刷新',
            batchDownload: '批量下载当前目录',
            uploading: '上传中...',
            uploadHere: '上传到当前目录',
            root: '根目录',
            newFolder: '新建文件夹名',
            createFolder: '新建文件夹',
            notice: '单个文件限制 10MB，批量下载只会下载当前目录下未过期的文件，共享文件下载期限为 7 天。',
            loading: '正在加载文件...',
            empty: '这个目录还是空的',
            rename: '重命名',
            save: '保存',
            cancel: '取消',
            expired: '下载已过期',
            expiresAt: (time: string) => `下载截止 ${time}`,
            download: '下载',
          },
    [description, language, title],
  );

  const [uploading, setUploading] = useState(false);
  const [submittingFolder, setSubmittingFolder] = useState(false);
  const [error, setError] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const breadcrumbs = useMemo(() => buildBreadcrumbs(fileTree.folders, currentFolderId), [fileTree.folders, currentFolderId]);
  const currentFolders = useMemo(() => [...fileTree.folders].filter((folder) => folder.parentId === currentFolderId).sort((a, b) => a.name.localeCompare(b.name)), [fileTree.folders, currentFolderId]);
  const currentFiles = useMemo(() => [...fileTree.files].filter((file) => (file.folderId ?? null) === currentFolderId).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)), [fileTree.files, currentFolderId]);
  const downloadableFiles = useMemo(() => currentFiles.filter((file) => !isFileExpired(file)), [currentFiles]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    try {
      await onUpload(selectedFile, currentFolderId);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? copy.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || submittingFolder || readOnly) return;
    setSubmittingFolder(true);
    setError('');
    try {
      await onCreateFolder(trimmed, currentFolderId);
      setNewFolderName('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? copy.createFolderFailed);
    } finally {
      setSubmittingFolder(false);
    }
  };

  const handleRenameFolder = async () => {
    const trimmed = renameValue.trim();
    if (!renamingFolderId || !trimmed || readOnly) return;
    setSubmittingFolder(true);
    setError('');
    try {
      await onRenameFolder(renamingFolderId, trimmed);
      setRenamingFolderId(null);
      setRenameValue('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? copy.renameFolderFailed);
    } finally {
      setSubmittingFolder(false);
    }
  };

  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{copy.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{copy.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void onRefresh()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">{copy.refresh}</button>
          <button type="button" onClick={() => void onBatchDownload(downloadableFiles)} disabled={downloadableFiles.length === 0} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300">{copy.batchDownload}</button>
          {!readOnly ? (
            <label className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
              {uploading ? copy.uploading : copy.uploadHere}
              <input type="file" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <button type="button" onClick={() => setCurrentFolderId(null)} className={`rounded-lg px-2 py-1 transition ${currentFolderId === null ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white'}`}>{copy.root}</button>
        {breadcrumbs.map((folder) => (
          <button key={folder.id} type="button" onClick={() => setCurrentFolderId(folder.id)} className={`rounded-lg px-2 py-1 transition ${currentFolderId === folder.id ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white'}`}>{folder.name}</button>
        ))}
      </div>

      {!readOnly ? (
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input type="text" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder={copy.newFolder} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
          <button type="button" onClick={handleCreateFolder} disabled={submittingFolder || !newFolderName.trim()} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{copy.createFolder}</button>
        </div>
      ) : null}

      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{copy.notice}</div>

      <div className="h-[calc(100%-14rem)] overflow-y-auto rounded-2xl border border-slate-200" style={MOBILE_SCROLL_AREA_STYLE}>
        {loading ? (
          <div className="p-6 text-sm text-slate-500">{copy.loading}</div>
        ) : currentFolders.length === 0 && currentFiles.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">{copy.empty}</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {currentFolders.map((folder) => (
              <div key={folder.id} className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setCurrentFolderId(folder.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium text-slate-800">{folder.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{folder.creatorNickname} | {new Date(folder.updatedAt).toLocaleString()}</div>
                  </button>
                  {!readOnly ? <button type="button" onClick={() => { setRenamingFolderId(folder.id); setRenameValue(folder.name); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">{copy.rename}</button> : null}
                </div>
                {!readOnly && renamingFolderId === folder.id ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input type="text" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
                    <button type="button" onClick={handleRenameFolder} disabled={submittingFolder || !renameValue.trim()} className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white transition hover:bg-slate-800 disabled:bg-slate-300">{copy.save}</button>
                    <button type="button" onClick={() => { setRenamingFolderId(null); setRenameValue(''); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">{copy.cancel}</button>
                  </div>
                ) : null}
              </div>
            ))}

            {currentFiles.map((file) => {
              const expired = isFileExpired(file);
              return (
                <div key={file.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{file.filename}</div>
                    <div className="mt-1 text-xs text-slate-500">{file.uploaderNickname} | {formatFileSize(file.sizeBytes)} | {formatTime(file.uploadedAt)}</div>
                    <div className={`mt-1 text-xs ${expired ? 'text-rose-600' : 'text-emerald-600'}`}>{expired ? copy.expired : copy.expiresAt(formatTime(file.expiresAt))}</div>
                  </div>
                  <button type="button" onClick={() => void onDownload(file)} disabled={expired} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300">{copy.download}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

