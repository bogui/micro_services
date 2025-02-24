import puppeteer from 'puppeteer';
import { JobData } from '../types';
import { createPdfStoragePath, validateFilePath } from '../utils/file.utils';
import { templateService } from './template.service';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://hmo.hyperm.online';
const APP_NAME = process.env.APP_NAME ?? 'Hyper M';

export async function generatePDF(jobData: JobData): Promise<{
  filePath: string;
  metadata: {
    originalName: string;
    storagePath: string;
    fileName: string;
    createdAt: string;
    expiresAt: string;
  };
  time?: string;
}> {
  const start = performance.now();

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

    // Generate HTML content using template service
    const htmlContent = await templateService.render(jobData);

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
      printBackground: true,
      margin: {
        top: '20px',
        right: 0,
        bottom: '0px',
        left: 0,
      },
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="color: #000; display: flex; justify-content: flex-end; align-items: center; font-size: 12px; margin-top: 10px; width: 100%; gap: 4px; padding-right: 40px;">Страница <div style="color: #000;" class="pageNumber"></div> от <div style="color: #000;" class="totalPages"></div></div>',
      footerTemplate: `<div style="color: #000; display: flex; justify-content: flex-start; align-items: center; font-size: 12px; margin-top: 10px; width: 100%; gap: 4px; padding-left: 40px;">Генерирано от <a href="${FRONTEND_URL}">${APP_NAME}</a> ${FRONTEND_URL}</div>`,
    });

    const end = performance.now();
    const time = `PDF generation took ${end - start} milliseconds`;

    return { filePath, metadata, time };
  } finally {
    await browser.close();
  }
}
