import Redis from 'ioredis';
import { config } from '../config';
import { generatePDF } from './pdf.service';
import { validateJobData } from '../utils/validation.utils';

interface JobError {
  message: string;
  code?: string;
  stack?: string;
}

export class RedisService {
  private subscriber: Redis;
  private publisher: Redis;

  constructor() {
    this.subscriber = new Redis(config.redisUrl);
    this.publisher = new Redis(config.redisUrl);
    this.setupSubscriptions();
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
            );
            await this.publisher.set(
              `pdf:invoice:${jobData.invoiceId}:metadata`,
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
            await this.publisher.set(`job:${jobData.jobId}:status`, 'failed');
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
      await this.subscriber.quit();
      await this.publisher.quit();
    } catch (error) {
      console.error('Error during Redis cleanup:', error);
    }
  }
}

export const redisService = new RedisService();
