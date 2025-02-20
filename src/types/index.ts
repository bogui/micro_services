export interface JobData {
  jobId: string;
  invoiceId: string;
  locale?: string;
  currency?: string;
  type?: 'invoice' | 'protocol'; // Optional, defaults to "invoice" if not specified
  data: InvoiceData;
  customStyles?: string; // Optional custom CSS styles
  customTemplate?: string; // Optional custom template name
}

export interface InvoiceData {
  documentType?: string; // Optional since it can be derived from job type
  documentNumber: string;
  date: string;
  dueDate: string;
  recipient: CompanyDetails;
  supplier: CompanyDetails;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  transaction: TransactionDetails;
  payment: PaymentDetails;
}

export interface CompanyDetails {
  name: string;
  address: string;
  city: string;
  email: string;
  phone: string;
  vatNumber: string;
  identNumber: string;
  representative: string;
}

export interface InvoiceItem {
  number: number;
  description: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
}

export interface InvoiceTotals {
  taxBase: number;
  vatAmount: number;
  vatAmountReduced: number;
  final: number;
}

export interface TransactionDetails {
  taxEventDate: string;
  basis: string;
  description: string;
  location: string;
}

export interface PaymentDetails {
  method: string;
  banks: BankDetails[];
}

export interface BankDetails {
  name: string;
  iban: string;
  bic: string;
}
