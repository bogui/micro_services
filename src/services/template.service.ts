import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { JobData } from '../types';
import translate from '../helpers/translate.helper';
type HandlebarsTemplate = Handlebars.TemplateDelegate<any>;

interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
}

const locales = ['bg', 'en'];

const currencies = [
  {
    code: 'BGN',
    symbol: 'лв.',
    position: 'after',
  },
  {
    code: 'EUR',
    symbol: '€',
    position: 'before',
  },
  {
    code: 'USD',
    symbol: '$',
    position: 'before',
  },
];

export class TemplateService {
  private readonly templates: Map<string, HandlebarsTemplate> = new Map();
  private readonly partials: Map<string, HandlebarsTemplate> = new Map();
  private styles: string = '';
  private locale: string = 'bg';
  private currency: string = 'BGN';

  constructor() {
    this.registerHelpers();
  }

  public setLocale(locale: string) {
    if (!locales.includes(locale)) {
      this.locale = 'bg';
      return;
    }

    this.locale = locale;
  }

  public setCurrency(currency: string) {
    if (!currencies.some(c => c.code === currency)) {
      this.currency = 'BGN';
      return;
    }

    this.currency = currency;
  }

  private registerHelpers() {
    // Layout helpers
    Handlebars.registerHelper(
      'extend',
      function (
        this: Record<string, unknown>,
        name: string,
        options: Handlebars.HelperOptions,
      ) {
        const template = Handlebars.partials[name];
        if (!template) {
          throw new Error(`Layout ${name} not found`);
        }

        // Create a new context with all properties from the current context
        const context: Record<string, unknown> = {
          ...this,
          _blocks: {} as Record<string, string>,
        };

        // Execute the template function to get the content blocks
        if (options?.fn) {
          options.fn(context);
        }

        // If no body content block is set, use the entire content
        if (!(context._blocks as Record<string, string>).body && options?.fn) {
          context.content = options.fn(this);
        }

        // Compile the template if it's not already compiled
        const compiledTemplate =
          typeof template === 'function'
            ? template
            : Handlebars.compile(template);
        return compiledTemplate(context);
      },
    );

    Handlebars.registerHelper(
      'content',
      function (
        this: Record<string, unknown>,
        name: string,
        options?: Handlebars.HelperOptions,
      ) {
        if (!options?.fn) return '';

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;
        context._blocks = context._blocks || ({} as Record<string, string>);

        // Store the content in the blocks object
        const content = options.fn(this);
        (context._blocks as Record<string, string>)[name] = content;

        // If this is the body content, also set it as the main content
        if (name === 'body') {
          context.content = content;
        }

        // Return empty string as the content will be rendered by the layout
        return '';
      },
    );

    // Format numbers with currency
    Handlebars.registerHelper(
      'format',
      (value: number, currencyCode?: string | Handlebars.HelperOptions) => {
        // If currencyCode is options object, use default currency
        const code =
          typeof currencyCode === 'string' ? currencyCode : this.currency;
        const currency = currencies.find(c => c.code === code);

        if (!currency) {
          throw new Error(`Currency not found: ${code}`);
        }

        if (value === undefined || value === null) {
          return '0.00';
        }

        const numValue = typeof value === 'number' ? value : Number(value);
        if (isNaN(numValue)) {
          throw new Error(
            'Value must be a number or a string that can be converted to a number',
          );
        }

        return currency.position === 'before'
          ? `${currency.symbol}${numValue.toFixed(2)}`
          : `${numValue.toFixed(2)} ${currency.symbol}`;
      },
    );

    // Alias format as formatCurrency for clarity
    Handlebars.registerHelper(
      'formatCurrency',
      function (value: number, currencyCode: string) {
        return Handlebars.helpers['format'](value, currencyCode);
      },
    );

    // Format numbers without currency
    Handlebars.registerHelper('formatNumber', (value: number) => {
      if (value === undefined || value === null) {
        return '0.00';
      }

      const numValue = typeof value === 'number' ? value : Number(value);
      if (isNaN(numValue)) {
        throw new Error(
          'Value must be a number or a string that can be converted to a number',
        );
      }
      return numValue.toFixed(2);
    });

    // String concatenation
    Handlebars.registerHelper('concat', (...args: unknown[]) => {
      args.pop(); // Remove the last argument (Handlebars options)
      return args.join('');
    });

    // Date formatting
    Handlebars.registerHelper('formatDate', (date: string, format = 'long') => {
      const dateObj = new Date(date);
      switch (format) {
        case 'short':
          return dateObj.toLocaleDateString(this.locale);
        case 'long':
          return dateObj.toLocaleDateString(this.locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        case 'iso':
          return dateObj.toISOString().split('T')[0];
        default:
          return date;
      }
    });

    // Conditional helper
    Handlebars.registerHelper('when', function (condition: any, value: any) {
      return condition ? value : '';
    });

    // Translation helper
    Handlebars.registerHelper('t', (text: string) => {
      return translate(text, this.locale);
    });

    // Math operations
    Handlebars.registerHelper(
      'math',
      (operation: string, a: number, b: number) => {
        switch (operation) {
          case 'add':
            return a + b;
          case 'subtract':
            return a - b;
          case 'multiply':
            return a * b;
          case 'divide':
            return a / b;
          default:
            return a;
        }
      },
    );

    // Array operations
    Handlebars.registerHelper('sum', (array: number[]) => {
      return array.reduce((a, b) => a + b, 0);
    });

    // String operations
    Handlebars.registerHelper('uppercase', (str: string) => str.toUpperCase());
    Handlebars.registerHelper('lowercase', (str: string) => str.toLowerCase());

    // Comparison helper
    Handlebars.registerHelper('eq', function (a: any, b: any) {
      return a === b;
    });

    Handlebars.registerHelper('ne', function (a: any, b: any) {
      return a !== b;
    });
  }

  async initialize() {
    try {
      // Check if compiled CSS exists
      const stylesPath = path.join(
        process.cwd(),
        'dist/templates/styles/main.css',
      );
      try {
        await fs.access(stylesPath);
      } catch (error) {
        throw new Error(
          'Compiled CSS file not found. Please run "npm run build:css" first.',
        );
      }

      // Load and compile base templates
      await this.loadPartials();
      await this.loadTemplates();
      await this.loadStyles();

      console.log('Template service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize template service:', error);
      throw error;
    }
  }

  private async loadPartials() {
    const baseDir = path.join(process.cwd(), 'src/templates');

    // Load layout partial
    const layoutTemplate = await fs.readFile(
      path.join(baseDir, 'partials/layout.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('layout', layoutTemplate);

    // Load invoice partials
    const headerTemplate = await fs.readFile(
      path.join(baseDir, 'partials/header.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('header', headerTemplate);

    const companyDetailsTemplate = await fs.readFile(
      path.join(baseDir, 'partials/company-details.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('company-details', companyDetailsTemplate);

    const itemsTableTemplate = await fs.readFile(
      path.join(baseDir, 'partials/items-table.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('items-table', itemsTableTemplate);

    const transactionDetailsTemplate = await fs.readFile(
      path.join(baseDir, 'partials/transaction-details.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial(
      'transaction-details',
      transactionDetailsTemplate,
    );

    const signaturesTemplate = await fs.readFile(
      path.join(baseDir, 'partials/signatures.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('signatures', signaturesTemplate);
  }

  private async loadTemplates() {
    const baseDir = path.join(process.cwd(), 'src/templates');

    // Load document templates
    const invoiceTemplate = await fs.readFile(
      path.join(baseDir, 'invoice/index.hbs'),
      'utf-8',
    );
    this.templates.set('invoice', Handlebars.compile(invoiceTemplate));

    const protocolTemplate = await fs.readFile(
      path.join(baseDir, 'protocol/index.hbs'),
      'utf-8',
    );
    this.templates.set('protocol', Handlebars.compile(protocolTemplate));
  }

  private async loadStyles() {
    const stylesPath = path.join(
      process.cwd(),
      'dist/templates/styles/main.css',
    );
    this.styles = await fs.readFile(stylesPath, 'utf-8');
  }

  async render(jobData: JobData): Promise<string> {
    const templateName = jobData.customTemplate ?? jobData.type ?? 'invoice';
    const template = this.templates.get(templateName);
    this.locale = jobData.locale ?? 'bg';
    this.currency = jobData.currency ?? 'BGN';

    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    try {
      // Combine base styles with custom styles
      const combinedStyles = jobData.customStyles
        ? `${this.styles}\n${jobData.customStyles}`
        : this.styles;

      const context = {
        ...jobData.data,
        type: templateName,
        styles: combinedStyles,
        locale: this.locale,
        currency: this.currency,
      };

      return template(context);
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      throw error;
    }
  }

  private validateTemplate(content: string): TemplateValidationResult {
    const errors: string[] = [];

    // Validate handlebars syntax first by attempting to compile
    try {
      // First, check for basic syntax errors
      const ast = Handlebars.parse(content);

      // Check for unclosed blocks
      const blockStack: string[] = [];
      const validateNode = (node: any) => {
        if (node.type === 'BlockStatement') {
          blockStack.push(node.path.original);
        } else if (node.type === 'Program' && node.blockParams) {
          blockStack.pop();
        }

        if (node.program) {
          validateNode(node.program);
        }
        if (node.inverse) {
          validateNode(node.inverse);
        }
      };

      validateNode(ast);

      if (blockStack.length > 0) {
        throw new Error(`Unclosed block(s): ${blockStack.join(', ')}`);
      }

      // Try compiling to catch any other errors
      Handlebars.compile(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Template compilation error: ${message}`);
      return { isValid: false, errors };
    }

    // Only proceed with other validations if compilation succeeds
    // Check for required base layout
    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    if (
      !normalizedContent.includes('{{#> layout') &&
      !normalizedContent.includes('{{#extend "layout"')
    ) {
      errors.push('Template must extend layout');
    }

    // Check for basic structure
    const requiredElements = ['documentType', 'documentNumber'];

    // Check for client information (either recipient or client)
    if (!content.includes('recipient.') && !content.includes('client.')) {
      errors.push('Template must include recipient information');
    }

    requiredElements.forEach(element => {
      if (!content.includes(element)) {
        errors.push(`Template must include ${element}`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  async loadCustomTemplate(name: string, templateContent: string) {
    try {
      // Validate template
      const validation = this.validateTemplate(templateContent);
      if (!validation.isValid) {
        throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
      }

      // Register the template with Handlebars
      const template = Handlebars.compile(templateContent);
      this.templates.set(name, template);

      // Register the template as a partial as well, so it can be used by other templates
      Handlebars.registerPartial(name, templateContent);

      console.log(`Custom template '${name}' loaded successfully`);
    } catch (error) {
      console.error(`Error loading custom template '${name}':`, error);
      throw error;
    }
  }
}

// Create and initialize singleton instance
export const templateService = new TemplateService();
