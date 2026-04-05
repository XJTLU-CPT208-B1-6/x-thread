import React, { ChangeEvent, useMemo, useState } from 'react';
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

const formatTime = (value: string) => new Date(value).toLocaleString();

const buildBreadcrumbs = (folders: SharedFolder[], folderId: string | null) => {
  const items: SharedFolder[] = [];
  let currentId = folderId;

  while (currentId) {
    const nextFolder = folders.find((folder) => folder.id === currentId);
    if (!nextFolder) {
      break;
    }

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
  title = '文件共享',
  description = '支持按目录查看共享文件。下载有效期为 7 天，过期文件仍保留记录但不可下载。',
}: FileSharePanelProps) => {
  const [uploading, setUploading] = useState(false);
  const [submittingFolder, setSubmittingFolder] = useState(false);
  const [error, setError] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(fileTree.folders, currentFolderId),
    [fileTree.folders, currentFolderId],
  );

  const currentFolders = useMemo(
    () =>
      [...fileTree.folders]
        .filter((folder) => folder.parentId === currentFolderId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [fileTree.folders, currentFolderId],
  );

  const currentFiles = useMemo(
    () =>
      [...fileTree.files]
        .filter((file) => (file.folderId ?? null) === currentFolderId)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [fileTree.files, currentFolderId],
  );

  const downloadableFiles = useMemo(
    () => currentFiles.filter((file) => !isFileExpired(file)),
    [currentFiles],
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setError('');

    try {
      await onUpload(selectedFile, currentFolderId);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || submittingFolder || readOnly) {
      return;
    }

    setSubmittingFolder(true);
    setError('');

    try {
      await onCreateFolder(trimmed, currentFolderId);
      setNewFolderName('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Create folder failed');
    } finally {
      setSubmittingFolder(false);
    }
  };

  const handleRenameFolder = async () => {
    const trimmed = renameValue.trim();
    if (!renamingFolderId || !trimmed || readOnly) {
      return;
    }

    setSubmittingFolder(true);
    setError('');

    try {
      await onRenameFolder(renamingFolderId, trimmed);
      setRenamingFolderId(null);
      setRenameValue('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Rename folder failed');
    } finally {
      setSubmittingFolder(false);
    }
  };

  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            {'\u5237\u65b0'}
          </button>
          <button
            type="button"
            onClick={() => void onBatchDownload(downloadableFiles)}
            disabled={downloadableFiles.length === 0}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            {'\u6279\u91cf\u4e0b\u8f7d\u672c\u76ee\u5f55'}
          </button>
          {!readOnly && (
            <label className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
              {uploading ? '\u4e0a\u4f20\u4e2d...' : '\u4e0a\u4f20\u5230\u5f53\u524d\u76ee\u5f55'}
              <input type="file" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
          className={`rounded-lg px-2 py-1 transition ${currentFolderId === null ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white'}`}
        >
          {'\u6839\u76ee\u5f55'}
        </button>
        {breadcrumbs.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => setCurrentFolderId(folder.id)}
            className={`rounded-lg px-2 py-1 transition ${
              currentFolderId === folder.id ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white'
            }`}
          >
            {folder.name}
          </button>
        ))}
      </div>

      {!readOnly && (
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="text"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder={'\u65b0\u5efa\u6587\u4ef6\u5939\u540d'}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={submittingFolder || !newFolderName.trim()}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {'\u65b0\u5efa\u6587\u4ef6\u5939'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        {'\u5355\u4e2a\u6587\u4ef6\u9650 10MB\uff0c\u6279\u91cf\u4e0b\u8f7d\u53ea\u4f1a\u4e0b\u8f7d\u5f53\u524d\u76ee\u5f55\u4e0b\u672a\u8fc7\u671f\u7684\u6587\u4ef6\uff0c\u5171\u4eab\u6587\u4ef6\u4e0b\u8f7d\u671f\u9650\u4e3a 7 \u5929\u3002'}
      </div>

      <div className="h-[calc(100%-14rem)] overflow-y-auto rounded-2xl border border-slate-200">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">{'\u6b63\u5728\u52a0\u8f7d\u6587\u4ef6...'}</div>
        ) : currentFolders.length === 0 && currentFiles.length === 0 ? (
          <div className="p-6 text-sm text-slate-400">{'\u8fd9\u4e2a\u76ee\u5f55\u8fd8\u662f\u7a7a\u7684'}</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {currentFolders.map((folder) => (
              <div key={folder.id} className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate font-medium text-slate-800">{folder.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {folder.creatorNickname} | {new Date(folder.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingFolderId(folder.id);
                        setRenameValue(folder.name);
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      {'\u91cd\u547d\u540d'}
                    </button>
                  )}
                </div>

                {!readOnly && renamingFolderId === folder.id && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={handleRenameFolder}
                      disabled={submittingFolder || !renameValue.trim()}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white transition hover:bg-slate-800 disabled:bg-slate-300"
                    >
                      {'\u4fdd\u5b58'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingFolderId(null);
                        setRenameValue('');
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      {'\u53d6\u6d88'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {currentFiles.map((file) => (
              (() => {
                const expired = isFileExpired(file);

                return (
                  <div key={file.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-800">{file.filename}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {file.uploaderNickname} | {formatFileSize(file.sizeBytes)} |{' '}
                        {formatTime(file.uploadedAt)}
                      </div>
                      <div className={`mt-1 text-xs ${expired ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {expired
                          ? '\u4e0b\u8f7d\u5df2\u8fc7\u671f'
                          : `\u4e0b\u8f7d\u622a\u6b62 ${formatTime(file.expiresAt)}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDownload(file)}
                      disabled={expired}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      {expired ? '\u5df2\u8fc7\u671f' : '\u4e0b\u8f7d'}
                    </button>
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
