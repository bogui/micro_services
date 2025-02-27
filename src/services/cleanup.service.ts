import { Redis } from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

export interface PdfMetadata {
  originalName: string;
  storagePath: string;
  fileName: string;
  createdAt: string;
  expiresAt: string;
}

export interface ExpiredPdf {
  key: string;
  metadata: PdfMetadata;
}

export class CleanupService {
  private readonly redis: Redis;
  private readonly olderThan: Date | null = null;

  constructor(redis: Redis, olderThan?: Date) {
    this.redis = redis;
    this.olderThan = olderThan ?? null;
  }

  async initialize(): Promise<void> {
    try {
      // Simple ping to verify connection
      await this.redis.ping();
      console.log('Cleanup service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cleanup service:', error);
      throw error;
    }
  }

  async findExpiredPdfs(beforeDate?: Date): Promise<ExpiredPdf[]> {
    try {
      const now =
        beforeDate?.toISOString() ??
        this.olderThan?.toISOString() ??
        new Date().toISOString();

      const expired: ExpiredPdf[] = [];
      let cursor = '0';

      do {
        // Scan for metadata keys
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          'pdf:*:*:metadata',
          'COUNT',
          '100',
        );
        cursor = newCursor;

        // Get metadata for each key
        for (const key of keys) {
          const metadata = await this.redis.get(key);
          if (metadata) {
            const data = JSON.parse(metadata) as PdfMetadata;
            if (data.expiresAt <= now) {
              expired.push({ key, metadata: data });
            }
          }
        }
      } while (cursor !== '0');

      return expired;
    } catch (error) {
      console.error('Error finding expired PDFs:', error);
      throw error;
    }
  }

  async cleanupExpiredPdfs(dryRun = false): Promise<{
    cleaned: ExpiredPdf[];
    failed: Array<{ pdf: ExpiredPdf; error: Error }>;
  }> {
    const cleaned: ExpiredPdf[] = [];
    const failed: Array<{ pdf: ExpiredPdf; error: Error }> = [];

    try {
      const expiredPdfs = await this.findExpiredPdfs();
      console.log(`Found ${expiredPdfs.length} expired PDFs`);

      for (const pdf of expiredPdfs) {
        try {
          if (!dryRun) {
            // Delete the PDF file
            const filePath = path.join(
              config.storagePath,
              pdf.metadata.storagePath,
            );
            await fs.unlink(filePath);

            // Delete the metadata from Redis
            await this.redis.del(pdf.key);

            // Delete any associated job data
            const jobId = pdf.key.split(':')[2]; // Extract jobId from key pattern
            await this.redis.del(`job:${jobId}:status`);
            await this.redis.del(`job:${jobId}:error`);
          }

          cleaned.push(pdf);
          console.log(`Cleaned up expired PDF: ${pdf.metadata.originalName}`);
        } catch (error) {
          console.error(
            `Error cleaning up PDF ${pdf.metadata.originalName}:`,
            error,
          );
          failed.push({ pdf, error: error as Error });
        }
      }

      return { cleaned, failed };
    } catch (error) {
      console.error('Error during cleanup process:', error);
      throw error;
    }
  }

  async scheduleCleanup(intervalMinutes: number = 60): Promise<NodeJS.Timeout> {
    console.log(`Scheduling cleanup to run every ${intervalMinutes} minutes`);

    // Run initial cleanup
    await this.cleanupExpiredPdfs();

    // Schedule periodic cleanup
    return setInterval(
      async () => {
        try {
          await this.cleanupExpiredPdfs();
        } catch (error) {
          console.error('Scheduled cleanup failed:', error);
        }
      },
      intervalMinutes * 60 * 1000,
    );
  }

  async stopScheduledCleanup(timer: NodeJS.Timeout): Promise<void> {
    clearInterval(timer);
    console.log('Scheduled cleanup stopped');
  }
}
