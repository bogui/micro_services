import { spawn } from 'child_process';
import { JobData } from '../types';
import { createPdfStoragePath, validateFilePath } from '../utils/file.utils';
import { templateService } from './template.service';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://hmo.hyper-m.online';
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

  try {
    // Generate HTML content using template service
    const htmlContent = await templateService.render(jobData);

    // Create storage path and get metadata
    const { filePath, metadata } = await createPdfStoragePath(
      jobData.invoiceId,
      jobData.subType,
      jobData.type,
    );

    // Validate the path before writing
    validateFilePath(filePath);

    // Prepare data for Python script
    const pythonData = {
      htmlContent,
      filePath,
      frontendUrl: FRONTEND_URL,
      appName: APP_NAME,
    };

    // Execute Python script
    const result = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        'src/scripts/pdf_generator.py',
        JSON.stringify(pythonData),
      ]);

      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', data => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', data => {
        errorData += data.toString();
      });

      pythonProcess.on('close', code => {
        if (code !== 0) {
          reject(new Error(`Python script failed: ${errorData}`));
        } else {
          resolve(JSON.parse(outputData));
        }
      });
    });

    console.log('result', result);

    const end = performance.now();
    const time = `PDF generation took ${end - start} milliseconds`;

    console.log('time', time);

    return { filePath, metadata, time };
  } catch (error: any) {
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}
