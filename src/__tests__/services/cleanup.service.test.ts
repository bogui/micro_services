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
    mockRedis = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      script: jest.fn().mockImplementation((command, ...args) => {
        if (command === 'LOAD') {
          return Promise.resolve('script-sha');
        }
        return Promise.reject(new Error(`Unknown script command: ${command}`));
      }),
      evalsha: jest
        .fn()
        .mockResolvedValue(
          mockExpiredPdfs.map(pdf => [pdf.key, JSON.stringify(pdf.metadata)]),
        ),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    cleanupService = new CleanupService(mockRedis);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('initialization', () => {
    it('should load the Lua script on initialization', async () => {
      await cleanupService.initialize();
      expect(mockRedis.script).toHaveBeenCalledWith(
        'LOAD',
        expect.stringContaining('local expired = {}'),
      );
    });

    it('should handle initialization errors', async () => {
      mockRedis.script.mockRejectedValueOnce(new Error('Script load failed'));
      await expect(cleanupService.initialize()).rejects.toThrow(
        'Script load failed',
      );
    });
  });

  describe('findExpiredPdfs', () => {
    it('should find expired PDFs', async () => {
      await cleanupService.initialize();
      const result = await cleanupService.findExpiredPdfs();
      expect(result).toEqual(mockExpiredPdfs);
    });

    it('should find PDFs expired before a specific date', async () => {
      await cleanupService.initialize();
      const date = new Date('2024-03-14T00:00:00.000Z');
      const result = await cleanupService.findExpiredPdfs(date);
      expect(result).toEqual(mockExpiredPdfs);
      expect(mockRedis.evalsha).toHaveBeenCalledWith(
        expect.any(String),
        0,
        date.toISOString(),
      );
    });

    it('should handle Redis errors', async () => {
      await cleanupService.initialize();
      mockRedis.evalsha.mockRejectedValueOnce(new Error('Redis error'));
      await expect(cleanupService.findExpiredPdfs()).rejects.toThrow(
        'Redis error',
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
      expect(mockRedis.evalsha).toHaveBeenCalledTimes(1);

      // Fast-forward time and run pending timers
      jest.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve(); // Let any pending promises resolve

      // Verify second cleanup was triggered
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        30 * 60 * 1000,
      );

      await cleanupService.stopScheduledCleanup(timer);
    });

    it('should handle cleanup errors in scheduled runs', async () => {
      await cleanupService.initialize();
      mockRedis.evalsha
        .mockResolvedValueOnce(
          mockExpiredPdfs.map(pdf => [pdf.key, JSON.stringify(pdf.metadata)]),
        )
        .mockRejectedValueOnce(new Error('Scheduled cleanup failed'))
        .mockResolvedValueOnce(
          mockExpiredPdfs.map(pdf => [pdf.key, JSON.stringify(pdf.metadata)]),
        );

      const timer = await cleanupService.scheduleCleanup(30);

      // Fast-forward time and run pending timers
      jest.advanceTimersByTime(30 * 60 * 1000);
      await Promise.resolve(); // Let any pending promises resolve

      // Verify the cleanup was attempted despite the error
      expect(mockRedis.evalsha).toHaveBeenCalledTimes(2);

      // Verify error logging sequence
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        'Error finding expired PDFs:',
        expect.any(Error),
      );

      await cleanupService.stopScheduledCleanup(timer);
    });
  });
});
