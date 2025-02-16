import puppeteer from 'puppeteer';
import { JobData } from '../types';
import { createPdfStoragePath, validateFilePath } from '../utils/file.utils';
import { generateInvoiceHTML } from '../templates/invoice.template';
import { generateProtocolHTML } from '../templates/protocol.template';

export async function generatePDF(jobData: JobData): Promise<{
  filePath: string;
  metadata: {
    originalName: string;
    storagePath: string;
    fileName: string;
    createdAt: string;
    expiresAt: string;
  };
}> {
  const browser = await puppeteer.launch({
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

  try {
    const page = await browser.newPage();

    // Generate HTML content from template
    const htmlContent =
      jobData.type === 'protocol'
        ? generateProtocolHTML(jobData.data)
        : generateInvoiceHTML(jobData.data);

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Create storage path and get metadata
    const { filePath, metadata } = await createPdfStoragePath(
      jobData.invoiceId,
    );

    // Validate the path before writing
    validateFilePath(filePath);

    // Generate PDF
    await page.pdf({
      path: filePath,
      format: 'A4',
      margin: {
        top: '40px',
        right: '40px',
        bottom: '40px',
        left: '40px',
      },
    });

    return { filePath, metadata };
  } finally {
    await browser.close();
  }
}
