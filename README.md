# PDF Generation Service

A microservice dedicated to PDF generation for invoices and business documents, designed to optimize container size and resource utilization.

## Features

- PDF generation using Puppeteer
- Redis-based job queue
- File caching with automatic cleanup
- Containerized deployment
- Concurrent job processing
- Error handling and recovery
- Support for both invoices and protocols
- Automatic file cleanup based on cache duration

## Prerequisites

- Docker and Docker Compose
- Node.js 21+ (for local development)
- Redis 7+ (provided via Docker Compose)

## Setup

1. Clone the repository
2. Navigate to the pdf-service directory
3. Create a `.env` file with the following variables (optional, defaults provided):
   ```env
   REDIS_URL=redis://pdf_service:pdf_service_pwd@redis:6379
   STORAGE_PATH=/app/pdfs
   MAX_CONCURRENT_JOBS=10
   JOB_TIMEOUT=300
   CACHE_DURATION=2592000
   ```
4. Configure Redis ACL users (optional, defaults provided in redis.acl):

   ```bash
   # Copy the default ACL configuration
   cp redis.acl.example redis.acl

   # Edit redis.acl and change the default passwords:
   # - pdf_service_pwd for the PDF service
   # - main_backend_pwd for the main backend
   # - admin_pwd for admin access
   ```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Run tests (Node.js deprecation warnings are suppressed)
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Testing Configuration

The test suite is configured with the following features:

- Uses Jest with TypeScript support (ts-jest)
- Test environment: jsdom
- Automatic test discovery in `__tests__` directories
- Code coverage thresholds set to 80%
- Node.js deprecation warnings are suppressed for cleaner test output
- Concurrent test execution with 50% of available CPU cores
- 10-second timeout for individual tests

## Docker Deployment

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Integration with Main Backend

### 1. Redis Configuration

Ensure your main backend has access to the same Redis instance with proper authentication:

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: 'redis',
  port: 6379,
  username: 'main_backend',
  password: 'main_backend_pwd',
  retryStrategy: times => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});
```

### 2. Job Submission

To generate a PDF, publish a job to the Redis channel:

```typescript
interface JobData {
  jobId: string; // Unique identifier for the job
  invoiceId: string; // Invoice/Protocol identifier
  data: {
    invoiceNumber: string;
    date: string;
    dueDate?: string; // Optional for protocols
    companyDetails: {
      name: string;
      address: string;
      email: string;
      phone: string;
    };
    clientDetails: {
      name: string;
      address: string;
      email: string;
    };
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
  };
}

// Submit job
await redis.publish(
  'pdf:jobs:new',
  JSON.stringify({
    jobId: 'unique-job-id',
    invoiceId: 'invoice-123',
    data: {
      // ... invoice data
    },
  }),
);

// Store job status reference
await redis.set(`job:unique-job-id:status`, 'pending');
```

### 3. Job Status Monitoring

Monitor job status using Redis keys:

```typescript
// Check job status
const status = await redis.get(`job:${jobId}:status`);
// Status can be: 'pending', 'processing', 'completed', 'failed'

// Get PDF metadata when completed
const metadata = await redis.get(`pdf:invoice:${invoiceId}:metadata`);
const { path, createdAt, expiresAt } = JSON.parse(metadata);
```

### 4. Event Handling

Subscribe to job events:

```typescript
// Success channel
redis.subscribe('pdf:jobs:complete', (err, count) => {
  if (err) console.error('Failed to subscribe:', err);
});

redis.on('message', (channel, message) => {
  if (channel === 'pdf:jobs:complete') {
    const { jobId, invoiceId, path } = JSON.parse(message);
    // Handle successful generation
  }
});

// Error channel
redis.subscribe('pdf:jobs:error', (err, count) => {
  if (err) console.error('Failed to subscribe:', err);
});

redis.on('message', (channel, message) => {
  if (channel === 'pdf:jobs:error') {
    const { jobId, error } = JSON.parse(message);
    // Handle error
  }
});
```

### 5. File Access

PDF files are stored in a structured directory format:

```
/pdfs/
  /{year}/
    /{month}/
      /{invoiceId}.pdf
```

Configure shared volume in your main service's docker-compose:

```yaml
services:
  main-service:
    volumes:
      - pdf-storage:/app/pdfs
    # ... other configuration

volumes:
  pdf-storage:
    external: true
    name: pdf-service_pdf-storage
```

### 6. Error Handling

Implement error handling for common scenarios:

```typescript
try {
  // Submit job
  await redis.publish('pdf:jobs:new', jobData);

  // Wait for completion with timeout
  const status = await waitForJobCompletion(jobId, 30000); // 30s timeout

  if (status === 'failed') {
    // Handle failure
    const error = await redis.get(`job:${jobId}:error`);
    throw new Error(`PDF generation failed: ${error}`);
  }

  // Get file path
  const metadata = await redis.get(`pdf:invoice:${invoiceId}:metadata`);
  const { path } = JSON.parse(metadata);

  // Serve or process the PDF
  return path;
} catch (error) {
  // Handle errors
  console.error('PDF generation error:', error);
  throw error;
}
```

## API Reference

### Redis Channels

- `pdf:jobs:new` - Submit new PDF generation jobs
- `pdf:jobs:complete` - Listen for completed jobs
- `pdf:jobs:error` - Listen for job errors

### Redis Keys

- `job:{id}:status` - Job status (pending/processing/completed/failed)
- `pdf:invoice:{id}:metadata` - PDF metadata and cache information

### Environment Variables

| Variable            | Description               | Default            |
| ------------------- | ------------------------- | ------------------ |
| REDIS_URL           | Redis connection URL      | redis://redis:6379 |
| STORAGE_PATH        | PDF storage directory     | /app/pdfs          |
| MAX_CONCURRENT_JOBS | Maximum concurrent jobs   | 10                 |
| JOB_TIMEOUT         | Job timeout in seconds    | 300                |
| CACHE_DURATION      | Cache duration in seconds | 2592000            |

## Cleanup Service

The PDF service includes an automated cleanup service that manages the lifecycle of generated PDFs and their associated metadata.

### Features

- Automatic detection and removal of expired PDFs
- Redis metadata cleanup
- Scheduled periodic cleanup
- Dry run mode for testing
- Detailed cleanup reporting
- Error handling and logging

### Usage

```typescript
import { Redis } from 'ioredis';
import { CleanupService } from './services/cleanup.service';

// Initialize the service
const redis = new Redis(config.redisUrl);
const cleanupService = new CleanupService(redis);
await cleanupService.initialize();

// Find expired PDFs
const expiredPdfs = await cleanupService.findExpiredPdfs();
// Or find PDFs expired before a specific date
const expiredBeforeDate = await cleanupService.findExpiredPdfs(
  new Date('2024-03-14'),
);

// Cleanup expired PDFs
const { cleaned, failed } = await cleanupService.cleanupExpiredPdfs();
console.log(`Cleaned up ${cleaned.length} PDFs, ${failed.length} failed`);

// Dry run to see what would be cleaned up without actually deleting
const dryRun = await cleanupService.cleanupExpiredPdfs(true);

// Schedule automatic cleanup (every hour by default)
const timer = await cleanupService.scheduleCleanup(60);

// Stop scheduled cleanup when needed
await cleanupService.stopScheduledCleanup(timer);
```

### Cleanup Process

1. **Initialization**

   - Loads and compiles a Lua script for efficient Redis scanning
   - Validates Redis connection and script loading

2. **Finding Expired PDFs**

   - Uses Redis SCAN for efficient key iteration
   - Checks expiration dates in metadata
   - Returns list of expired PDFs with metadata

3. **Cleanup Operation**

   - Deletes PDF files from storage
   - Removes Redis metadata
   - Cleans up associated job data
   - Handles errors gracefully
   - Reports success and failures

4. **Scheduled Cleanup**
   - Configurable cleanup interval
   - Automatic error recovery
   - Logging of cleanup operations
   - Safe shutdown handling

### Error Handling

The cleanup service includes comprehensive error handling:

```typescript
try {
  const { cleaned, failed } = await cleanupService.cleanupExpiredPdfs();

  if (failed.length > 0) {
    console.error(
      'Some PDFs failed to clean up:',
      failed.map(f => ({
        name: f.pdf.metadata.originalName,
        error: f.error.message,
      })),
    );
  }
} catch (error) {
  console.error('Cleanup process failed:', error);
}
```

### Monitoring

Monitor cleanup operations through:

```typescript
// Get current cleanup status
const status = await redis.get('pdf:cleanup:status');

// Get last cleanup results
const lastRun = await redis.get('pdf:cleanup:last_run');

// Monitor cleanup events
redis.subscribe('pdf:cleanup:events', (err, count) => {
  if (err) console.error('Failed to subscribe:', err);
});

redis.on('message', (channel, message) => {
  if (channel === 'pdf:cleanup:events') {
    const event = JSON.parse(message);
    console.log('Cleanup event:', event);
  }
});
```

### Best Practices

1. **Regular Monitoring**

   - Monitor cleanup success rates
   - Track storage usage
   - Set up alerts for cleanup failures

2. **Performance Optimization**

   - Schedule cleanups during low-traffic periods
   - Use appropriate cleanup intervals
   - Monitor Redis memory usage

3. **Error Recovery**

   - Implement retry mechanisms
   - Log failed cleanups for manual review
   - Monitor cleanup job duration

4. **Storage Management**
   - Regular disk space monitoring
   - Backup verification before cleanup
   - Storage quota management

## Testing

The service includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Maintenance

### Cleanup Old Files

Files are automatically cleaned up based on `CACHE_DURATION`. To manually trigger cleanup:

```typescript
await redis.publish('pdf:maintenance:cleanup', '');
```

### Monitoring

Monitor service health using Redis keys:

```typescript
// Get active job count
const activeJobs = await redis.get('pdf:stats:active_jobs');

// Get error count
const errorCount = await redis.get('pdf:stats:error_count');

// Get cache hit ratio
const cacheHits = await redis.get('pdf:stats:cache_hits');
const cacheMisses = await redis.get('pdf:stats:cache_misses');
```

## Security Considerations

### 1. Container Security

#### Docker Security Features

- Read-only root filesystem
- No new privileges
- Dropped capabilities
- Limited capabilities for PDF service
- Temporary filesystem for volatile data
- Internal network isolation
- Volume access restrictions

#### Container Hardening

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add: # Only for PDF service
  - CHOWN
  - SETGID
  - SETUID
read_only: true
tmpfs:
  - /tmp
```

### 2. Redis Security

#### Redis Configuration

- ACL-based access control
- Memory limits and policies
- Persistence configuration
- Network restrictions
- Password protection
- TLS encryption (optional)

```bash
redis-server --aclfile /etc/redis/redis.acl \
  --requirepass admin_pwd \
  --maxmemory 512mb \
  --maxmemory-policy allkeys-lru \
  --appendonly yes \
  --appendfsync everysec
```

#### ACL Configuration

1. PDF Service User (`pdf_service`):

   ```
   user pdf_service on >pdf_service_pwd +@all ~pdf:* ~job:* -@dangerous
   ```

   - Full access to PDF service operations
   - Restricted to PDF and job-related keys
   - Dangerous commands disabled

2. Main Backend User (`main_backend`):

   ```
   user main_backend on >main_backend_pwd +@read +@write +@pubsub ~pdf:* ~job:* -@dangerous
   ```

   - Limited to necessary operations
   - Read/write access for specific keys
   - Pub/sub for job notifications

3. Admin User (`admin`):
   ```
   user admin on >admin_pwd +@all
   ```
   - Full access for maintenance
   - Should be used only for administration

#### Password Security

1. Generate secure passwords:

   ```bash
   # Generate random passwords
   openssl rand -base64 32 > redis_passwords.txt

   # Set permissions
   chmod 600 redis_passwords.txt
   ```

2. Update passwords in redis.acl:

   ```bash
   # Backup current ACL
   cp redis.acl redis.acl.backup

   # Update passwords
   sed -i "s/>pdf_service_pwd/>new_secure_password/" redis.acl
   ```

3. Update environment variables:
   ```bash
   # Update .env file
   sed -i "s/pdf_service_pwd/new_secure_password/" .env
   ```

### 3. Network Security

#### Network Isolation

```yaml
networks:
  pdf-network:
    driver: bridge
    internal: true # No external connectivity
```

#### Port Restrictions

```yaml
ports:
  - '127.0.0.1:6379:6379' # Local access only
```

### 4. File System Security

#### File Naming and Storage

```typescript
// Secure file naming with hash to prevent collisions
function sanitizeFileName(originalName: string): string {
  const sanitized = originalName.replace(/[^a-zA-Z0-9-_]/g, '');
  const hash = crypto
    .createHash('sha256')
    .update(originalName + Date.now().toString())
    .digest('hex')
    .slice(0, 8);
  return `${sanitized}-${hash}`;
}

// File metadata stored in Redis
interface FileMetadata {
  originalName: string; // Original invoice ID
  storagePath: string; // Relative path in storage
  fileName: string; // Sanitized name with hash
  createdAt: string; // Creation timestamp
  expiresAt: string; // Expiration timestamp
}

// Example Redis storage
await redis.set(
  `pdf:invoice:${invoiceId}:metadata`,
  JSON.stringify({
    originalName: 'INV-2024-001',
    storagePath: '2024/03/INV2024001-a1b2c3d4.pdf',
    fileName: 'INV2024001-a1b2c3d4.pdf',
    createdAt: '2024-03-14T12:00:00Z',
    expiresAt: '2024-04-13T12:00:00Z',
  }),
);
```

#### Security Measures

- File names are sanitized to prevent path traversal
- Unique hash added to prevent name collisions
- Original file names preserved in metadata
- Path validation before file operations
- Strict file name format enforcement
- File paths always relative to storage root
- Metadata stored separately in Redis
- Regular expression validation for file names
- Storage directory structure by date
- Automatic file expiration and cleanup

### 5. Application Security

#### Input Validation

- Sanitize all job input data
- Validate file paths
- Check file size limits
- Verify content types

```typescript
interface SecurityConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  maxConcurrentJobs: number;
  rateLimits: {
    perMinute: number;
    perHour: number;
  };
}
```

#### Rate Limiting

```typescript
const rateLimiter = new RateLimiter({
  points: 60, // Number of points
  duration: 60, // Per 60 seconds
  blockDuration: 120, // Block for 2 minutes if exceeded
});
```

#### Error Handling

```typescript
try {
  // Sanitize input
  const sanitizedData = sanitizeJobData(jobData);

  // Validate limits
  await validateResourceLimits(sanitizedData);

  // Check rate limits
  await rateLimiter.consume(clientId);

  // Process job
  await processJob(sanitizedData);
} catch (error) {
  // Log securely
  await secureLogger.error({
    event: 'job_error',
    error: error.message,
    jobId,
    timestamp: new Date().toISOString(),
  });

  // Return safe error message
  throw new PublicError('Job processing failed');
}
```

### 6. Monitoring and Logging

#### Security Monitoring

```typescript
// Monitor failed authentication attempts
redis.on('auth-error', async error => {
  await alertSystem.notify({
    level: 'high',
    type: 'security',
    message: 'Redis authentication failure detected',
  });
});

// Monitor resource usage
setInterval(async () => {
  const stats = await getResourceStats();
  if (stats.memory > 85) {
    await alertSystem.notify({
      level: 'medium',
      type: 'resource',
      message: 'High memory usage detected',
    });
  }
}, 60000);
```

#### Audit Logging

```typescript
const auditLogger = {
  log: async (event: AuditEvent) => {
    await redis.xadd('audit:log', '*', {
      timestamp: Date.now(),
      event: event.type,
      user: event.user,
      action: event.action,
      resource: event.resource,
      status: event.status,
    });
  },
};
```

### 7. Backup and Recovery

#### Data Backup

```bash
# Automated backup script
#!/bin/bash
timestamp=$(date +%Y%m%d_%H%M%S)
backup_dir="/secure/backups"

# Backup Redis data
redis-cli -a admin_pwd --rdb "$backup_dir/redis_$timestamp.rdb"

# Backup PDF files
tar czf "$backup_dir/pdfs_$timestamp.tar.gz" ./pdfs

# Encrypt backups
gpg --encrypt --recipient admin@company.com "$backup_dir/redis_$timestamp.rdb"
gpg --encrypt --recipient admin@company.com "$backup_dir/pdfs_$timestamp.tar.gz"

# Clean old backups
find "$backup_dir" -type f -mtime +7 -delete
```

#### Recovery Procedures

1. Stop services:

   ```bash
   docker-compose down
   ```

2. Restore data:

   ```bash
   # Decrypt backup
   gpg --decrypt redis_backup.rdb.gpg > redis_backup.rdb

   # Restore Redis data
   docker-compose up -d redis
   redis-cli -a admin_pwd --rdb redis_backup.rdb

   # Restore PDF files
   tar xzf pdfs_backup.tar.gz
   ```

3. Verify integrity:

   ```bash
   # Check Redis data
   redis-cli -a admin_pwd --scan --pattern "pdf:*"

   # Verify PDF files
   find ./pdfs -type f -exec md5sum {} \; > current_checksums
   diff current_checksums backup_checksums
   ```

### 8. Security Updates

#### Regular Maintenance

```bash
# Update base images
docker pull redis:7-alpine
docker pull node:21-alpine

# Rebuild with updates
docker-compose build --no-cache
docker-compose up -d

# Check for vulnerabilities
docker scan pdf-service
docker scan redis
```

#### Security Patches

1. Monitor security advisories
2. Test patches in staging
3. Deploy during maintenance window
4. Verify system integrity
5. Update documentation

## Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests: `npm test`
4. Submit a pull request

## License

ISC
