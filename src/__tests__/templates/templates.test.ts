import { generateInvoiceHTML } from '../../templates/invoice.template';
import { generateProtocolHTML } from '../../templates/protocol.template';
import { mockJobData, verifyHtmlStructure, extractTextContent } from '../setup';

describe('Template Generation', () => {
  describe('Invoice Template', () => {
    let html: string;
    let textContent: string;

    beforeEach(() => {
      html = generateInvoiceHTML(mockJobData.data);
      textContent = extractTextContent(html);
    });

    describe('Structure validation', () => {
      it('should have valid HTML structure', () => {
        expect(() => verifyHtmlStructure(html)).not.toThrow();
      });

      it('should include required CSS styles', () => {
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
        it('should include all company information', () => {
          const { companyDetails } = mockJobData.data;
          Object.values(companyDetails).forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Client details', () => {
        it('should include all client information', () => {
          const { clientDetails } = mockJobData.data;
          Object.values(clientDetails).forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Invoice details', () => {
        it('should include invoice metadata', () => {
          const { invoiceNumber, date, dueDate } = mockJobData.data;
          [invoiceNumber, date, dueDate].forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Items table', () => {
        it('should include table headers', () => {
          const headers = ['Description', 'Quantity', 'Unit Price', 'Total'];
          headers.forEach(header => {
            expect(textContent).toContain(header);
          });
        });

        it('should include all item details', () => {
          mockJobData.data.items.forEach(item => {
            expect(textContent).toContain(item.description);
            expect(textContent).toContain(item.quantity.toString());
            expect(html).toContain(item.unitPrice.toFixed(2));
            expect(html).toContain(item.total.toFixed(2));
          });
        });
      });

      describe('Totals section', () => {
        it('should include all total values', () => {
          const { subtotal, tax, total } = mockJobData.data;
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

    beforeEach(() => {
      html = generateProtocolHTML(mockJobData.data);
      textContent = extractTextContent(html);
    });

    describe('Structure validation', () => {
      it('should have valid HTML structure', () => {
        expect(() => verifyHtmlStructure(html)).not.toThrow();
      });

      it('should include signature blocks', () => {
        ['Provider Signature', 'Recipient Signature'].forEach(text => {
          expect(textContent).toContain(text);
        });
      });
    });

    describe('Content validation', () => {
      describe('Company and client details', () => {
        it('should include all company and client information', () => {
          const { companyDetails, clientDetails } = mockJobData.data;
          [
            ...Object.values(companyDetails),
            ...Object.values(clientDetails),
          ].forEach(value => {
            expect(textContent).toContain(value);
          });
        });
      });

      describe('Protocol details', () => {
        it('should include protocol number and date', () => {
          const { invoiceNumber, date } = mockJobData.data;
          [invoiceNumber, date].forEach(value => {
            expect(textContent).toContain(value);
          });
        });

        it('should not include invoice-specific fields', () => {
          const excludedFields = [
            mockJobData.data.dueDate,
            'Unit Price',
            'Subtotal',
            'Tax',
          ];

          excludedFields.forEach(field => {
            expect(textContent).not.toContain(field);
          });
        });
      });

      describe('Items table', () => {
        it('should include simplified item details', () => {
          mockJobData.data.items.forEach(item => {
            expect(textContent).toContain(item.description);
            expect(textContent).toContain(item.quantity.toString());
            expect(html).toContain(item.total.toFixed(2));
            expect(html).not.toContain(item.unitPrice.toFixed(2));
          });
        });
      });

      describe('Total section', () => {
        it('should only include final total', () => {
          expect(html).toContain(mockJobData.data.total.toFixed(2));
          expect(textContent).not.toContain('Subtotal');
          expect(textContent).not.toContain('Tax');
        });
      });
    });
  });
});
