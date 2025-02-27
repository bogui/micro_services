import {
  sanitizeFileName,
  createPdfStoragePath,
  validateFilePath,
} from '../../utils/file.utils';
import { config } from '../../config';
import path from 'path';
import fs from 'fs/promises';

jest.mock('fs/promises');
jest.mock('../../config', () => ({
  config: {
    storagePath: '/app/pdfs',
    cacheDuration: 2592000, // 30 days
  },
}));

describe('File Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sanitizeFileName', () => {
    it('should sanitize file names correctly', () => {
      const testCases = [
        { input: 'invoice-123', expected: /^invoice-123-[a-f0-9]{8}$/ },
        { input: 'test@file', expected: /^testfile-[a-f0-9]{8}$/ },
        { input: '../malicious/path', expected: /^maliciouspath-[a-f0-9]{8}$/ },
        { input: 'invoice_123', expected: /^invoice_123-[a-f0-9]{8}$/ },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = sanitizeFileName(input);
        expect(result).toMatch(expected);
      });
    });

    it('should throw error for invalid file names', () => {
      const invalidNames = ['', ' ', '.', ''];
      invalidNames.forEach(name => {
        expect(() => sanitizeFileName(name)).toThrow('Invalid file name');
      });
    });

    it('should generate unique names for same input', () => {
      const name = 'test-file';
      // Generate multiple names in rapid succession
      const results = new Set();
      for (let i = 0; i < 1000; i++) {
        results.add(sanitizeFileName(name));
      }

      // All generated names should be unique
      expect(results.size).toBe(1000);

      // All names should follow the expected pattern
      for (const result of results) {
        expect(result).toMatch(/^test-file-[a-f0-9]{8}$/);
      }
    });
  });

  describe('createPdfStoragePath', () => {
    beforeEach(() => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    });

    it('should create valid storage path and metadata', async () => {
      const invoiceId = 'INV-2024-001';
      const result = await createPdfStoragePath(invoiceId, 'original');
      const now = new Date();
      const currentYear = now.getFullYear().toString();
      const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toMatchObject({
        originalName: invoiceId,
      });

      // Verify file name format
      expect(result.metadata.fileName).toMatch(
        /^INV-2024-001-[a-f0-9]{8}_(original|copy)\.pdf$/,
      );

      // Verify storage path format
      expect(result.metadata.storagePath).toMatch(
        new RegExp(
          `^${currentYear}/${currentMonth}/INV-2024-001-[a-f0-9]{8}_(original|copy)\\.pdf$`,
        ),
      );

      // Verify dates
      const createdDate = new Date(result.metadata.createdAt);
      const expiryDate = new Date(result.metadata.expiresAt);
      const expectedExpiry = new Date(
        createdDate.getTime() + config.cacheDuration * 1000,
      );

      expect(expiryDate.getTime()).toBe(expectedExpiry.getTime());

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/${currentYear}/${currentMonth}$`)),
        expect.objectContaining({
          recursive: true,
          mode: 0o770,
        }),
      );
    });

    it('should handle path traversal attempts', async () => {
      const maliciousId = '../../../etc/passwd';
      const result = await createPdfStoragePath(maliciousId, 'original');

      expect(result.filePath).toContain(config.storagePath);
      expect(result.filePath).not.toContain('..');
      expect(path.resolve(result.filePath)).toMatch(/^\/app\/pdfs\/.+\.pdf$/);
    });

    it('should create valid expiration date based on config for regular documents', async () => {
      const result = await createPdfStoragePath('test', 'original');

      const createdDate = new Date(result.metadata.createdAt);
      const expiryDate = new Date(result.metadata.expiresAt);
      const timeDiff = expiryDate.getTime() - createdDate.getTime();

      expect(timeDiff).toBe(config.cacheDuration * 1000);
    });

    it('should create shorter expiration date for protocol documents', async () => {
      const result = await createPdfStoragePath('test', 'original', 'protocol');

      const createdDate = new Date(result.metadata.createdAt);
      const expiryDate = new Date(result.metadata.expiresAt);
      const timeDiff = expiryDate.getTime() - createdDate.getTime();
      const oneDayInMs = 1000 * 60 * 60 * 24;

      expect(timeDiff).toBe(oneDayInMs);
    });
  });

  describe('validateFilePath', () => {
    it('should validate correct paths', () => {
      const validPaths = [
        '/app/pdfs/2024/03/invoice-123-abc123.pdf',
        '/app/pdfs/test-file-def456.pdf',
      ];

      validPaths.forEach(path => {
        expect(() => validateFilePath(path)).not.toThrow();
      });
    });

    it('should reject path traversal attempts', () => {
      const invalidPaths = [
        '../../../etc/passwd',
        '/app/pdfs/../../../etc/passwd',
        '/tmp/malicious.pdf',
        '/app/pdfs/../../secret.pdf',
      ];

      invalidPaths.forEach(path => {
        expect(() => validateFilePath(path)).toThrow('Path traversal detected');
      });
    });

    it('should reject invalid file names', () => {
      const invalidNames = [
        '/app/pdfs/invalid*.pdf',
        '/app/pdfs/test file.pdf',
        '/app/pdfs/test<script>.pdf',
        '/app/pdfs/test@file.pdf',
      ];

      invalidNames.forEach(path => {
        expect(() => validateFilePath(path)).toThrow(
          'Invalid file name format',
        );
      });
    });
  });
});
