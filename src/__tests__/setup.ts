import { JobData, InvoiceData } from '../types';

export const mockInvoiceData: InvoiceData = {
  documentType: 'Invoice',
  documentNumber: 'INV-2024-001',
  date: '2024-03-14',
  dueDate: '2024-04-13',
  recipient: {
    name: 'Test Client Ltd',
    vatNumber: 'BG123456789',
    identNumber: '123456789',
    city: 'Sofia',
    address: 'Test Address 123',
    representative: 'John Doe',
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
      description: 'Test Item 1',
      unit: 'pcs',
      quantity: 2,
      price: 100,
      total: 200,
    },
    {
      number: 2,
      description: 'Test Item 2',
      unit: 'pcs',
      quantity: 1,
      price: 50,
      total: 50,
    },
  ],
  totals: {
    taxBase: 250,
    vatAmount: 50,
    vatAmountReduced: 1,
    final: 300,
  },
  transaction: {
    taxEventDate: '2024-03-14',
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
  noVat: false,
};

export const mockJobData: JobData = {
  jobId: 'test-job-123',
  invoiceId: 'INV-2024-001',
  subType: 'original',
  isCreditOrDebit: false,
  type: 'invoice',
  data: {
    documentType: 'Invoice',
    documentNumber: 'INV-2024-001',
    date: '2024-03-14',
    dueDate: '2024-04-13',
    recipient: {
      name: 'Test Customer',
      vatNumber: 'BG123456789',
      identNumber: '123456789',
      city: 'Sofia',
      address: '123 Test St',
      representative: 'John Doe',
      email: 'test@example.com',
      phone: '0888123456',
    },
    supplier: {
      name: 'Test Company',
      vatNumber: 'BG987654321',
      identNumber: '987654321',
      city: 'Sofia',
      address: '123 Test St',
      representative: 'Jane Smith',
      email: 'test@example.com',
      phone: '0888654321',
    },
    items: [
      {
        number: 1,
        description: 'Test Item 1',
        unit: 'pcs',
        quantity: 2,
        price: 100,
        total: 200,
      },
    ],
    totals: {
      taxBase: 200,
      vatAmount: 38,
      vatAmountReduced: 0,
      final: 238,
    },
    transaction: {
      taxEventDate: '2024-03-14',
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
    noVat: false,
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
    '<html',
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
