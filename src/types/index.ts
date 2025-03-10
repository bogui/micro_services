export interface JobData {
  jobId: string;
  invoiceId: string;
  locale?: string;
  currency?: string;
  type: 'invoice' | 'credit' | 'debit' | 'protocol'; // Optional, defaults to "invoice" if not specified
  subType: 'copy' | 'original' | 'invoice';
  isCreditOrDebit: boolean;
  data: InvoiceData;
  customStyles?: string; // Optional custom CSS styles
  customTemplate?: string; // Optional custom template name
}

export interface InvoiceData {
  documentType?: string; // Optional since it can be derived from job type
  documentNumber: string;
  date: string;
  dueDate?: string | null;
  recipient: CompanyDetails;
  supplier: CompanyDetails;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  transaction: TransactionDetails;
  payment: PaymentDetails;
  relatedDocument?: RelatedDocument;
  vatResponse?: VatResponse | null;
  noVat: boolean;
  noVatCause?: string | null;
  inWords?: string;
  annuledAt?: string | null;
}

export interface VatResponse {
  address: string;
  countryCode: string;
  name: string;
  valid: boolean;
  vatNumber: string;
  requestDate: string;
  requestId?: string;
}

export interface RelatedDocument {
  documentNumber: string;
  date: string;
}

export interface CompanyDetails {
  name: string;
  address: string;
  city: string;
  email?: string;
  phone?: string;
  vatNumber?: string;
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
  basis?: string | null;
  description?: string | null;
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
