import { CleanupService, ExpiredPdf } from '../../services/cleanup.service';
import Redis from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';

jest.mock('ioredis');
jest.mock('fs/promises');
jest.mock('../../config', () => ({
  config: {
    storagePath: '/test/pdfs',
    cacheDuration: 2592000, // 30 days
  },
}));

describe('Cleanup Service', () => {
  let cleanupService: CleanupService;
  let mockRedis: jest.Mocked<Redis>;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const mockExpiredPdfs: ExpiredPdf[] = [
    {
      key: 'pdf:invoice:123:metadata',
      metadata: {
        originalName: 'invoice-123',
        storagePath: '2024/03/invoice-123-abc123.pdf',
        fileName: 'invoice-123-abc123.pdf',
        createdAt: '2024-02-14T00:00:00.000Z',
        expiresAt: '2024-03-14T00:00:00.000Z',
      },
    },
    {
      key: 'pdf:invoice:456:metadata',
      metadata: {
        originalName: 'invoice-456',
        storagePath: '2024/03/invoice-456-def456.pdf',
        fileName: 'invoice-456-def456.pdf',
        createdAt: '2024-02-14T00:00:00.000Z',
        expiresAt: '2024-03-14T00:00:00.000Z',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockRedis = {
      ping: jest.fn().mockResolvedValue('PONG'),
      scan: jest
        .fn()
        .mockResolvedValue([
          '0',
          ['pdf:invoice:123:metadata', 'pdf:invoice:456:metadata'],
        ]),
      get: jest.fn().mockImplementation(key => {
        if (key === 'pdf:invoice:123:metadata') {
          return Promise.resolve(JSON.stringify(mockExpiredPdfs[0].metadata));
        } else if (key === 'pdf:invoice:456:metadata') {
          return Promise.resolve(JSON.stringify(mockExpiredPdfs[1].metadata));
        }
        return Promise.resolve(null);
      }),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    cleanupService = new CleanupService(mockRedis);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await cleanupService.initialize();
      expect(mockRedis.ping).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Cleanup service initialized successfully',
      );
    });

    it('should handle initialization errors', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection failed'));
      await expect(cleanupService.initialize()).rejects.toThrow(
        'Connection failed',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize cleanup service:',
        expect.any(Error),
      );
    });
  });

  describe('findExpiredPdfs', () => {
    it('should find expired PDFs', async () => {
      await cleanupService.initialize();
      const result = await cleanupService.findExpiredPdfs();
      expect(result).toEqual(mockExpiredPdfs);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'pdf:*:*:metadata',
        'COUNT',
        '100',
      );
    });

    it('should find PDFs expired before a specific date', async () => {
      await cleanupService.initialize();
      const date = new Date('2024-03-14T00:00:00.000Z');
      const result = await cleanupService.findExpiredPdfs(date);
      expect(result).toEqual(mockExpiredPdfs);
      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'pdf:*:*:metadata',
        'COUNT',
        '100',
      );
    });

    it('should handle Redis errors', async () => {
      await cleanupService.initialize();
      mockRedis.scan.mockRejectedValueOnce(new Error('Redis error'));
      await expect(cleanupService.findExpiredPdfs()).rejects.toThrow(
        'Redis error',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error finding expired PDFs:',
        expect.any(Error),
      );
    });
  });

  describe('cleanupExpiredPdfs', () => {
    beforeEach(() => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    });

    it('should cleanup expired PDFs', async () => {
      await cleanupService.initialize();
      const result = await cleanupService.cleanupExpiredPdfs();

      expect(result.cleaned).toEqual(mockExpiredPdfs);
      expect(result.failed).toEqual([]);

      // Verify file deletions
      mockExpiredPdfs.forEach(pdf => {
        const filePath = path.join(
          config.storagePath,
          pdf.metadata.storagePath,
        );
        expect(fs.unlink).toHaveBeenCalledWith(filePath);
      });

      // Verify Redis deletions
      mockExpiredPdfs.forEach(pdf => {
        const jobId = pdf.key.split(':')[2];
        expect(mockRedis.del).toHaveBeenCalledWith(pdf.key);
        expect(mockRedis.del).toHaveBeenCalledWith(`job:${jobId}:status`);
        expect(mockRedis.del).toHaveBeenCalledWith(`job:${jobId}:error`);
      });
    });

    it('should not delete files in dry run mode', async () => {
      await cleanupService.initialize();
      const result = await cleanupService.cleanupExpiredPdfs(true);

      expect(result.cleaned).toEqual(mockExpiredPdfs);
      expect(result.failed).toEqual([]);
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle file deletion errors', async () => {
      await cleanupService.initialize();
      (fs.unlink as jest.Mock).mockRejectedValueOnce(
        new Error('File delete failed'),
      );

      const result = await cleanupService.cleanupExpiredPdfs();

      expect(result.cleaned).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.message).toBe('File delete failed');
    });

    it('should handle Redis deletion errors', async () => {
      await cleanupService.initialize();
      mockRedis.del.mockRejectedValueOnce(new Error('Redis delete failed'));

      const result = await cleanupService.cleanupExpiredPdfs();

      expect(result.cleaned).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.message).toBe('Redis delete failed');
    });
  });

  describe('scheduled cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(global, 'setInterval');
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllTimers();
    });

    it('should schedule periodic cleanup', async () => {
      await cleanupService.initialize();
      const timer = await cleanupService.scheduleCleanup(30);

      // Verify initial cleanup
      expect(mockRedis.scan).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Scheduling cleanup to run every 30 minutes',
      );

      // Fast-forward time and run pending timers
      jest.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve(); // Let any pending promises resolve

      // Verify second cleanup was triggered
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30 * 60 * 1000,
      );

      await cleanupService.stopScheduledCleanup(timer);
      expect(consoleLogSpy).toHaveBeenCalledWith('Scheduled cleanup stopped');
    });

    it('should handle cleanup errors in scheduled runs', async () => {
      await cleanupService.initialize();

      // First call succeeds, second fails
      mockRedis.scan
        .mockResolvedValueOnce([
          '0',
          ['pdf:invoice:123:metadata', 'pdf:invoice:456:metadata'],
        ])
        .mockRejectedValueOnce(new Error('Scheduled cleanup failed'))
        .mockResolvedValueOnce([
          '0',
          ['pdf:invoice:123:metadata', 'pdf:invoice:456:metadata'],
        ]);

      const timer = await cleanupService.scheduleCleanup(30);

      // Fast-forward time and run pending timers
      jest.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve(); // Let any pending promises resolve

      // Verify error logging
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error finding expired PDFs:',
        expect.any(Error),
      );

      await cleanupService.stopScheduledCleanup(timer);
    });
  });
});
