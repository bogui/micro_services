import { redisService } from './services/redis.service';
import { templateService } from './services/template.service';

async function main() {
  try {
    // Initialize template service
    await templateService.initialize();
    console.log('Template service initialized');

    // Start Redis service
    console.log('PDF Generation Service started');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

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

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
