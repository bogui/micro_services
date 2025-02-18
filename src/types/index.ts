export interface JobData {
  jobId: string;
  invoiceId: string;
  type?: 'invoice' | 'protocol'; // Optional, defaults to "invoice" if not specified
  data: InvoiceData;
  customStyles?: string; // Optional custom CSS styles
  customTemplate?: string; // Optional custom template name
}

export interface InvoiceData {
  documentType?: string; // Optional since it can be derived from job type
  documentNumber?: string; // Optional since it can be derived from invoiceNumber
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
