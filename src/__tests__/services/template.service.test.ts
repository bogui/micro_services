import { TemplateService } from '../../services/template.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { JobData } from '../../types';

jest.mock('fs/promises');
jest.mock('path');

describe('Template Service', () => {
  let templateService: TemplateService;

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
      '/src/templates/base/layout.hbs': `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{{title}}</title>
            <style>{{{styles}}}</style>
            {{#if customStyles}}
            <style>{{{customStyles}}}</style>
            {{/if}}
        </head>
        <body class="font-sans text-gray-900 p-invoice-margin">
            <div class="document-header flex justify-between mb-10 pb-5 border-b-2 border-gray-200">
                {{> header}}
            </div>
            <div class="document-content">
                {{> content}}
            </div>
            <div class="document-footer mt-15">
                {{> footer}}
            </div>
        </body>
        </html>
      `,
      '/src/templates/base/header.hbs': `
        <div class="company-details">
            {{> components/company-info company=companyDetails}}
        </div>
        <div class="document-info">
            <h1 class="text-invoice-title text-primary mb-2">{{documentType}}</h1>
            <p class="text-invoice-subtitle text-gray-900 mb-1">#{{documentNumber}}</p>
            <p class="text-gray-600">
                Date: {{date}}<br>
                {{#if dueDate}}Due Date: {{dueDate}}{{/if}}
            </p>
        </div>
      `,
      '/src/templates/base/footer.hbs': `
        {{#if customFooter}}
          {{{customFooter}}}
        {{else}}
          <div class='footer-content text-center text-gray-500 text-sm mt-8'>
              {{#if footerText}}
                <p>{{footerText}}</p>
              {{/if}}
              <p class='copyright'>&copy; {{formatDate (now) 'year'}} {{companyDetails.name}}. All rights reserved.</p>
          </div>
        {{/if}}
      `,
      '/src/templates/components/company-info.hbs': `
        <h2 class='text-xl font-semibold mb-2'>{{company.name}}</h2>
        <p class='text-gray-600'>{{company.address}}</p>
        <p class='text-gray-600'>Email: {{company.email}}</p>
        <p class='text-gray-600'>Phone: {{company.phone}}</p>
      `,
      '/src/templates/components/client-info.hbs': `
        <div class='client-details'>
          <h3 class='text-lg text-primary mb-2 pb-1 border-b border-gray-200'>{{title}}</h3>
          <p class='font-semibold'>{{clientDetails.name}}</p>
          <p class='text-gray-600'>{{clientDetails.address}}</p>
          <p class='text-gray-600'>Email: {{clientDetails.email}}</p>
        </div>
      `,
      '/src/templates/invoice/index.hbs': `
        {{#> base/layout 
            title=(concat "Invoice " documentNumber)
            documentType="INVOICE"
            styles=styles
        }}
            {{#*inline "content"}}
                {{> components/client-info 
                    title="Bill To"
                    clientDetails=clientDetails
                }}

                <table class="w-full mb-8">
                    <thead>
                        <tr class="text-left">
                            <th class="w-[40%] py-3 bg-gray-50 text-primary font-semibold">Description</th>
                            <th class="w-[20%] py-3 bg-gray-50 text-primary font-semibold text-center">Quantity</th>
                            <th class="w-[20%] py-3 bg-gray-50 text-primary font-semibold text-right">Unit Price</th>
                            <th class="w-[20%] py-3 bg-gray-50 text-primary font-semibold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{#each items}}
                        <tr class="border-b border-gray-200">
                            <td class="py-3">{{description}}</td>
                            <td class="py-3 text-center">{{quantity}}</td>
                            <td class="py-3 text-right">\${{format unitPrice}}</td>
                            <td class="py-3 text-right">\${{format total}}</td>
                        </tr>
                        {{/each}}
                    </tbody>
                </table>

                <div class="totals float-right w-[300px]">
                    <div class="flex justify-between py-2 border-b border-gray-200">
                        <span>Subtotal</span>
                        <span>\${{format subtotal}}</span>
                    </div>
                    <div class="flex justify-between py-2 border-b border-gray-200">
                        <span>Tax</span>
                        <span>\${{format tax}}</span>
                    </div>
                    <div class="flex justify-between py-4 text-lg font-bold text-primary border-t-2 border-primary mt-2">
                        <span>Total</span>
                        <span>\${{format total}}</span>
                    </div>
                </div>

                <div class="footer clear-both text-center text-gray-500 text-sm mt-16">
                    <p>Thank you for your business!</p>
                </div>
            {{/inline}}
        {{/base/layout}}
      `,
      '/src/templates/protocol/index.hbs': `
        {{#> base/layout 
            title=(concat "Protocol " documentNumber)
            documentType="PROTOCOL"
            styles=styles
        }}
            {{#*inline "content"}}
                {{> components/client-info 
                    title="Recipient"
                    clientDetails=clientDetails
                }}

                <table class="w-full mb-8">
                    <thead>
                        <tr class="text-left">
                            <th class="w-[50%] py-3 bg-gray-50 text-primary font-semibold">Description</th>
                            <th class="w-[20%] py-3 bg-gray-50 text-primary font-semibold text-center">Quantity</th>
                            <th class="w-[30%] py-3 bg-gray-50 text-primary font-semibold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{#each items}}
                        <tr class="border-b border-gray-200">
                            <td class="py-3">{{description}}</td>
                            <td class="py-3 text-center">{{quantity}}</td>
                            <td class="py-3 text-right">\${{format total}}</td>
                        </tr>
                        {{/each}}
                    </tbody>
                </table>

                <div class="totals float-right w-[300px]">
                    <div class="flex justify-between py-4 text-lg font-bold text-primary border-t-2 border-primary final totals-row">
                        <span>Total Amount</span>
                        <span>\${{format total}}</span>
                    </div>
                </div>

                <div class="signatures clear-both flex justify-between mt-32 pt-5">
                    <div class="signature-block">
                        <div class="signature-line border-t border-gray-200 mt-16 pt-2 text-center text-gray-500">
                            Provider Signature
                        </div>
                    </div>
                    <div class="signature-block">
                        <div class="signature-line border-t border-gray-200 mt-16 pt-2 text-center text-gray-500">
                            Recipient Signature
                        </div>
                    </div>
                </div>
            {{/inline}}
        {{/base/layout}}
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

  describe('Template Helpers', () => {
    describe('format helper', () => {
      it('should format numbers with default currency', () => {
        const template = Handlebars.compile('{{format number}}');
        const result = template({ number: 42.5 });
        expect(result).toBe('$42.50');
      });

      it('should format numbers with custom currency', () => {
        const template = Handlebars.compile('{{format number "€"}}');
        const result = template({ number: 42.5 });
        expect(result).toBe('€42.50');
      });
    });

    describe('formatDate helper', () => {
      it('should format dates in short format', () => {
        const template = Handlebars.compile('{{formatDate date "short"}}');
        const result = template({ date: '2024-03-18' });
        expect(result).toBe(new Date('2024-03-18').toLocaleDateString());
      });

      it('should format dates in long format', () => {
        const template = Handlebars.compile('{{formatDate date "long"}}');
        const result = template({ date: '2024-03-18' });
        expect(result).toContain('2024');
        expect(result).toContain('March');
        expect(result).toContain('18');
      });

      it('should format dates in ISO format', () => {
        const template = Handlebars.compile('{{formatDate date "iso"}}');
        const result = template({ date: '2024-03-18' });
        expect(result).toBe('2024-03-18');
      });
    });

    describe('math helper', () => {
      it('should perform basic math operations', () => {
        const template = Handlebars.compile(`
                    {{math 'add' a b}}|{{math 'subtract' a b}}|{{math 'multiply' a b}}|{{math 'divide' a b}}
                `);
        const result = template({ a: 10, b: 2 }).trim().split('|');
        expect(result).toEqual(['12', '8', '20', '5']);
      });

      it('should handle invalid operations', () => {
        const template = Handlebars.compile('{{math "invalid" a b}}');
        const result = template({ a: 10, b: 2 });
        expect(result).toBe('10');
      });
    });

    describe('string helpers', () => {
      it('should concatenate strings', () => {
        const template = Handlebars.compile('{{concat a b c}}');
        const result = template({ a: 'Hello', b: ' ', c: 'World' });
        expect(result).toBe('Hello World');
      });

      it('should transform case', () => {
        const template = Handlebars.compile(
          '{{uppercase str}} {{lowercase str}}',
        );
        const result = template({ str: 'Hello World' });
        expect(result).toBe('HELLO WORLD hello world');
      });
    });

    describe('conditional helper', () => {
      it('should render content conditionally', () => {
        const template = Handlebars.compile('{{when condition value}}');
        expect(template({ condition: true, value: 'yes' })).toBe('yes');
        expect(template({ condition: false, value: 'yes' })).toBe('');
      });
    });

    describe('array helper', () => {
      it('should sum array values', () => {
        const template = Handlebars.compile('{{sum array}}');
        const result = template({ array: [1, 2, 3, 4, 5] });
        expect(result).toBe('15');
      });
    });
  });

  describe('Template Validation', () => {
    it('should validate correct template structure', async () => {
      const validTemplate = `
        {{#> base/layout
          title=(concat "Custom " documentNumber)
          documentType=documentType
          styles=styles
        }}
          {{#*inline "content"}}
            <div class="document">
              <h1>{{documentType}}</h1>
              <div>Document Number: {{documentNumber}}</div>
              <div class="client">{{client.name}}</div>
              <div class="items">
                {{#each items}}
                  <div>{{this.description}}</div>
                {{/each}}
              </div>
            </div>
          {{/inline}}
        {{/base/layout}}
      `;

      await expect(
        templateService.loadCustomTemplate('valid', validTemplate),
      ).resolves.not.toThrow();
    });

    it('should reject template with invalid handlebars syntax', async () => {
      const invalidTemplate = `
        {{#> base/layout
          title=(concat "Custom " documentNumber)
          documentType=documentType
          styles=styles
        }}
          {{#*inline "content"}}
            <div>{{documentType}}</div>
            <div>{{documentNumber}}</div>
            <div>{{client.name}}</div>
            {{#each items}}
              <div>{{this.description}}</div>
            {{/items}}
          {{/inline}}
        {{/base/layout}}
      `;

      await expect(
        templateService.loadCustomTemplate('invalid', invalidTemplate),
      ).rejects.toThrow(/Template compilation error/);
    });
  });

  describe('Custom Template Integration', () => {
    it('should load and render custom template', async () => {
      const customTemplate = `
        {{#> base/layout
          title=(concat "Custom " documentNumber)
          documentType=documentType
          styles=styles
        }}
          {{#*inline "content"}}
            <div class="document">
              <h1>{{documentType}}</h1>
              <div>Document Number: {{documentNumber}}</div>
              <div class="client">{{clientDetails.name}}</div>
              <div class="items">
                {{#each items}}
                  <div>{{this.description}}</div>
                {{/each}}
              </div>
            </div>
          {{/inline}}
        {{/base/layout}}
      `;

      const jobData: JobData = {
        jobId: 'test-job',
        invoiceId: 'INV-001',
        type: 'invoice',
        customTemplate: 'custom',
        data: {
          documentType: 'INVOICE',
          documentNumber: 'INV-001',
          invoiceNumber: 'INV-001',
          date: '2024-03-20',
          dueDate: '2024-04-19',
          companyDetails: {
            name: 'Test Company',
            address: '123 Test St',
            phone: '123-456-7890',
            email: 'test@company.com',
          },
          clientDetails: {
            name: 'Test Client',
            address: '456 Client St',
            email: 'client@test.com',
          },
          items: [
            {
              description: 'Test Item',
              quantity: 1,
              unitPrice: 100,
              total: 100,
            },
          ],
          subtotal: 100,
          tax: 20,
          total: 120,
        },
      };

      await templateService.loadCustomTemplate('custom', customTemplate);
      const result = await templateService.render(jobData);
      expect(result).toContain('Test Client');
      expect(result).toContain('Test Item');
    });

    it('should apply custom styles', async () => {
      const customTemplate = `
        {{#> base/layout
          title=(concat "Custom " documentNumber)
          documentType=documentType
          styles=styles
        }}
          {{#*inline "content"}}
            <div class="document">
              <h1>{{documentType}}</h1>
              <div>Document Number: {{documentNumber}}</div>
              <div class="client">{{clientDetails.name}}</div>
              <div class="items">
                {{#each items}}
                  <div>{{this.description}}</div>
                {{/each}}
              </div>
            </div>
          {{/inline}}
        {{/base/layout}}
      `;

      const customStyles = '.custom-class { color: red; }';
      const jobData: JobData = {
        jobId: 'test-job',
        invoiceId: 'INV-001',
        type: 'invoice',
        customTemplate: 'custom',
        data: {
          documentType: 'INVOICE',
          documentNumber: 'INV-001',
          invoiceNumber: 'INV-001',
          date: '2024-03-20',
          dueDate: '2024-04-19',
          companyDetails: {
            name: 'Test Company',
            address: '123 Test St',
            phone: '123-456-7890',
            email: 'test@company.com',
          },
          clientDetails: {
            name: 'Test Client',
            address: '456 Client St',
            email: 'client@test.com',
          },
          items: [
            {
              description: 'Test Item',
              quantity: 1,
              unitPrice: 100,
              total: 100,
            },
          ],
          subtotal: 100,
          tax: 20,
          total: 120,
        },
        customStyles,
      };

      await templateService.loadCustomTemplate('custom', customTemplate);
      const result = await templateService.render(jobData);
      expect(result).toContain(customStyles);
    });
  });
});
