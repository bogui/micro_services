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
          <title>{{title}}</title>
          <style>{{{styles}}}</style>
        </head>
        <body>
          {{> content }}
        </body>
        </html>
      `,
      ],
      ['header.hbs', '<div>{{companyDetails.name}}</div>'],
      ['footer.hbs', '<div>Footer</div>'],
      ['company-info.hbs', '<div>{{company.name}}</div>'],
      ['client-info.hbs', '<div>{{clientDetails.name}}</div>'],
      [
        'invoice/index.hbs',
        `
        {{#> base/layout title=(concat "Invoice " documentNumber)}}
          {{#*inline "content"}}
            <div>Invoice #{{invoiceNumber}}</div>
            <div>{{companyDetails.name}}</div>
            <div>{{clientDetails.name}}</div>
            <div class="totals">
              <div>Subtotal: \${{format subtotal}}</div>
              <div>Tax: \${{format tax}}</div>
              <div>Total: \${{format total}}</div>
            </div>
            <div>Thank you for your business!</div>
          {{/inline}}
        {{/base/layout}}
      `,
      ],
      [
        'protocol/index.hbs',
        `
        {{#> base/layout title=(concat "Protocol " documentNumber)}}
          {{#*inline "content"}}
            <div>Protocol #{{invoiceNumber}}</div>
            <div>{{companyDetails.name}}</div>
            <div>{{clientDetails.name}}</div>
            <div>Provider Signature</div>
            <div>Recipient Signature</div>
          {{/inline}}
        {{/base/layout}}
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
      `<title>Invoice ${mockJobData.data.invoiceNumber}</title>`,
    );
    expect(htmlContent).toContain(mockJobData.data.companyDetails.name);
    expect(htmlContent).toContain(mockJobData.data.clientDetails.name);
    expect(htmlContent).toContain(`#${mockJobData.data.invoiceNumber}`);
    expect(htmlContent).toContain(`$${mockJobData.data.subtotal.toFixed(2)}`);
    expect(htmlContent).toContain(`$${mockJobData.data.tax.toFixed(2)}`);
    expect(htmlContent).toContain(`$${mockJobData.data.total.toFixed(2)}`);
    expect(htmlContent).toContain('Thank you for your business!');

    // Verify PDF generation options
    expect(mockPage.pdf).toHaveBeenCalledWith({
      path: expect.stringContaining('.pdf'),
      format: 'A4',
      margin: {
        top: '40px',
        right: '40px',
        bottom: '40px',
        left: '40px',
      },
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
      `<title>Protocol ${mockJobData.data.invoiceNumber}</title>`,
    );
    expect(htmlContent).toContain(mockJobData.data.companyDetails.name);
    expect(htmlContent).toContain(mockJobData.data.clientDetails.name);
    expect(htmlContent).toContain(`#${mockJobData.data.invoiceNumber}`);
    expect(htmlContent).toContain('Provider Signature');
    expect(htmlContent).toContain('Recipient Signature');

    // Verify metadata
    expect(result.metadata.originalName).toBe(mockJobData.invoiceId);
    expect(result.metadata.fileName).toMatch(/^INV-2024-001-[a-f0-9]{8}\.pdf$/);
    expect(result.metadata.storagePath).toMatch(
      /^\d{4}\/\d{2}\/INV-2024-001-[a-f0-9]{8}\.pdf$/,
    );
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
