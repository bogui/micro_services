import { config } from './config';
import { templateService } from './services/template.service';
import { redisService } from './services/redis.service';

async function initialize() {
  const olderThan = config.olderThan;
  try {
    // Initialize template service
    await templateService.initialize();
    console.log('✓ Template service initialized');

    // Initialize cleanup functionality in Redis service
    await redisService.initializeCleanup(olderThan);
    console.log('✓ Application initialized successfully');
  } catch (error) {
    console.error('❌ Error during initialization:', error);
    throw error;
  }
}

async function shutdown() {
  console.log('\nStarting graceful shutdown...');
  try {
    // Run Redis service cleanup (includes cleanup service shutdown)
    await redisService.cleanup();
    console.log('✓ All services cleaned up successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register cleanup handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the application
initialize().catch(error => {
  console.error('Failed to initialize application:', error);
  process.exit(1);
});
