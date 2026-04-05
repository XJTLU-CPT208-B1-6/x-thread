import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { join } from 'path';
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
  uploaderId: string;
  uploaderNickname: string;
}

interface SharedFilesIndex {
  version: 2;
  folders: SharedFolderRecord[];
  files: SharedFileRecord[];
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class SharedFilesService {
  private readonly storageRoot = join(process.cwd(), 'storage', 'shared-files');

  constructor(private readonly roomsService: RoomsService) {}

  async listFiles(roomId: string, userId: string) {
    await this.roomsService.ensureMembership(roomId, userId);
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
      uploaderId: userId,
      uploaderNickname,
    };

    index.files.unshift(record);
    await this.writeIndex(roomId, index);

    return record;
  }

  async getDownload(roomId: string, userId: string, fileId: string) {
    await this.roomsService.ensureMembership(roomId, userId);
    const index = await this.readIndex(roomId);
    const record = index.files.find((file) => file.id === fileId);

    if (!record) {
      throw new NotFoundException('Shared file not found');
    }

    const path = join(this.getRoomDir(roomId), record.storedName);
    await fs.access(path);

    return {
      record,
      stream: createReadStream(path),
    };
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
        | Array<Omit<SharedFileRecord, 'folderId'> & { folderId?: string | null }>;

      if (Array.isArray(parsed)) {
        return {
          version: 2,
          folders: [],
          files: parsed.map((file) => ({
            ...file,
            folderId: file.folderId ?? null,
          })),
        };
      }

      return {
        version: 2,
        folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        files: Array.isArray(parsed.files) ? parsed.files : [],
      };
    } catch {
      return {
        version: 2,
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
}
