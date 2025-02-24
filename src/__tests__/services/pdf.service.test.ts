jest.mock('puppeteer', () => ({
  launch: jest.fn(),
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

describe('PDF Service', () => {
  let mockBrowser: { newPage: jest.Mock; close: jest.Mock };
  let mockPage: { setContent: jest.Mock; pdf: jest.Mock; close: jest.Mock };
  const mockPuppeteer = jest.requireMock('puppeteer');

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

    mockPage = {
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it('should generate PDF for invoice type', async () => {
    const result = await generatePDF({
      ...mockJobData,
      type: 'invoice',
    });

    expect(mockPuppeteer.launch).toHaveBeenCalledWith({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    // Verify HTML content
    const htmlContent = mockPage.setContent.mock.calls[0][0];
    expect(htmlContent).toContain(
      `<title>Фактура #${mockJobData.data.documentNumber}</title>`,
    );
    expect(htmlContent).toContain(mockJobData.data.supplier.name);
    expect(htmlContent).toContain(mockJobData.data.recipient.name);
    expect(htmlContent).toContain(`#${mockJobData.data.documentNumber}`);
    expect(htmlContent).toContain(
      `${mockJobData.data.totals.taxBase.toFixed(2)} лв.`,
    );
    expect(htmlContent).toContain(
      `${mockJobData.data.totals.vatAmount.toFixed(2)} лв.`,
    );
    expect(htmlContent).toContain(
      `${mockJobData.data.totals.final.toFixed(2)} лв.`,
    );
    expect(htmlContent).toContain('Thank you for your business!');

    // Verify PDF generation options
    expect(mockPage.pdf).toHaveBeenCalledWith({
      path: expect.stringContaining('.pdf'),
      format: 'A4',
      margin: {
        top: '20px',
        right: 0,
        bottom: '0px',
        left: 0,
      },
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      footerTemplate: expect.stringContaining('Hyper M'),
      headerTemplate: expect.stringContaining('pageNumber'),
    });

    // Verify metadata
    expect(result.metadata.originalName).toBe(mockJobData.invoiceId);
    expect(result.metadata.fileName).toMatch(/^INV-2024-001-[a-f0-9]{8}\.pdf$/);
    expect(result.metadata.storagePath).toMatch(
      /^\d{4}\/\d{2}\/INV-2024-001-[a-f0-9]{8}\.pdf$/,
    );
    expect(new Date(result.metadata.createdAt)).toBeInstanceOf(Date);
    expect(new Date(result.metadata.expiresAt)).toBeInstanceOf(Date);
  });

  it('should generate PDF for protocol type', async () => {
    const result = await generatePDF({
      ...mockJobData,
      type: 'protocol',
    });

    // Verify HTML content
    const htmlContent = mockPage.setContent.mock.calls[0][0];
    expect(htmlContent).toContain(
      `<title>Протокол #${mockJobData.data.documentNumber}</title>`,
    );
    expect(htmlContent).toContain(mockJobData.data.supplier.name);
    expect(htmlContent).toContain(mockJobData.data.recipient.name);
    expect(htmlContent).toContain(`#${mockJobData.data.documentNumber}`);
    expect(htmlContent).toContain('Получател');
    expect(htmlContent).toContain('Доставчик');

    // Verify PDF generation options
    expect(mockPage.pdf).toHaveBeenCalledWith({
      path: expect.stringContaining('.pdf'),
      format: 'A4',
      margin: {
        top: '20px',
        right: 0,
        bottom: '0px',
        left: 0,
      },
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      footerTemplate: expect.stringContaining('Hyper M'),
      headerTemplate: expect.stringContaining('pageNumber'),
    });

    // Verify metadata
    expect(result.metadata.originalName).toBe(mockJobData.invoiceId);
    expect(result.metadata.fileName).toMatch(/^INV-2024-001-[a-f0-9]{8}\.pdf$/);
    expect(result.metadata.storagePath).toMatch(
      /^\d{4}\/\d{2}\/INV-2024-001-[a-f0-9]{8}\.pdf$/,
    );
    expect(new Date(result.metadata.createdAt)).toBeInstanceOf(Date);
    expect(new Date(result.metadata.expiresAt)).toBeInstanceOf(Date);
  });

  it('should handle PDF generation errors', async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error('PDF generation failed'));

    await expect(generatePDF(mockJobData)).rejects.toThrow(
      'PDF generation failed',
    );
  });

  it('should handle invalid job data', async () => {
    const invalidData = {
      ...mockJobData,
      invoiceId: '',
    };

    await expect(generatePDF(invalidData)).rejects.toThrow();
  });

  it('should cleanup resources after generation', async () => {
    await generatePDF(mockJobData);
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('should cleanup resources on error', async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error('Generation failed'));

    try {
      await generatePDF(mockJobData);
    } catch (error) {
      expect(mockBrowser.close).toHaveBeenCalled();
    }
  });
});
