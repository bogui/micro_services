export interface JobData {
  jobId: string;
  invoiceId: string;
  type?: 'invoice' | 'protocol'; // Optional, defaults to "invoice" if not specified
  data: InvoiceData;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  companyDetails: CompanyDetails;
  clientDetails: ClientDetails;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface CompanyDetails {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface ClientDetails {
  name: string;
  address: string;
  email: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
