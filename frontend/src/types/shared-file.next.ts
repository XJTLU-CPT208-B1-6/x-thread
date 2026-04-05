export interface SharedFolder {
  id: string;
  roomId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creatorNickname: string;
}

export interface SharedFile {
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

export interface SharedFileTree {
  folders: SharedFolder[];
  files: SharedFile[];
}
