import { TemplateService } from '../../services/template.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { JobData } from '../../types';

jest.mock('fs/promises');
jest.mock('path');

describe('Template Service', () => {
  let templateService: TemplateService;

  const sampleData: JobData = {
    jobId: 'test-123',
    invoiceId: 'INV-001',
    type: 'invoice' as const,
    locale: 'bg',
    currency: 'BGN',
    data: {
      documentType: 'Invoice',
      documentNumber: '0000000123',
      date: '2024-03-20',
      dueDate: '2024-04-19',
      recipient: {
        name: 'Test Client Ltd',
        vatNumber: 'BG123456789',
        identNumber: '123456789',
        city: 'Sofia',
        address: 'Test Address 123',
        representative: 'John Doe',
        email: 'test@client.com',
        phone: '0888123456',
      },
      supplier: {
        name: 'Test Company Ltd',
        vatNumber: 'BG987654321',
        identNumber: '987654321',
        city: 'Sofia',
        address: 'Company Address 456',
        representative: 'Jane Smith',
        email: 'test@company.com',
        phone: '0888654321',
      },
      items: [
        {
          number: 1,
          description: 'Test Item',
          unit: 'pcs',
          quantity: 1,
          price: 100,
          total: 100,
        },
      ],
      totals: {
        taxBase: 100,
        vatAmount: 20,
        vatAmountReduced: 0,
        final: 120,
      },
      transaction: {
        taxEventDate: '2024-03-20',
        basis: 'Test Basis',
        description: 'Test Description',
        location: 'Sofia',
      },
      payment: {
        method: 'Bank Transfer',
        banks: [
          {
            name: 'Test Bank',
            iban: 'BG12BANK12341234567890',
            bic: 'TESTBGSF',
          },
        ],
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock fs.access to simulate CSS file exists
    (fs.access as jest.Mock).mockResolvedValue(undefined);

    // Mock path.join to handle paths correctly
    (path.join as jest.Mock).mockImplementation((...paths: string[]) => {
      // Remove process.cwd() from the path if it exists
      const filteredPaths = paths.map(p => p.replace(process.cwd(), ''));
      return filteredPaths.join('/').replace(/\\/g, '/');
    });

    templateService = new TemplateService();

    // Mock file system operations
    const mockTemplates: Record<string, string> = {
      '/dist/templates/styles/main.css': `
        /* Mock Tailwind CSS utilities */
        .font-sans { font-family: sans-serif; }
      `,
      '/src/templates/partials/layout.hbs': `
        <!DOCTYPE html>
        <html lang="{{locale}}">
        <head>
            <meta charset="UTF-8">
            <title>{{t title}} - {{documentNumber}}</title>
            <style>{{{styles}}}</style>
            {{#if customStyles}}
            <style>{{{customStyles}}}</style>
            {{/if}}
        </head>
        <body class="font-sans text-gray-900 p-invoice-margin">
            {{> @partial-block }}
        </body>
        </html>
      `,
      '/src/templates/partials/header.hbs': `
        <div class="text-center mb-8">
          <h1 class="text-2xl mb-2">{{t (concat type '.title')}}</h1>
          <h3 class="text-lg">{{t (concat type '.original')}}</h3>
        </div>
        <div class="flex justify-between mb-6">
          <div class="self-end">
            <p>{{t (concat type '.number')}}: <span class="font-bold">{{documentNumber}}</span></p>
          </div>
          <table>
            <tr>
              <td>{{t (concat type '.date')}}:</td>
              <td>{{formatDate date}}</td>
            </tr>
            {{#if (eq type 'invoice')}}
              <tr>
                <td>{{t (concat type '.dueDate')}}:</td>
                <td>{{formatDate dueDate}}</td>
              </tr>
            {{/if}}
          </table>
        </div>
      `,
      '/src/templates/partials/company-details.hbs': `
        <div class="grid grid-cols-2 gap-4 mb-12">
          <div class="border border-gray-300 p-4">
            <table class="w-full">
              <tr>
                <th>{{t 'invoice.recipient.title'}}</th>
                <td>{{recipient.name}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.recipient.vat'}}</th>
                <td>{{recipient.vatNumber}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.recipient.id'}}</th>
                <td>{{recipient.identNumber}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.recipient.city'}}</th>
                <td>{{recipient.city}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.recipient.address'}}</th>
                <td>{{recipient.address}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.recipient.representative'}}</th>
                <td>{{recipient.representative}}</td>
              </tr>
            </table>
          </div>
          <div class="border border-gray-300 p-4">
            <table class="w-full">
              <tr>
                <th>{{t 'invoice.supplier.title'}}</th>
                <td>{{supplier.name}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.supplier.vat'}}</th>
                <td>{{supplier.vatNumber}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.supplier.id'}}</th>
                <td>{{supplier.identNumber}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.supplier.city'}}</th>
                <td>{{supplier.city}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.supplier.address'}}</th>
                <td>{{supplier.address}}</td>
              </tr>
              <tr>
                <th>{{t 'invoice.supplier.representative'}}</th>
                <td>{{supplier.representative}}</td>
              </tr>
            </table>
          </div>
        </div>
      `,
      '/src/templates/partials/items-table.hbs': `
        <div class="mb-8">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-gray-100">
                <th class="border p-2 text-left">{{t (concat type '.itemNumber')}}</th>
                <th class="border p-2 text-left">{{t (concat type '.description')}}</th>
                <th class="border p-2 text-left">{{t (concat type '.unit')}}</th>
                <th class="border p-2 text-right">{{t (concat type '.quantity')}}</th>
                <th class="border p-2 text-right">{{t (concat type '.price')}}</th>
                <th class="border p-2 text-right">{{t (concat type '.total')}}</th>
              </tr>
            </thead>
            <tbody>
              {{#each items}}
                <tr>
                  <td class="border p-2">{{number}}</td>
                  <td class="border p-2">{{description}}</td>
                  <td class="border p-2">{{unit}}</td>
                  <td class="border p-2 text-right">{{format quantity}}</td>
                  <td class="border p-2 text-right">{{format price ../currency}}</td>
                  <td class="border p-2 text-right">{{format total ../currency}}</td>
                </tr>
              {{/each}}
            </tbody>
            {{#if (eq type 'invoice')}}
              <tfoot>
                <tr>
                  <td colspan="5" class="border p-2 text-right font-bold">{{t 'invoice.totals.taxBase'}}:</td>
                  <td class="border p-2 text-right">{{format totals.taxBase currency}}</td>
                </tr>
                <tr>
                  <td colspan="5" class="border p-2 text-right font-bold">{{t 'invoice.totals.vatAmount'}}:</td>
                  <td class="border p-2 text-right">{{format totals.vatAmount currency}}</td>
                </tr>
                <tr>
                  <td colspan="5" class="border p-2 text-right font-bold">{{t 'invoice.totals.vatAmountReduced'}}:</td>
                  <td class="border p-2 text-right">{{format totals.vatAmountReduced currency}}</td>
                </tr>
                <tr>
                  <td colspan="5" class="border p-2 text-right font-bold">{{t 'invoice.totals.final'}}:</td>
                  <td class="border p-2 text-right font-bold">{{format totals.final currency}}</td>
                </tr>
              </tfoot>
            {{else}}
              <tfoot>
                <tr>
                  <td colspan="5" class="border p-2 text-right font-bold">{{t 'protocol.totals.final'}}:</td>
                  <td class="border p-2 text-right font-bold">{{format totals.final currency}}</td>
                </tr>
              </tfoot>
            {{/if}}
          </table>
        </div>
      `,
      '/src/templates/invoice/index.hbs': `
        {{#> layout title=(concat type '.title') documentNumber=documentNumber}}
          <div class="document invoice">
            {{> header 
                type='invoice' 
                documentType=documentType 
                documentNumber=documentNumber
                date=date
                dueDate=dueDate
            }}
            {{> company-details 
                type='invoice' 
                recipient=recipient 
                supplier=supplier
            }}
            {{> items-table 
                type='invoice'
                items=items
                totals=totals
                currency=currency
            }}
            {{> transaction-details 
                type='invoice'
                transaction=transaction
                payment=payment
            }}
            {{> signatures 
                type='invoice' 
                recipient=recipient 
                supplier=supplier
            }}
          </div>
        {{/layout}}
      `,
      '/src/templates/protocol/index.hbs': `
        {{#> layout title=(concat type '.title') documentNumber=documentNumber}}
          <div class="document protocol">
            {{> header 
                type='protocol' 
                documentNumber=documentNumber
                date=date
            }}
            {{> company-details 
                type='protocol' 
                recipient=recipient 
                supplier=supplier
            }}
            {{> items-table 
                type='protocol'
                items=items
                totals=totals
                currency=currency
            }}
            {{> signatures 
                type='protocol' 
                recipient=recipient 
                supplier=supplier
            }}
          </div>
        {{/layout}}
      `,
      '/src/templates/partials/transaction-details.hbs': `
        <div class="mb-8">
          <table class="w-full">
            <tr>
              <th class="text-left">{{t 'invoice.taxEventDate'}}:</th>
              <td>{{formatDate data.transaction.taxEventDate}}</td>
            </tr>
            <tr>
              <th class="text-left">{{t 'invoice.basis'}}:</th>
              <td>{{data.transaction.basis}}</td>
            </tr>
            <tr>
              <th class="text-left">{{t 'invoice.description'}}:</th>
              <td>{{data.transaction.description}}</td>
            </tr>
            <tr>
              <th class="text-left">{{t 'invoice.location'}}:</th>
              <td>{{data.transaction.location}}</td>
            </tr>
            <tr>
              <th class="text-left">{{t 'invoice.payment'}}:</th>
              <td>{{data.payment.method}}</td>
            </tr>
          </table>
        </div>
      `,
      '/src/templates/partials/signatures.hbs': `
        <div class="mt-12 grid grid-cols-2 gap-4">
          <div>
            <p class="font-bold mb-2">{{t (concat type '.recipient')}}:</p>
            <div class="h-16 border-b border-gray-300"></div>
          </div>
          <div>
            <p class="font-bold mb-2">{{t (concat type '.supplier')}}:</p>
            <div class="h-16 border-b border-gray-300"></div>
          </div>
        </div>
        <div class="mt-8 text-sm text-gray-600">
          <p>{{t 'invoice.disclaimer'}}</p>
        </div>
      `,
    };

    // Mock path.resolve to handle absolute paths
    (path.resolve as jest.Mock).mockImplementation((...paths: string[]) => {
      const joined = paths.join('/').replace(/\\/g, '/');
      return joined.startsWith('/') ? joined : `/${joined}`;
    });

    // Mock fs.readFile to return appropriate template content
    (fs.readFile as jest.Mock).mockImplementation(async (filePath: string) => {
      const normalizedPath = filePath
        .replace(/\\/g, '/')
        .replace(/^.*?(?=\/(?:src|dist)\/)/, '');
      const content = mockTemplates[normalizedPath];
      if (content === undefined) {
        throw new Error(`Mock template not found: ${normalizedPath}`);
      }
      return content;
    });

    // Initialize the service
    await templateService.initialize();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with all required templates', async () => {
      expect(templateService).toBeDefined();
      await expect(templateService.initialize()).resolves.not.toThrow();
    });

    it('should throw error if CSS file is missing', async () => {
      (fs.access as jest.Mock).mockRejectedValueOnce(
        new Error('File not found'),
      );
      const newService = new TemplateService();
      await expect(newService.initialize()).rejects.toThrow(
        'Compiled CSS file not found',
      );
    });

    it('should throw error if required template is missing', async () => {
      (fs.readFile as jest.Mock).mockRejectedValueOnce(
        new Error('Template not found'),
      );
      const newService = new TemplateService();
      await expect(newService.initialize()).rejects.toThrow();
    });
  });

  describe('Template Helpers', () => {
    describe('format helper', () => {
      it('should format numbers with default currency', () => {
        templateService.setCurrency('BGN');
        templateService.setLocale('bg');

        const template = Handlebars.compile('{{format number}}');
        const result = template({ number: 42.5 });
        expect(result).toBe('42.50 лв.');
      });

      it('should format numbers with custom currency', () => {
        templateService.setCurrency('EUR');
        templateService.setLocale('en');

        const template = Handlebars.compile('{{format number}}');
        const result = template({ number: 42.5 });
        expect(result).toBe('€42.50');
      });

      it('should throw error for invalid number', () => {
        const template = Handlebars.compile('{{format value}}');
        expect(() => template({ value: 'not a number' })).toThrow(
          'Value must be a number',
        );
      });
    });

    describe('formatDate helper', () => {
      it('should format dates in short format', () => {
        const template = Handlebars.compile('{{formatDate date "short"}}');
        const result = template({ date: '2024-03-18' });
        expect(result).toBe(new Date('2024-03-18').toLocaleDateString('bg'));
      });

      it('should format dates in long format', () => {
        const template = Handlebars.compile('{{formatDate date "long"}}');
        const result = template({ date: '2024-03-18' });
        expect(result).toContain('2024');
        expect(result).toContain('март');
        expect(result).toContain('18');
      });

      it('should format dates in ISO format', () => {
        const template = Handlebars.compile('{{formatDate date "iso"}}');
        const result = template({ date: '2024-03-18' });
        expect(result).toBe('2024-03-18');
      });
    });

    describe('translation helper', () => {
      it('should translate keys correctly', () => {
        templateService.setLocale('bg');
        const template = Handlebars.compile('{{t "invoice.title"}}');
        const result = template({});
        expect(result).toBe('Фактура');
      });

      it('should fallback to bg locale if translation not found', () => {
        templateService.setLocale('invalid');
        const template = Handlebars.compile('{{t "invoice.title"}}');
        const result = template({});
        expect(result).toBe('Фактура');
      });
    });

    describe('conditional helpers', () => {
      it('should handle when helper correctly', () => {
        const template = Handlebars.compile('{{when condition value}}');
        expect(template({ condition: true, value: 'yes' })).toBe('yes');
        expect(template({ condition: false, value: 'yes' })).toBe('');
      });

      it('should handle eq helper correctly', () => {
        const template = Handlebars.compile(
          '{{#if (eq a b)}}equal{{else}}not equal{{/if}}',
        );
        expect(template({ a: 1, b: 1 })).toBe('equal');
        expect(template({ a: 1, b: 2 })).toBe('not equal');
      });
    });
  });

  describe('Template Rendering', () => {
    it('should render invoice template successfully', async () => {
      const html = await templateService.render(sampleData);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(sampleData.data.documentNumber);
      expect(html).toContain(sampleData.data.recipient.name);
      expect(html).toContain(sampleData.data.supplier.name);
    });

    it('should render protocol template successfully', async () => {
      const protocolData: JobData = {
        ...sampleData,
        type: 'protocol' as const,
      };
      const html = await templateService.render(protocolData);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(protocolData.data.documentNumber);
      expect(html).toContain(protocolData.data.recipient.name);
      expect(html).toContain(protocolData.data.supplier.name);
    });

    it('should apply custom styles when provided', async () => {
      const customStyles = '.custom-class { color: red; }';
      const html = await templateService.render({
        ...sampleData,
        customStyles,
      });
      expect(html).toContain(customStyles);
    });

    it('should throw error for invalid template type', async () => {
      const invalidData = { ...sampleData, type: 'invalid' };
      await expect(
        templateService.render(invalidData as JobData),
      ).rejects.toThrow('Template not found');
    });
  });

  describe('Custom Template Loading', () => {
    const validTemplate = `
      {{#> layout title='Custom Template'}}
        {{> header type='invoice'}}
        <div class="custom-content">
          <h1>{{documentType}}</h1>
          <div>Document Number: {{documentNumber}}</div>
          <div class="client">{{client.name}}</div>
        </div>
      {{/layout}}
    `;

    it('should load valid custom template', async () => {
      await expect(
        templateService.loadCustomTemplate('custom', validTemplate),
      ).resolves.not.toThrow();
    });

    it('should reject invalid template syntax', async () => {
      const invalidTemplate = `
        {{#> layout}}
          {{#each items}}
            <div>{{this.description}}</div>
          {{/invalid}}
        {{/layout}}
      `;
      await expect(
        templateService.loadCustomTemplate('invalid', invalidTemplate),
      ).rejects.toThrow();
    });

    it('should render custom template successfully', async () => {
      await templateService.loadCustomTemplate('custom', validTemplate);
      const html = await templateService.render({
        ...sampleData,
        customTemplate: 'custom',
      });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Custom Template');
    });
  });
});
