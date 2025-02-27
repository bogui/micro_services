import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import crypto from 'crypto';

/**
 * Sanitizes and validates a file name to prevent path traversal and other security issues
 * @param originalName - The original file name or identifier
 * @returns A secure file name
 * @throws Error if the file name is invalid
 */
export function sanitizeFileName(originalName: string): string {
  // Remove any path components and non-alphanumeric characters
  const sanitized = originalName.replace(/[^a-zA-Z0-9-_]/g, '');

  if (!sanitized) {
    throw new Error('Invalid file name');
  }

  // Generate a unique hash using timestamp, random value, and process id (if available)
  const uniqueData = [
    originalName,
    Date.now(),
    Math.random(),
    process.pid || Math.random(), // Use process ID if available, otherwise another random value
  ].join('-');

  const hash = crypto
    .createHash('sha256')
    .update(uniqueData)
    .digest('hex')
    .slice(0, 8);

  return `${sanitized}-${hash}`;
}

/**
 * Creates a directory path for storing PDFs based on date and returns metadata
 * @param invoiceId - The ID of the invoice
 * @param subType - The type of the document
 * @param documentType - The type of the document (optional)
 * @returns Object containing the full path and metadata for storage
 */
export async function createPdfStoragePath(
  invoiceId: string,
  subType: string,
  documentType?: string,
): Promise<{
  filePath: string;
  metadata: {
    originalName: string;
    storagePath: string;
    fileName: string;
    subType: string;
    createdAt: string;
    expiresAt: string;
  };
}> {
  const year = new Date().getFullYear().toString();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const dirPath = path.join(config.storagePath, year, month);

  // Sanitize the invoice ID and create a unique file name
  const sanitizedName = sanitizeFileName(invoiceId);
  const fileName = `${sanitizedName}_${subType}.pdf`;

  // Create directory with proper permissions
  await fs.mkdir(dirPath, { recursive: true, mode: 0o770 });

  const filePath = path.join(dirPath, fileName);

  // Validate the final path is within the storage directory
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(config.storagePath))) {
    throw new Error('Invalid file path detected');
  }

  const now = new Date();

  // Set expiration date based on document type
  let expiresAt: Date;
  if (documentType === 'protocol') {
    // Protocols expire after 24 hours
    expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);
  } else {
    // Default expiration based on config
    expiresAt = new Date(now.getTime() + config.cacheDuration * 1000);
  }

  return {
    filePath,
    metadata: {
      originalName: invoiceId,
      storagePath: path.join(year, month, fileName),
      fileName,
      subType,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

/**
 * Validates a file path to ensure it's within the allowed storage directory
 * @param filePath - The path to validate
 * @throws Error if the path is invalid or outside the storage directory
 */
export function validateFilePath(filePath: string): void {
  const normalizedPath = path.normalize(filePath);
  const resolvedPath = path.resolve(normalizedPath);
  const storagePath = path.resolve(config.storagePath);

  if (!resolvedPath.startsWith(storagePath)) {
    throw new Error('Invalid file path: Path traversal detected');
  }

  // Additional checks for file name
  const fileName = path.basename(filePath);
  if (!/^[a-zA-Z0-9-_]+\.pdf$/.test(fileName)) {
    throw new Error('Invalid file name format');
  }
}

/**
 * Cleans up old PDF files based on cache duration
 */
export async function cleanupOldFiles(): Promise<void> {
  try {
    const now = Date.now();
    const maxAge = config.cacheDuration * 1000; // Convert to milliseconds

    async function* walkDir(dir: string): AsyncGenerator<string> {
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          yield* walkDir(fullPath);
        } else if (file.isFile() && file.name.endsWith('.pdf')) {
          yield fullPath;
        }
      }
    }

    for await (const filePath of walkDir(config.storagePath)) {
      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          await fs.unlink(filePath);
          console.log(`Deleted old file: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}
