jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));
jest.mock('fs/promises');
jest.mock('path', () => ({
  join: (...paths: string[]) => paths.join('/'),
  resolve: (...paths: string[]) => {
    const joined = paths.join('/');
    return joined.startsWith('/') ? joined : `/${joined}`;
  },
  normalize: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/'),
  basename: (path: string) => path.split('/').pop() ?? '',
}));
jest.mock('../../config', () => ({
  config: {
    storagePath: '/test/pdfs',
    cacheDuration: 2592000,
    maxConcurrentJobs: 10,
    jobTimeout: 300,
    redisUrl: 'redis://localhost:6379',
  },
}));

import { generatePDF } from '../../services/pdf.service';
import { mockJobData } from '../setup';
import fs from 'fs/promises';
import { templateService } from '../../services/template.service';
import { spawn } from 'child_process';

describe('PDF Service', () => {
  let mockPythonProcess: any;
  const mockSpawn = spawn as jest.Mock;

  beforeAll(async () => {
    // Mock file system operations for template service
    const mockTemplates = new Map([
      ['main.css', 'body { margin: 0; }'],
      [
        'layout.hbs',
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>{{title}} #{{documentNumber}}</title>
          <style>{{{styles}}}</style>
        </head>
        <body>
          {{> content }}
        </body>
        </html>
      `,
      ],
      ['header.hbs', '<div>{{supplier.name}}</div>'],
      ['footer.hbs', '<div>Footer</div>'],
      ['company-details.hbs', '<div>{{supplier.name}}</div>'],
      ['items-table.hbs', '<div>{{#each items}}{{description}}{{/each}}</div>'],
      ['transaction-details.hbs', '<div>{{transaction.description}}</div>'],
      ['signatures.hbs', '<div>{{recipient.name}}</div>'],
      [
        'invoice/index.hbs',
        `
        {{#> layout title=(t "document.invoice")}}
          {{#*inline "content"}}
            <div>{{t "document.invoice"}} #{{documentNumber}}</div>
            <div>{{supplier.name}}</div>
            <div>{{recipient.name}}</div>
            <div class="totals">
              <div>{{t "document.totals.taxBase"}}: {{format totals.taxBase currency}}</div>
              <div>{{t "document.totals.vatAmount"}}: {{format totals.vatAmount currency}}</div>
              <div>{{t "document.totals.final"}}: {{format totals.final currency}}</div>
            </div>
            <div>Thank you for your business!</div>
          {{/inline}}
        {{/layout}}
      `,
      ],
      [
        'protocol/index.hbs',
        `
        {{#> layout title=(t "document.protocol")}}
          {{#*inline "content"}}
            <div>{{t "document.protocol"}} #{{documentNumber}}</div>
            <div>{{supplier.name}}</div>
            <div>{{recipient.name}}</div>
            <div>{{t "document.signatures.supplier"}}</div>
            <div>{{t "document.signatures.recipient"}}</div>
          {{/inline}}
        {{/layout}}
      `,
      ],
      [
        'vat-response.hbs',
        `
        <table>
          <tr>
            <td class='font-bold'>{{t 'vatResponse.address'}}</td>
            <td>{{vatResponse.address}}</td>
          </tr>
          <tr>
            <td class='font-bold'>{{t 'vatResponse.countryCode'}}</td>
            <td>{{vatResponse.countryCode}}</td>
          </tr>
          <tr>
            <td class='font-bold'>{{t 'vatResponse.name'}}</td>
            <td>{{vatResponse.name}}</td>
          </tr>
          <tr>
            <td class='font-bold'>{{t 'vatResponse.vatNumber'}}</td>
            <td>{{vatResponse.vatNumber}}</td>
          </tr>
          <tr>
            <td class='font-bold'>{{t 'vatResponse.requestDate'}}</td>
            <td>{{formatDate vatResponse.requestDate 'short'}}</td>
          </tr>
          <tr>
            <td class='font-bold'>{{t 'vatResponse.requestId'}}</td>
            <td>{{vatResponse.requestId}}</td>
          </tr>
        </table>
        `,
      ],
    ]);

    // Mock fs.access and fs.readFile for template initialization
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockImplementation(async (filePath: string) => {
      const fileName = filePath.split('/').pop() ?? '';
      const templatePath = fileName.includes('index.hbs')
        ? `${filePath.split('/').slice(-2).join('/')}`
        : fileName;
      const content = mockTemplates.get(templatePath);

      if (content === undefined) {
        throw new Error(`Mock template not found: ${templatePath}`);
      }
      return content;
    });

    // Initialize template service
    await templateService.initialize();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Python process
    mockPythonProcess = {
      stdout: {
        on: jest.fn((event: string, callback: (data: Buffer) => void) => {
          if (event === 'data') {
            callback(Buffer.from(JSON.stringify({ success: true })));
          }
        }),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn((event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          callback(0);
        }
      }),
    };

    mockSpawn.mockReturnValue(mockPythonProcess);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it('should generate PDF for invoice type', async () => {
    const result = await generatePDF({
      ...mockJobData,
      type: 'invoice',
    });

    // Verify Python script was called with correct arguments
    expect(mockSpawn).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining(['src/scripts/pdf_generator.py']),
    );

    // Verify the data passed to Python script
    const pythonData = JSON.parse(mockSpawn.mock.calls[0][1][1]);
    expect(pythonData.htmlContent).toContain(
      `<title>Фактура #${mockJobData.data.documentNumber}</title>`,
    );
    expect(pythonData.htmlContent).toContain(mockJobData.data.supplier.name);
    expect(pythonData.htmlContent).toContain(mockJobData.data.recipient.name);
    expect(pythonData.htmlContent).toContain(
      `#${mockJobData.data.documentNumber}`,
    );
    expect(pythonData.htmlContent).toContain(
      `${mockJobData.data.totals.taxBase.toFixed(2)} лв.`,
    );
    expect(pythonData.htmlContent).toContain(
      `${mockJobData.data.totals.vatAmount.toFixed(2)} лв.`,
    );
    expect(pythonData.htmlContent).toContain(
      `${mockJobData.data.totals.final.toFixed(2)} лв.`,
    );
    expect(pythonData.htmlContent).toContain('Thank you for your business!');

    // Verify metadata
    expect(result.metadata.originalName).toBe(mockJobData.invoiceId);
    expect(result.metadata.fileName).toMatch(
      /^INV-2024-001_[a-f0-9]{8}_(original|copy)\.pdf$/,
    );
    expect(result.metadata.storagePath).toMatch(
      /^\d{4}\/\d{2}\/INV-2024-001_[a-f0-9]{8}_(original|copy)\.pdf$/,
    );
    expect(new Date(result.metadata.createdAt)).toBeInstanceOf(Date);
    expect(new Date(result.metadata.expiresAt)).toBeInstanceOf(Date);
  });

  it('should generate PDF for protocol type', async () => {
    const result = await generatePDF({
      ...mockJobData,
      type: 'protocol',
    });

    // Verify Python script was called with correct arguments
    expect(mockSpawn).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining(['src/scripts/pdf_generator.py']),
    );

    // Verify the data passed to Python script
    const pythonData = JSON.parse(mockSpawn.mock.calls[0][1][1]);
    expect(pythonData.htmlContent).toContain(
      `<title>Протокол #${mockJobData.data.documentNumber}</title>`,
    );
    expect(pythonData.htmlContent).toContain(mockJobData.data.supplier.name);
    expect(pythonData.htmlContent).toContain(mockJobData.data.recipient.name);
    expect(pythonData.htmlContent).toContain(
      `#${mockJobData.data.documentNumber}`,
    );
    expect(pythonData.htmlContent).toContain('Получател');
    expect(pythonData.htmlContent).toContain('Доставчик');

    // Verify metadata
    expect(result.metadata.originalName).toBe(mockJobData.invoiceId);
    expect(result.metadata.fileName).toMatch(
      /^INV-2024-001_[a-f0-9]{8}_(original|copy)\.pdf$/,
    );
    expect(result.metadata.storagePath).toMatch(
      /^\d{4}\/\d{2}\/INV-2024-001_[a-f0-9]{8}_(original|copy)\.pdf$/,
    );
    expect(new Date(result.metadata.createdAt)).toBeInstanceOf(Date);
    expect(new Date(result.metadata.expiresAt)).toBeInstanceOf(Date);
  });

  it('should handle PDF generation errors', async () => {
    mockPythonProcess.stderr.on.mockImplementation(
      (event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') {
          callback(Buffer.from('Python script error'));
        }
      },
    );
    mockPythonProcess.on.mockImplementation(
      (event: string, callback: (code: number) => void) => {
        if (event === 'close') {
          callback(1);
        }
      },
    );

    await expect(generatePDF(mockJobData)).rejects.toThrow(
      'Failed to generate PDF: Python script failed: Python script error',
    );
  });

  it('should handle invalid job data', async () => {
    const invalidData = {
      ...mockJobData,
      invoiceId: '',
    };

    await expect(generatePDF(invalidData)).rejects.toThrow();
  });

  it('should set correct expiration date for protocol documents', async () => {
    const result = await generatePDF({
      ...mockJobData,
      type: 'protocol',
    });

    const createdDate = new Date(result.metadata.createdAt);
    const expiryDate = new Date(result.metadata.expiresAt);
    const timeDiff = expiryDate.getTime() - createdDate.getTime();
    const oneDayInMs = 1000 * 60 * 60 * 24;

    expect(timeDiff).toBe(oneDayInMs);
  });

  it('should set default expiration date for non-protocol documents', async () => {
    const result = await generatePDF({
      ...mockJobData,
      type: 'invoice',
    });

    const createdDate = new Date(result.metadata.createdAt);
    const expiryDate = new Date(result.metadata.expiresAt);
    const timeDiff = expiryDate.getTime() - createdDate.getTime();

    // Default cache duration from config
    expect(timeDiff).toBe(2592000 * 1000);
  });
});
