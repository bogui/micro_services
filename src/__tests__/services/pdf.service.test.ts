import { generatePDF } from '../../services/pdf.service';
import { mockJobData } from '../setup';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';

jest.mock('puppeteer');
jest.mock('fs/promises');

describe('PDF Service', () => {
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPage = {
      setContent: jest.fn(),
      pdf: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    } as any;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any;

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
  });

  it('should generate PDF for invoice type', async () => {
    const result = await generatePDF({
      ...mockJobData,
      type: 'invoice',
    });

    expect(puppeteer.launch).toHaveBeenCalledWith({
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
