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
  private redis: Redis;
  private findExpiredScript: string;
  private findExpiredSha: string | null = null;

  constructor(redis: Redis) {
    this.redis = redis;
    // Lua script to find expired PDFs
    this.findExpiredScript = `
      local expired = {}
      local cursor = "0"
      local now = ARGV[1]
      local pattern = "pdf:invoice:*:metadata"
      
      repeat
          local result = redis.call("SCAN", cursor, "MATCH", pattern, "COUNT", "100")
          cursor = result[1]
          local keys = result[2]
          
          for _, key in ipairs(keys) do
              local metadata = redis.call("GET", key)
              if metadata then
                  local data = cjson.decode(metadata)
                  if data.expiresAt <= now then
                      table.insert(expired, {key, metadata})
                  end
              end
          end
      until cursor == "0"
      return expired
    `;
  }

  async initialize(): Promise<void> {
    try {
      const sha = await this.redis.script('LOAD', this.findExpiredScript);
      if (typeof sha === 'string') {
        this.findExpiredSha = sha;
        console.log('Cleanup service initialized successfully');
      } else {
        throw new Error('Failed to load script: Invalid SHA returned');
      }
    } catch (error) {
      console.error('Failed to initialize cleanup service:', error);
      throw error;
    }
  }

  async findExpiredPdfs(beforeDate?: Date): Promise<ExpiredPdf[]> {
    try {
      const now = beforeDate?.toISOString() || new Date().toISOString();

      if (!this.findExpiredSha) {
        await this.initialize();
      }

      if (!this.findExpiredSha) {
        throw new Error('Failed to initialize cleanup service');
      }

      const results = await this.redis.evalsha(this.findExpiredSha, 0, now);

      if (!Array.isArray(results)) {
        throw new Error('Invalid response from Redis script');
      }

      return results.map(([key, metadata]: [string, string]) => ({
        key,
        metadata: JSON.parse(metadata),
      }));
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
