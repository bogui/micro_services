import { Redis } from 'ioredis';
import { CleanupService } from '../services/cleanup.service';
import { config } from '../config';

async function cleanupExample() {
  // Initialize Redis connection
  const redis = new Redis(config.redisUrl);

  // Create cleanup service instance
  const cleanupService = new CleanupService(redis);

  try {
    // Initialize the service (required before first use)
    await cleanupService.initialize();

    // 1. Find expired PDFs
    const expiredPdfs = await cleanupService.findExpiredPdfs();
    console.log(`Found ${expiredPdfs.length} expired PDFs`);

    // 2. Find PDFs expired before a specific date
    const date = new Date('2024-03-14');
    const expiredBeforeDate = await cleanupService.findExpiredPdfs(date);
    console.log(
      `Found ${expiredBeforeDate.length} PDFs expired before ${date}`,
    );

    // 3. Cleanup expired PDFs (dry run)
    const dryRunResult = await cleanupService.cleanupExpiredPdfs(true);
    console.log('Dry run results:', {
      cleaned: dryRunResult.cleaned.length,
      failed: dryRunResult.failed.length,
    });

    // 4. Perform actual cleanup
    const cleanupResult = await cleanupService.cleanupExpiredPdfs();
    console.log('Cleanup results:', {
      cleaned: cleanupResult.cleaned.length,
      failed: cleanupResult.failed.length,
    });

    // 5. Schedule automatic cleanup (runs every hour)
    const timer = await cleanupService.scheduleCleanup(60); // eslint-disable-line @typescript-eslint/no-unused-vars

    // Later, when shutting down:
    // await cleanupService.stopScheduledCleanup(timer);
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    // Clean up Redis connection
    await redis.quit();
  }
}

// Example of integrating with your application shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  try {
    // Cleanup logic here
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Run the example
cleanupExample().catch(console.error);
