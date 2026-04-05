import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { RoomsService } from '../rooms/rooms.service';

export interface SharedFolderRecord {
  id: string;
  roomId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creatorNickname: string;
}

export interface SharedFileRecord {
  id: string;
  roomId: string;
  folderId: string | null;
  filename: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  expiresAt: string;
  uploaderId: string;
  uploaderNickname: string;
}

interface SharedFilesIndex {
  version: 3;
  folders: SharedFolderRecord[];
  files: SharedFileRecord[];
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const AI_CONTEXT_MAX_FILES = 5;
const AI_CONTEXT_MAX_CHARS_PER_FILE = 3200;
const AI_CONTEXT_MAX_TOTAL_CHARS = 12000;
const TEXT_FILE_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.html',
  '.htm',
  '.css',
  '.xml',
  '.yml',
  '.yaml',
  '.log',
]);

export interface SharedFileAiContext {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractionMode: 'text' | 'metadata';
  extractedText?: string;
  note: string;
}

@Injectable()
export class SharedFilesService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'shared-files');

  constructor(private readonly roomsService: RoomsService) {}

  async listFiles(roomId: string, userId: string, options?: { allowHistory?: boolean }) {
    if (options?.allowHistory) {
      await this.roomsService.ensureHistoryAccess(roomId, userId);
    } else {
      await this.roomsService.ensureMembership(roomId, userId);
    }

    const index = await this.readIndex(roomId);

    return {
      folders: index.folders.sort((a, b) => a.name.localeCompare(b.name)),
      files: index.files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    };
  }

  async createFolder(
    roomId: string,
    userId: string,
    creatorNickname: string,
    dto: { name: string; parentId?: string | null },
  ) {
    await this.roomsService.ensureMembership(roomId, userId);

    const name = this.sanitizeFolderName(dto.name);
    const parentId = dto.parentId ?? null;
    const index = await this.readIndex(roomId);

    if (parentId) {
      this.findFolder(index, parentId);
    }

    const now = new Date().toISOString();
    const folder: SharedFolderRecord = {
      id: randomUUID(),
      roomId,
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
      creatorId: userId,
      creatorNickname,
    };

    index.folders.push(folder);
    await this.writeIndex(roomId, index);
    return folder;
  }

  async renameFolder(
    roomId: string,
    userId: string,
    folderId: string,
    dto: { name: string },
  ) {
    await this.roomsService.ensureMembership(roomId, userId);

    const index = await this.readIndex(roomId);
    const folder = this.findFolder(index, folderId);
    folder.name = this.sanitizeFolderName(dto.name);
    folder.updatedAt = new Date().toISOString();

    await this.writeIndex(roomId, index);
    return folder;
  }

  async uploadFile(
    roomId: string,
    userId: string,
    uploaderNickname: string,
    dto: { filename: string; mimeType?: string; dataBase64: string; folderId?: string | null },
  ) {
    await this.roomsService.ensureMembership(roomId, userId);

    const filename = (dto.filename || 'shared-file').trim();
    const mimeType = (dto.mimeType || 'application/octet-stream').trim();
    const folderId = dto.folderId ?? null;
    const binary = Buffer.from(dto.dataBase64, 'base64');
    const index = await this.readIndex(roomId);

    if (folderId) {
      this.findFolder(index, folderId);
    }

    if (!binary.length) {
      throw new PayloadTooLargeException('Empty files are not supported');
    }

    if (binary.length > MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException('File exceeds 10MB limit');
    }

    const roomDir = this.getRoomDir(roomId);
    await fs.mkdir(roomDir, { recursive: true });

    const id = randomUUID();
    const storedName = `${id}-${this.sanitizeFilename(filename)}`;
    await fs.writeFile(join(roomDir, storedName), binary);

    const record: SharedFileRecord = {
      id,
      roomId,
      folderId,
      filename,
      storedName,
      mimeType,
      sizeBytes: binary.length,
      uploadedAt: new Date().toISOString(),
      expiresAt: this.getDownloadExpiryIso(new Date()),
      uploaderId: userId,
      uploaderNickname,
    };

    index.files.unshift(record);
    await this.writeIndex(roomId, index);

    return record;
  }

  async getDownload(
    roomId: string,
    userId: string,
    fileId: string,
    options?: { allowHistory?: boolean },
  ) {
    if (options?.allowHistory) {
      await this.roomsService.ensureHistoryAccess(roomId, userId);
    } else {
      await this.roomsService.ensureMembership(roomId, userId);
    }

    const index = await this.readIndex(roomId);
    const record = index.files.find((file) => file.id === fileId);

    if (!record) {
      throw new NotFoundException('Shared file not found');
    }

    if (this.isDownloadExpired(record)) {
      throw new BadRequestException('Shared file download has expired after 7 days');
    }

    const path = join(this.getRoomDir(roomId), record.storedName);
    await fs.access(path);

    return {
      record,
      stream: createReadStream(path),
    };
  }

  async getAiContext(roomId: string, userId: string, fileIds: string[]) {
    await this.roomsService.ensureMembership(roomId, userId);

    const selectedIds = [...new Set(fileIds.map((id) => id.trim()).filter(Boolean))].slice(
      0,
      AI_CONTEXT_MAX_FILES,
    );
    if (selectedIds.length === 0) {
      return [];
    }

    const index = await this.readIndex(roomId);
    const records = selectedIds.map((fileId) => {
      const record = index.files.find((file) => file.id === fileId);
      if (!record) {
        throw new NotFoundException(`Shared file not found: ${fileId}`);
      }
      return record;
    });

    let remainingChars = AI_CONTEXT_MAX_TOTAL_CHARS;
    const contexts: SharedFileAiContext[] = [];

    for (const record of records) {
      const availableChars = Math.min(AI_CONTEXT_MAX_CHARS_PER_FILE, remainingChars);
      const extracted =
        availableChars > 0
          ? await this.tryExtractTextContent(roomId, record, availableChars)
          : null;

      if (extracted?.text) {
        remainingChars = Math.max(0, remainingChars - extracted.text.length);
      }

      contexts.push({
        id: record.id,
        filename: record.filename,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        extractionMode: extracted?.text ? 'text' : 'metadata',
        extractedText: extracted?.text,
        note:
          extracted?.note ??
          'Only file metadata is available for this file.',
      });
    }

    return contexts;
  }

  private getRoomDir(roomId: string) {
    return join(this.storageRoot, roomId);
  }

  private getIndexPath(roomId: string) {
    return join(this.getRoomDir(roomId), 'index.json');
  }

  private async readIndex(roomId: string): Promise<SharedFilesIndex> {
    try {
      const raw = await fs.readFile(this.getIndexPath(roomId), 'utf8');
      const parsed = JSON.parse(raw) as
        | SharedFilesIndex
        | Array<
            Omit<SharedFileRecord, 'folderId' | 'expiresAt'> & {
              folderId?: string | null;
              expiresAt?: string;
            }
          >;

      if (Array.isArray(parsed)) {
        return {
          version: 3,
          folders: [],
          files: parsed.map((file) => ({
            ...file,
            folderId: file.folderId ?? null,
            expiresAt:
              file.expiresAt ?? this.getDownloadExpiryIso(new Date(file.uploadedAt)),
          })),
        };
      }

      return {
        version: 3,
        folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        files: Array.isArray(parsed.files)
          ? parsed.files.map((file) => ({
              ...file,
              folderId: file.folderId ?? null,
              expiresAt:
                typeof file.expiresAt === 'string'
                  ? file.expiresAt
                  : this.getDownloadExpiryIso(new Date(file.uploadedAt)),
            }))
          : [],
      };
    } catch {
      return {
        version: 3,
        folders: [],
        files: [],
      };
    }
  }

  private async writeIndex(roomId: string, index: SharedFilesIndex) {
    const roomDir = this.getRoomDir(roomId);
    await fs.mkdir(roomDir, { recursive: true });
    await fs.writeFile(this.getIndexPath(roomId), JSON.stringify(index, null, 2), 'utf8');
  }

  private findFolder(index: SharedFilesIndex, folderId: string) {
    const folder = index.folders.find((item) => item.id === folderId);

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    return folder;
  }

  private sanitizeFilename(filename: string) {
    return filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
  }

  private sanitizeFolderName(name: string) {
    const normalized = name.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
    if (!normalized) {
      throw new BadRequestException('Folder name is required');
    }
    return normalized;
  }

  private async tryExtractTextContent(
    roomId: string,
    record: SharedFileRecord,
    maxChars: number,
  ): Promise<{ text?: string; note: string } | null> {
    if (!this.isTextLikeFile(record)) {
      if (record.mimeType.startsWith('image/')) {
        return { note: 'Image file. Only filename and metadata are available.' };
      }

      return { note: 'Binary or unsupported file type. Only filename and metadata are available.' };
    }

    const path = join(this.getRoomDir(roomId), record.storedName);
    const buffer = await fs.readFile(path);
    const normalized = buffer
      .toString('utf8')
      .replace(/\u0000/g, '')
      .replace(/\r\n/g, '\n')
      .trim();

    if (!normalized) {
      return { note: 'Text file is empty.' };
    }

    const text =
      normalized.length > maxChars
        ? `${normalized.slice(0, maxChars)}\n...[truncated]`
        : normalized;

    return {
      text,
      note:
        normalized.length > maxChars
          ? 'Text content extracted and truncated for prompt size.'
          : 'Text content extracted from uploaded file.',
    };
  }

  private isTextLikeFile(record: SharedFileRecord) {
    const mime = record.mimeType.toLowerCase();
    const extension = extname(record.filename).toLowerCase();

    return (
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('xml') ||
      mime.includes('javascript') ||
      mime.includes('typescript') ||
      mime.includes('yaml') ||
      mime.includes('csv') ||
      mime.includes('markdown') ||
      TEXT_FILE_EXTENSIONS.has(extension)
    );
  }

  private getDownloadExpiryIso(uploadedAt: Date) {
    return new Date(uploadedAt.getTime() + DOWNLOAD_RETENTION_MS).toISOString();
  }

  private isDownloadExpired(record: SharedFileRecord) {
    const expiresAt = new Date(record.expiresAt);
    return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now();
  }
}
