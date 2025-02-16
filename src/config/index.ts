import dotenv from 'dotenv';
dotenv.config();

export const config = {
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  storagePath: process.env.STORAGE_PATH ?? './pdfs',
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS ?? '10', 10),
  jobTimeout: parseInt(process.env.JOB_TIMEOUT ?? '300', 10),
  cacheDuration: parseInt(process.env.CACHE_DURATION ?? '2592000', 10), // 30 days in seconds
};
