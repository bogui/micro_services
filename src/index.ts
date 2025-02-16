import { redisService } from './services/redis.service';

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal. Cleaning up...');
  await redisService.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT signal. Cleaning up...');
  await redisService.cleanup();
  process.exit(0);
});

console.log('PDF Generation Service started');
