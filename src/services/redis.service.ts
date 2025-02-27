import Redis from 'ioredis';
import { config } from '../config';
import { generatePDF } from './pdf.service';
import { validateJobData } from '../utils/validation.utils';
import { CleanupService } from './cleanup.service';

interface JobError {
  message: string;
  code?: string;
  stack?: string;
}

export class RedisService {
  private readonly subscriber: Redis;
  private readonly publisher: Redis;
  private cleanupService: CleanupService | undefined;
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor() {
    this.subscriber = new Redis(config.redisUrl);
    this.publisher = new Redis(config.redisUrl);
    this.setupSubscriptions();
  }

  async initializeCleanup(olderThan?: Date) {
    try {
      // Create cleanup service instance using the publisher connection
      this.cleanupService = new CleanupService(this.publisher, olderThan);

      // Initialize the service
      await this.cleanupService.initialize();
      console.log('✓ Cleanup service initialized');

      // Schedule automatic cleanup (runs every hour)
      this.cleanupTimer = await this.cleanupService.scheduleCleanup(60);
      console.log('✓ Automatic cleanup scheduled (every 60 minutes)');
    } catch (error) {
      console.error('❌ Error initializing cleanup service:', error);
      console.log('⚠️ Cleanup service will not be available');
    }
  }

  async shutdownCleanup() {
    console.log('\nShutting down cleanup service...');
    try {
      // Stop scheduled cleanup
      if (this.cleanupTimer) {
        await this.cleanupService?.stopScheduledCleanup(this.cleanupTimer);
        console.log('✓ Scheduled cleanup stopped');
      }

      // Perform final cleanup if service is available
      if (this.cleanupService) {
        try {
          const result = await this.cleanupService.cleanupExpiredPdfs();
          console.log('Final cleanup results:', {
            cleaned: result.cleaned.length,
            failed: result.failed.length,
          });
        } catch (error) {
          console.error('⚠️ Final cleanup failed:', error);
        }
      }
    } catch (error) {
      console.error('❌ Error during cleanup shutdown:', error);
    }
  }

  private setupSubscriptions() {
    this.subscriber.subscribe('pdf:jobs:new', err => {
      if (err) {
        console.error('Failed to subscribe:', err);
        return;
      }
      console.log('Subscribed to pdf:jobs:new channel');
    });

    this.subscriber.on('message', async (channel, message) => {
      if (channel === 'pdf:jobs:new') {
        try {
          // Parse and validate job data before any Redis operations
          const jobData = JSON.parse(message);
          validateJobData(jobData);

          // Start processing
          console.log(`Processing job ${jobData.jobId}`);
          await this.publisher.set(`job:${jobData.jobId}:status`, 'processing');

          try {
            const { metadata } = await generatePDF(jobData);

            // Store success result
            await this.publisher.set(
              `job:${jobData.jobId}:status`,
              'completed',
              'EX',
              60 * 60 * 24,
            );
            await this.publisher.set(
              `pdf:${jobData.type}:${jobData.invoiceId}_${jobData.subType}:metadata`,
              JSON.stringify(metadata),
            );

            // Publish completion event
            await this.publisher.publish(
              'pdf:jobs:complete',
              JSON.stringify({
                jobId: jobData.jobId,
                invoiceId: jobData.invoiceId,
                ...metadata,
              }),
            );
          } catch (error) {
            console.error(
              `Error generating PDF for job ${jobData.jobId}:`,
              error,
            );

            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error occurred';

            // Store error result
            await this.publisher.set(
              `job:${jobData.jobId}:status`,
              'failed',
              'EX',
              60 * 60 * 24,
            );
            await this.publisher.set(
              `job:${jobData.jobId}:error`,
              JSON.stringify({
                message: errorMessage,
                code: error instanceof Error ? error.name : 'UnknownError',
                stack: error instanceof Error ? error.stack : undefined,
              } as JobError),
            );

            // Publish error event
            await this.publisher.publish(
              'pdf:jobs:error',
              JSON.stringify({
                jobId: jobData.jobId,
                error: errorMessage,
              }),
            );
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    });
  }

  async cleanup() {
    try {
      // First run cleanup service shutdown
      await this.shutdownCleanup();

      // Then close Redis connections
      await this.subscriber.quit();
      await this.publisher.quit();
    } catch (error) {
      console.error('Error during Redis cleanup:', error);
    }
  }
}

export const redisService = new RedisService();
