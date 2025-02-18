import { templateService } from '../../services/template.service';
import {
  mockInvoiceData,
  verifyHtmlStructure,
  extractTextContent,
} from '../setup';
import { JobData } from '../../types';

describe('Template Generation', () => {
  beforeAll(async () => {
    await templateService.initialize();
  });

  describe('Invoice Template', () => {
    let html: string;
    let textContent: string;

    beforeEach(async () => {
      const jobData: JobData = {
        jobId: 'test-job-123',
        invoiceId: mockInvoiceData.invoiceNumber,
        type: 'invoice',
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
          const { companyDetails } = mockInvoiceData;
          Object.values(companyDetails).forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Client details', () => {
        it('should include all client information', async () => {
          const { clientDetails } = mockInvoiceData;
          Object.values(clientDetails).forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Invoice details', () => {
        it('should include invoice metadata', async () => {
          const { invoiceNumber, date, dueDate } = mockInvoiceData;
          [invoiceNumber, date, dueDate].forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Items table', () => {
        it('should include table headers', async () => {
          const headers = ['Description', 'Quantity', 'Unit Price', 'Total'];
          headers.forEach(header => {
            expect(textContent).toContain(header);
          });
        });

        it('should include all item details', async () => {
          mockInvoiceData.items.forEach(item => {
            expect(textContent).toContain(item.description);
            expect(textContent).toContain(item.quantity.toString());
            expect(html).toContain(item.unitPrice.toFixed(2));
            expect(html).toContain(item.total.toFixed(2));
          });
        });
      });

      describe('Totals section', () => {
        it('should include all total values', async () => {
          const { subtotal, tax, total } = mockInvoiceData;
          const totals: [string, number][] = [
            ['Subtotal', subtotal],
            ['Tax', tax],
            ['Total', total],
          ];

          totals.forEach(([label, value]) => {
            expect(textContent).toContain(label);
            expect(html).toContain(value.toFixed(2));
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
        invoiceId: mockInvoiceData.invoiceNumber,
        type: 'protocol',
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
          const { companyDetails } = mockInvoiceData;
          Object.values(companyDetails).forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Client details', () => {
        it('should include all client information', async () => {
          const { clientDetails } = mockInvoiceData;
          Object.values(clientDetails).forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Document info', () => {
        it('should include document number and dates', async () => {
          expect(textContent).toContain(mockInvoiceData.invoiceNumber);
          expect(textContent).toContain(mockInvoiceData.date);
        });
      });

      describe('Items table', () => {
        it('should include table headers', async () => {
          expect(textContent).toContain('Description');
          expect(textContent).toContain('Quantity');
          expect(textContent).toContain('Total');
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
          expect(textContent).toContain('Total Amount');
          expect(textContent).toContain(mockInvoiceData.total.toString());
          expect(textContent).not.toContain('Subtotal');
          expect(textContent).not.toContain('Tax');
        });
      });

      describe('Signature section', () => {
        it('should include signature blocks', async () => {
          expect(textContent).toContain('Provider Signature');
          expect(textContent).toContain('Recipient Signature');
        });
      });
    });
  });
});
