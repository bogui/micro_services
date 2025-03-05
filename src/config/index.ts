import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
// Load environment variables from .env file if not in Docker environment
if (!process.env.DOCKER_CONTAINER) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

export const config = {
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  storagePath: process.env.STORAGE_PATH ?? './pdfs',
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS ?? '10', 10),
  jobTimeout: parseInt(process.env.JOB_TIMEOUT ?? '300', 10),
  cacheDuration: parseInt(process.env.CACHE_DURATION ?? '2592000', 10), // 30 days in seconds
  defaultLocale: process.env.DEFAULT_LOCALE ?? 'bg',
  supportedLocales: process.env.SUPPORTED_LOCALES?.split(',') ?? ['bg', 'en'],
  olderThan: process.env.OLDER_THAN_DAYS
    ? new Date(
        Date.now() -
          parseInt(process.env.OLDER_THAN_DAYS) * 24 * 60 * 60 * 1000,
      )
    : undefined,
};
