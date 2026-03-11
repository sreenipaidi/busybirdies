import { createWriteStream, createReadStream, mkdirSync, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { getLogger } from '../lib/logger.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface StoredFile {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Upload a file from a multipart upload to local disk storage.
 * storageKey format: tenantId/ticketId/timestamp-filename
 */
export async function uploadFile(
  tenantId: string,
  ticketId: string,
  file: MultipartFile,
): Promise<StoredFile> {
  const logger = getLogger();
  const timestamp = Date.now();
  const safeFileName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${tenantId}/${ticketId}/${timestamp}-${safeFileName}`;
  const fullPath = join(UPLOAD_DIR, storageKey);

  // Ensure directory exists
  const dir = join(UPLOAD_DIR, tenantId, ticketId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Stream file to disk
  let fileSize = 0;
  const writeStream = createWriteStream(fullPath);
  
  file.file.on('data', (chunk: Buffer) => {
    fileSize += chunk.length;
  });

  await pipeline(file.file, writeStream);

  logger.info({ storageKey, fileSize }, 'File uploaded to local storage');

  return {
    storageKey,
    fileName: file.filename,
    fileSize,
    mimeType: file.mimetype,
  };
}

/**
 * Get a readable stream for a stored file.
 */
export function getFileStream(storageKey: string) {
  const fullPath = join(UPLOAD_DIR, storageKey);
  return createReadStream(fullPath);
}

/**
 * Delete a stored file.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  const logger = getLogger();
  const fullPath = join(UPLOAD_DIR, storageKey);
  try {
    await unlink(fullPath);
    logger.info({ storageKey }, 'File deleted from local storage');
  } catch (err) {
    logger.warn({ err, storageKey }, 'Failed to delete file from storage');
  }
}
