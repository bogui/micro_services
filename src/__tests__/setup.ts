import { JobData, InvoiceData } from '../types';

export const mockInvoiceData: InvoiceData = {
  invoiceNumber: 'INV-2024-001',
  date: '2024-03-14',
  dueDate: '2024-04-13',
  companyDetails: {
    name: 'Test Company Ltd',
    address: '123 Test Street, Test City, 12345',
    email: 'contact@testcompany.com',
    phone: '+1 234-567-8900',
  },
  clientDetails: {
    name: 'Test Client',
    address: '456 Client Ave, Client City, 54321',
    email: 'client@example.com',
  },
  items: [
    {
      description: 'Test Item 1',
      quantity: 2,
      unitPrice: 100,
      total: 200,
    },
    {
      description: 'Test Item 2',
      quantity: 1,
      unitPrice: 50,
      total: 50,
    },
  ],
  subtotal: 250,
  tax: 25,
  total: 275,
};

export const mockJobData: JobData = {
  jobId: 'test-job-123',
  invoiceId: 'INV-2024-001',
  type: 'invoice',
  data: {
    invoiceNumber: 'INV-2024-001',
    date: '2024-03-14',
    dueDate: '2024-04-13',
    companyDetails: {
      name: 'Test Company',
      address: '123 Test St',
      email: 'test@example.com',
      phone: '+1 234-567-8900',
    },
    clientDetails: {
      name: 'Test Customer',
      address: '123 Test St',
      email: 'test@example.com',
    },
    items: [
      {
        description: 'Test Item 1',
        quantity: 2,
        unitPrice: 100,
        total: 200,
      },
    ],
    subtotal: 200,
    tax: 38,
    total: 238,
  },
};

export function createMockInvoiceData(
  overrides: Partial<InvoiceData> = {},
): InvoiceData {
  return {
    ...mockJobData.data,
    ...overrides,
  };
}

export function createMockJobData(overrides: Partial<JobData> = {}): JobData {
  return {
    ...mockJobData,
    ...overrides,
  };
}

export function createInvalidJobData(): Partial<JobData> {
  return {
    jobId: '',
    invoiceId: '',
    data: {} as InvoiceData,
  };
}

export function verifyHtmlStructure(html: string) {
  const requiredElements = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta',
    '<title>',
    '<style>',
    '<body',
  ];

  requiredElements.forEach(element => {
    if (!html.includes(element)) {
      throw new Error(`Missing required HTML element: ${element}`);
    }
  });
}

export function extractTextContent(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
