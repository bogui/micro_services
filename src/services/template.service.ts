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
      throw new Error(`Invalid locale: ${locale}`);
    }

    this.locale = locale;
  }

  public setCurrency(currency: string) {
    if (!currencies.some(c => c.code === currency)) {
      throw new Error(`Invalid currency: ${currency}`);
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

    // Format numbers to 2 decimal places with currency symbol
    Handlebars.registerHelper(
      'format',
      (
        value: number,
        _currencyOrOptions: string | Handlebars.HelperOptions = '$',
      ) => {
        const currency = currencies.find(c => c.code === this.currency);

        if (!currency) {
          throw new Error(`Currency not found: ${this.currency}`);
        }

        return currency.position === 'before'
          ? `${currency.symbol}${value.toFixed(2)}`
          : `${value.toFixed(2)} ${currency.symbol}`;
      },
    );

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
    Handlebars.registerHelper('t', (key: string) => {
      return translate(key, this.locale);
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

    // Format numbers as currency
    // Handlebars.registerHelper('format', (value: number) => {
    //   return value.toFixed(2);
    // });
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

    // Load base partials
    const headerTemplate = await fs.readFile(
      path.join(baseDir, 'base/header.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('header', headerTemplate);

    const footerTemplate = await fs.readFile(
      path.join(baseDir, 'base/footer.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('footer', footerTemplate);

    // Load component partials
    const companyInfoTemplate = await fs.readFile(
      path.join(baseDir, 'components/company-info.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('components/company-info', companyInfoTemplate);

    const clientInfoTemplate = await fs.readFile(
      path.join(baseDir, 'components/client-info.hbs'),
      'utf-8',
    );
    Handlebars.registerPartial('components/client-info', clientInfoTemplate);
  }

  private async loadTemplates() {
    const baseDir = path.join(process.cwd(), 'src/templates');

    // Load base layout
    const layoutTemplate = await fs.readFile(
      path.join(baseDir, 'base/layout.hbs'),
      'utf-8',
    );
    this.templates.set('base/layout', Handlebars.compile(layoutTemplate));
    Handlebars.registerPartial('base/layout', layoutTemplate);

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

      const data = {
        ...jobData.data,
        documentNumber:
          jobData.data.documentNumber ?? jobData.data.invoiceNumber,
        styles: combinedStyles,
        clientDetails: jobData.data.clientDetails,
        companyDetails: jobData.data.companyDetails,
        items: jobData.data.items,
      };

      return template(data);
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
      !normalizedContent.includes('{{#> base/layout') &&
      !normalizedContent.includes('{{#extend "base/layout"')
    ) {
      errors.push('Template must extend base/layout');
    }

    // Check for required content block
    if (
      !content.includes('{{#*inline "content"}}') &&
      !content.includes('{{#content "body"}}')
    ) {
      errors.push('Template must define a content block');
    }

    // Check for basic structure
    const requiredElements = ['documentType', 'documentNumber'];

    // Check for client information (either client or clientDetails)
    if (!content.includes('client.') && !content.includes('clientDetails.')) {
      errors.push('Template must include client information');
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
