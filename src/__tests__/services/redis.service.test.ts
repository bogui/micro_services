import Redis from 'ioredis';
import { RedisService } from '../../services/redis.service';
import { generatePDF } from '../../services/pdf.service';
import { mockJobData } from '../setup';
import { MockRedis } from '../mocks/redis.mock';
import { ValidationError } from '../../utils/validation.utils';

// Mock Redis
jest.mock('ioredis');

// Mock PDF service
jest.mock('../../services/pdf.service', () => ({
  generatePDF: jest.fn(),
}));

// Mock validation utils
jest.mock('../../utils/validation.utils', () => {
  const original = jest.requireActual('../../utils/validation.utils');
  return {
    ...original,
    validateJobData: jest.fn().mockImplementation(data => {
      if (!data || typeof data !== 'object') {
        throw new ValidationError('Invalid job data format');
      }
      if (!data.jobId || !data.invoiceId || !data.data) {
        throw new ValidationError('Invalid or missing required fields');
      }
    }),
  };
});

// Mock console to prevent noise in test output
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

describe('Redis Service', () => {
  let redisService: RedisService;
  let mockRedis: jest.Mocked<Redis>;
  let mockSubscriber: jest.Mocked<Redis>;
  let subscribeCallback: (err: Error | null, count: number) => void;
  let messageCallback: (channel: string, message: string) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create separate instances for subscriber and publisher
    mockRedis = new MockRedis() as unknown as jest.Mocked<Redis>;
    mockSubscriber = new MockRedis() as unknown as jest.Mocked<Redis>;

    // Mock Redis constructor to return different instances
    const MockRedisClass = Redis as jest.MockedClass<typeof Redis>;
    MockRedisClass.mockImplementationOnce(
      () => mockSubscriber,
    ).mockImplementationOnce(() => mockRedis);

    // Mock subscriber methods
    mockSubscriber.subscribe = jest
      .fn()
      .mockImplementation((channel, callback) => {
        subscribeCallback = callback;
        return Promise.resolve();
      });

    mockSubscriber.on = jest.fn().mockImplementation((event, callback) => {
      if (event === 'message') {
        messageCallback = callback;
      }
      return mockSubscriber;
    });

    redisService = new RedisService();
  });

  afterEach(async () => {
    await redisService.cleanup();
  });

  describe('Initialization', () => {
    it('should subscribe to pdf:jobs:new channel', () => {
      expect(mockSubscriber.subscribe).toHaveBeenCalledWith(
        'pdf:jobs:new',
        expect.any(Function),
      );

      // Simulate successful subscription
      subscribeCallback(null, 1);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Subscribed to pdf:jobs:new channel'),
      );
    });

    it('should handle subscription errors', () => {
      const error = new Error('Subscription failed');
      subscribeCallback(error, 0);
      expect(console.error).toHaveBeenCalledWith('Failed to subscribe:', error);
    });
  });

  describe('Job Processing', () => {
    it('should handle new job messages successfully', async () => {
      const metadata = {
        originalName: 'test.pdf',
        storagePath: '2024/03/test.pdf',
        fileName: 'test-123.pdf',
        createdAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };

      (generatePDF as jest.Mock).mockResolvedValue({
        filePath: 'test/path',
        metadata,
      });

      messageCallback('pdf:jobs:new', JSON.stringify(mockJobData));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify job status updates
      expect(mockRedis.set).toHaveBeenCalledWith(
        `job:${mockJobData.jobId}:status`,
        'processing',
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        `job:${mockJobData.jobId}:status`,
        'completed',
        'EX',
        60 * 60 * 24,
      );

      // Verify metadata storage
      expect(mockRedis.set).toHaveBeenCalledWith(
        `pdf:invoice:${mockJobData.invoiceId}_${mockJobData.subType}:metadata`,
        JSON.stringify(metadata),
      );

      // Verify completion event
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'pdf:jobs:complete',
        expect.stringContaining(mockJobData.jobId),
      );
    });

    it('should handle PDF generation errors properly', async () => {
      const error = new Error('PDF generation failed');
      (generatePDF as jest.Mock).mockRejectedValue(error);

      messageCallback('pdf:jobs:new', JSON.stringify(mockJobData));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error status
      expect(mockRedis.set).toHaveBeenCalledWith(
        `job:${mockJobData.jobId}:status`,
        'failed',
        'EX',
        60 * 60 * 24,
      );

      // Verify error storage
      expect(mockRedis.set).toHaveBeenCalledWith(
        `job:${mockJobData.jobId}:error`,
        expect.stringContaining('PDF generation failed'),
      );

      // Verify error event
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'pdf:jobs:error',
        expect.stringContaining(mockJobData.jobId),
      );

      // Verify error logging
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `Error generating PDF for job ${mockJobData.jobId}`,
        ),
        error,
      );
    });

    it('should handle invalid JSON data', async () => {
      messageCallback('pdf:jobs:new', 'invalid json');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Error processing message:',
        expect.any(SyntaxError),
      );
    });

    it('should handle missing required job data', async () => {
      // Mock validation to throw before any Redis operations
      const validationError = new ValidationError(
        'Invalid or missing required fields',
      );
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../utils/validation.utils').validateJobData.mockImplementationOnce(
        () => {
          throw validationError;
        },
      );

      messageCallback('pdf:jobs:new', JSON.stringify({}));
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        'Error processing message:',
        validationError,
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup Redis connections properly', async () => {
      await redisService.cleanup();

      expect(mockRedis.quit).toHaveBeenCalled();
      expect(mockSubscriber.quit).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const quitError = new Error('Quit failed');
      mockRedis.quit.mockRejectedValueOnce(quitError);

      await redisService.cleanup();
      expect(console.error).toHaveBeenCalledWith(
        'Error during Redis cleanup:',
        quitError,
      );
    });
  });
});
