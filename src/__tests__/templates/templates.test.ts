import { templateService } from '../../services/template.service';
import {
  mockInvoiceData,
  verifyHtmlStructure,
  extractTextContent,
} from '../setup';
import { JobData } from '../../types';
import fs from 'fs/promises';
import path from 'path';
import translate from '../../helpers/translate.helper';
jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  access: jest.fn(),
  readFile: jest.fn(),
}));
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn(),
}));

describe('Template Generation', () => {
  beforeAll(async () => {
    // Mock fs.access to simulate CSS file exists
    (fs.access as jest.Mock).mockResolvedValue(undefined);

    // Mock path.join to use actual path.join for templates but handle CSS path
    (path.join as jest.Mock).mockImplementation((...paths: string[]) => {
      const actualPath = jest.requireActual('path').join(...paths);
      // Only modify paths for the CSS file
      if (actualPath.includes('dist/templates/styles/main.css')) {
        return '/dist/templates/styles/main.css';
      }
      return actualPath;
    });

    // Mock fs.readFile only for CSS file
    (fs.readFile as jest.Mock).mockImplementation(async (filePath: string) => {
      const actualFs = jest.requireActual('fs/promises');

      if (filePath.includes('dist/templates/styles/main.css')) {
        return `
          /* Base styles */
          .font-sans { font-family: sans-serif; }
          .text-gray-900 { color: #1a202c; }
          .text-gray-600 { color: #718096; }
          .text-primary { color: #2563eb; }
          
          /* Layout */
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .max-w-[50%] { max-width: 50%; }
          .w-full { width: 100%; }
          
          /* Spacing */
          .p-invoice-margin { padding: 40px; }
          .mb-10 { margin-bottom: 2.5rem; }
          .mb-8 { margin-bottom: 2rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .mb-1 { margin-bottom: 0.25rem; }
          .mt-15 { margin-top: 3.75rem; }
          .my-8 { margin: 2rem 0; }
          .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
          .pb-5 { padding-bottom: 1.25rem; }
          
          /* Typography */
          .text-lg { font-size: 1.125rem; }
          .text-sm { font-size: 0.875rem; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          
          /* Borders */
          .border-b-2 { border-bottom-width: 2px; }
          .border-gray-200 { border-color: #edf2f7; }
          .border-t-2 { border-top-width: 2px; }
          .border-primary { border-color: #2563eb; }
          
          /* Background */
          .bg-gray-50 { background-color: #f9fafb; }
          
          /* Document specific */
          .text-invoice-title { font-size: 32px; }
          .text-invoice-subtitle { font-size: 18px; }
          
          /* Table styles */
          .items-table th {
            padding: 0.75rem;
            background-color: #f9fafb;
            color: #2563eb;
            font-weight: 600;
            text-align: left;
          }
          
          .items-table td {
            padding: 0.75rem;
            border-bottom: 1px solid #edf2f7;
          }
        `;
      }

      // For all other files, use the actual fs.readFile
      return actualFs.readFile(filePath, 'utf-8');
    });

    await templateService.initialize();
  });

  describe('Invoice Template', () => {
    let html: string;
    let textContent: string;

    beforeEach(async () => {
      const jobData: JobData = {
        jobId: 'test-job-123',
        invoiceId: mockInvoiceData.documentNumber,
        type: 'invoice',
        subType: 'original',
        isCreditOrDebit: false,
        data: mockInvoiceData,
      };

      html = await templateService.render(jobData);
      textContent = extractTextContent(html);
    });

    describe('Structure validation', () => {
      it('should have valid HTML structure', async () => {
        expect(() => verifyHtmlStructure(html)).not.toThrow();
      });

      it('should include required CSS styles', async () => {
        const requiredStyles = [
          'font-family',
          'margin',
          'padding',
          'display: flex',
          'justify-content',
          'border-bottom',
          'text-align',
        ];

        requiredStyles.forEach(style => {
          expect(html).toContain(style);
        });
      });
    });

    describe('Content validation', () => {
      describe('Company details', () => {
        it('should include all company information', async () => {
          const { supplier } = mockInvoiceData;
          const requiredFields = [
            'name',
            'vatNumber',
            'identNumber',
            'city',
            'address',
            'representative',
          ];
          requiredFields.forEach(field => {
            expect(textContent).toContain(
              supplier[field as keyof typeof supplier],
            );
          });
        });
      });

      describe('Client details', () => {
        it('should include all client information', async () => {
          const { recipient } = mockInvoiceData;
          const requiredFields = [
            'name',
            'vatNumber',
            'identNumber',
            'city',
            'address',
            'representative',
          ];
          requiredFields.forEach(field => {
            expect(textContent).toContain(
              recipient[field as keyof typeof recipient],
            );
          });
        });
      });

      describe('Invoice details', () => {
        it('should include invoice metadata', async () => {
          const { documentNumber } = mockInvoiceData;
          expect(textContent).toContain(documentNumber);
          expect(textContent).toContain(translate('document.invoice', 'bg'));
          expect(textContent).toContain(translate('document.number', 'bg'));
          expect(textContent).toContain(translate('document.date', 'bg'));
          expect(textContent).toContain(translate('document.dueDate', 'bg'));
        });
      });

      describe('Items table', () => {
        it('should include table headers', async () => {
          const headers = [
            'number',
            'description',
            // 'unit', // Removed due to the fact, that there should be no unit in the table as separate column, but I left the column, removing the title
            'quantity',
            'price',
            'total',
          ];
          headers.forEach(header => {
            expect(textContent).toContain(
              translate(`document.table.${header}`, 'bg'),
            );
          });
        });

        it('should include all item details', async () => {
          mockInvoiceData.items.forEach(item => {
            expect(textContent).toContain(item.description);
            expect(html).toContain(item.quantity.toString());
            expect(html).toContain(item.price.toFixed(2));
            expect(html).toContain(item.total.toFixed(2));
          });
        });
      });

      describe('Totals section', () => {
        it('should include all total values', async () => {
          const { totals } = mockInvoiceData;
          const totalsFields = [
            'taxBase',
            'vatAmount',
            'vatAmountReduced',
            'final',
          ];
          totalsFields.forEach(field => {
            expect(textContent).toContain(
              translate(`document.totals.${field}`, 'bg'),
            );
            expect(html).toContain(
              totals[field as keyof typeof totals].toFixed(2),
            );
          });
        });
      });
    });
  });

  describe('Protocol Template', () => {
    let html: string;
    let textContent: string;

    beforeEach(async () => {
      const jobData: JobData = {
        jobId: 'test-job-123',
        invoiceId: mockInvoiceData.documentNumber,
        type: 'protocol',
        subType: 'original',
        isCreditOrDebit: false,
        data: mockInvoiceData,
      };

      html = await templateService.render(jobData);
      textContent = extractTextContent(html);
    });

    describe('Structure validation', () => {
      it('should have valid HTML structure', async () => {
        console.log(html);
        expect(() => verifyHtmlStructure(html)).not.toThrow();
      });

      it('should include required CSS styles', async () => {
        const requiredStyles = [
          'font-family',
          'margin',
          'padding',
          'display: flex',
          'justify-content',
          'border-bottom',
          'text-align',
        ];

        requiredStyles.forEach(style => {
          expect(html).toContain(style);
        });
      });
    });

    describe('Content validation', () => {
      describe('Company details', () => {
        it('should include all company information', async () => {
          const { supplier } = mockInvoiceData;
          const requiredFields = [
            'name',
            'vatNumber',
            'identNumber',
            'city',
            'address',
            'representative',
          ];
          requiredFields.forEach(field => {
            expect(textContent).toContain(
              supplier[field as keyof typeof supplier],
            );
          });
        });
      });

      describe('Client details', () => {
        it('should include all client information', async () => {
          const { recipient } = mockInvoiceData;
          const requiredFields = [
            'name',
            'vatNumber',
            'identNumber',
            'city',
            'address',
            'representative',
          ];
          requiredFields.forEach(field => {
            expect(textContent).toContain(
              recipient[field as keyof typeof recipient],
            );
          });
        });
      });

      describe('Document info', () => {
        it('should include document number and dates', async () => {
          expect(textContent).toContain(mockInvoiceData.documentNumber);
          expect(textContent).toContain(
            new Date(mockInvoiceData.date).toLocaleDateString('bg'),
          );
        });
      });

      describe('Items table', () => {
        it('should include table headers', async () => {
          expect(textContent).toContain(translate('document.number', 'bg'));
          expect(textContent).toContain(translate('document.date', 'bg'));
        });

        it('should include all items', async () => {
          mockInvoiceData.items.forEach(item => {
            expect(textContent).toContain(item.description);
            expect(textContent).toContain(item.quantity.toString());
            expect(textContent).toContain(item.total.toString());
          });
        });
      });

      describe('Total section', () => {
        it('should only include final total', async () => {
          expect(textContent).toContain(
            translate('document.totals.final', 'bg'),
          );
          expect(textContent).toContain(
            mockInvoiceData.totals.taxBase.toString(),
          );
          expect(textContent).not.toContain(
            translate('document.totals.taxBase', 'bg'),
          );
          expect(textContent).not.toContain(
            translate('document.totals.vatAmount', 'bg'),
          );
          expect(textContent).not.toContain(
            translate('document.totals.vatAmountReduced', 'bg'),
          );
        });
      });

      describe('Signature section', () => {
        it('should include signature blocks', async () => {
          expect(textContent).toContain(
            translate('document.signatures.supplier', 'bg'),
          );
          expect(textContent).toContain(
            translate('document.signatures.recipient', 'bg'),
          );
        });
      });
    });
  });
});
