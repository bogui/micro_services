# PDF Generation Service

A microservice dedicated to PDF generation for invoices and business documents, designed to optimize container size and resource utilization.

## Features

- PDF generation using Playwright Python (v1.50.0)
- Redis-based job queue
- File caching with automatic cleanup
  - Protocol documents expire after 24 hours
  - Regular documents (invoices, etc.) expire after 30 days (configurable)
- Containerized deployment
- Concurrent job processing
- Error handling and recovery
- Support for both invoices and protocols
- Automatic file cleanup based on cache duration
- Multi-language support (Bulgarian and English)
- Translation system with fallback to Bulgarian
- Template customization with Handlebars
- Live template preview during development
- Tailwind CSS styling with proper rendering
- Comprehensive test coverage
- Automatic currency formatting
- Date formatting with locale support

## Prerequisites

- Docker and Docker Compose
- Node.js 21+ (for local development)
- Redis 7+ (provided via Docker Compose)
- Python 3.8+ (for local development)

## Python Dependencies

The service requires the following Python packages:

```txt
playwright==1.50.0
```

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
   OLDER_THAN_DAYS=30
   DEFAULT_LOCALE=bg
   SUPPORTED_LOCALES=bg,en
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

## Template System

### Available Templates

- Invoice (`/templates/invoice/index.hbs`)
- Protocol (`/templates/protocol/index.hbs`)

### Partials

- Header (`/templates/partials/header.hbs`)
- Company Details (`/templates/partials/company-details.hbs`)
- Items Table (`/templates/partials/items-table.hbs`)
- Transaction Details (`/templates/partials/transaction-details.hbs`)
- Signatures (`/templates/partials/signatures.hbs`)

### Helpers

- `format` - Format numbers with currency
- `formatDate` - Format dates in various styles
- `t` - Translation helper
- `concat` - String concatenation
- `when` - Conditional rendering
- `eq` - Equality comparison
- Various math and array operations

### Translation System

The service supports multi-language templates through a translation system:

```typescript
// Translation helper usage in templates
{{ t 'invoice.title' }} // Translates to the current locale
{{ t 'company.name' locale='en' }} // Force English translation
{{ t 'amount' defaultValue='Amount' }} // Fallback if translation missing
```

Translation files are stored in:

```
/translations/
  bg.json  // Bulgarian translations (default)
  en.json  // English translations
```

Default locale is 'bg' (Bulgarian) with fallback for missing translations.

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
  jobId: string;
  invoiceId: string;
  locale?: string; // Default: 'bg'
  currency?: string; // Default: 'BGN'
  type?: 'invoice' | 'protocol';
  data: {
    documentNumber: string;
    date: string;
    dueDate?: string;
    supplier: {
      name: string;
      vatNumber: string;
      address: string;
      // ... other company details
    };
    recipient: {
      name: string;
      vatNumber: string;
      address: string;
      // ... other client details
    };
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    totals: {
      subtotal: number;
      vat: number;
      total: number;
    };
  };
  customStyles?: string; // Optional custom CSS
  customTemplate?: string; // Optional custom template name
}

// Submit job
await redis.publish(
  'pdf:jobs:new',
  JSON.stringify({
    jobId: 'unique-job-id',
    invoiceId: 'invoice-123',
    locale: 'en', // Optional, defaults to 'bg'
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

## Security Considerations

### 1. Container Security

The service implements several security measures in the Docker configuration:

```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
cap_add:
  - CHOWN
  - SETGID
  - SETUID
read_only: true
tmpfs:
  - /tmp
```

### 2. Redis Security

Redis is configured with ACL-based access control and proper authentication:

```
user pdf_service on >pdf_service_pwd +@all ~pdf:* ~job:* -@dangerous
user main_backend on >main_backend_pwd +@read +@write +@pubsub ~pdf:* ~job:* -@dangerous
user admin on >admin_pwd +@all
```

### 3. File System Security

- Secure file naming with hash to prevent collisions
- Path validation and sanitization
- Automatic file expiration and cleanup
- Metadata stored separately in Redis

### 4. Network Security

- Internal network isolation
- Port restrictions
- TLS encryption support

## Cleanup Service

The service includes an automated cleanup process for managing PDF lifecycles:

```typescript
const cleanupService = new CleanupService(redis);
await cleanupService.initialize();

// Find expired PDFs
const expiredPdfs = await cleanupService.findExpiredPdfs();

// Cleanup expired PDFs
const { cleaned, failed } = await cleanupService.cleanupExpiredPdfs();

// Schedule automatic cleanup
const timer = await cleanupService.scheduleCleanup(60);
```

### Document Expiration Policy

Different document types have different expiration periods:

- **Protocol documents**: Expire after 24 hours
- **Invoice and other documents**: Expire after the configured cache duration (default: 30 days)

This expiration policy is enforced at the time of document creation and is used by the cleanup service to determine which files should be removed.

## Monitoring

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

## Styling

The service uses Tailwind CSS for styling. Custom styles can be added in:

- `/templates/styles/main.css`

## Scripts

- `npm start` - Start the service
- `npm run dev` - Development mode
- `npm run dev:templates` - Template development with live reload
- `npm run build` - Build the project
- `npm run watch` - Watch TypeScript files
- `npm run clean` - Clean build directory
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Version

Current version: 1.6.1

## License

ISC

# PDF Service Documentation

## PDF Generation

The service now uses Playwright Python for PDF generation, which provides:

- Better CSS support including Tailwind CSS
- Improved font rendering
- More accurate page layouts
- Better handling of modern web features
- Improved response times - from 6s cold call to 2s

### PDF Generation Configuration

The PDF generation is configured with the following settings:

- Format: A4
- Margins: 20mm top, 0mm others
- Background graphics enabled
- Custom headers and footers
- Full support for modern CSS features
- Proper font rendering
