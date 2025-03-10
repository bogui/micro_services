import { JobData, InvoiceData } from '../types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates job data for PDF generation
 * @param data - The job data to validate
 * @throws ValidationError if data is invalid
 */
export function validateJobData(data: unknown): asserts data is JobData {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid job data format');
  }

  const jobData = data as Partial<JobData>;

  if (!jobData.jobId || typeof jobData.jobId !== 'string') {
    throw new ValidationError('Invalid or missing jobId');
  }

  if (!jobData.invoiceId || typeof jobData.invoiceId !== 'string') {
    throw new ValidationError('Invalid or missing invoiceId');
  }

  if (!jobData.data || typeof jobData.data !== 'object') {
    throw new ValidationError('Invalid or missing invoice data');
  }

  const invoiceData = jobData.data as Partial<InvoiceData>;

  // Validate required string fields
  if (
    !invoiceData.documentNumber ||
    typeof invoiceData.documentNumber !== 'string'
  ) {
    throw new ValidationError('Invalid or missing documentNumber');
  }

  if (!invoiceData.date || typeof invoiceData.date !== 'string') {
    throw new ValidationError('Invalid or missing date');
  }

  if (jobData.type === 'invoice' && invoiceData.dueDate) {
    if (typeof invoiceData.dueDate !== 'string') {
      throw new ValidationError('Invalid or missing dueDate');
    }
  }

  // Validate recipient details
  if (!invoiceData.recipient || typeof invoiceData.recipient !== 'object') {
    throw new ValidationError('Invalid or missing recipient details');
  }

  // Required fields
  const requiredFields = ['name', 'address', 'identNumber'] as const;
  for (const field of requiredFields) {
    if (
      !invoiceData.recipient[field] ||
      typeof invoiceData.recipient[field] !== 'string'
    ) {
      throw new ValidationError(`Invalid or missing recipient ${field}`);
    }
  }

  // Optional fields with pattern validation
  if (invoiceData.recipient.email !== undefined) {
    if (
      typeof invoiceData.recipient.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceData.recipient.email)
    ) {
      throw new ValidationError('Invalid recipient email format');
    }
  }

  if (invoiceData.recipient.phone !== undefined) {
    if (
      typeof invoiceData.recipient.phone !== 'string' ||
      !/^\+?[\d\s-()]+$/.test(invoiceData.recipient.phone)
    ) {
      throw new ValidationError('Invalid recipient phone format');
    }
  }

  // Validate supplier details
  if (!invoiceData.supplier || typeof invoiceData.supplier !== 'object') {
    throw new ValidationError('Invalid or missing supplier details');
  }

  // Required fields
  const supplierRequiredFields = ['name', 'address', 'identNumber'] as const;
  for (const field of supplierRequiredFields) {
    if (
      !invoiceData.supplier[field] ||
      typeof invoiceData.supplier[field] !== 'string'
    ) {
      throw new ValidationError(`Invalid or missing supplier ${field}`);
    }
  }

  // Optional fields with pattern validation
  if (invoiceData.supplier.email !== undefined) {
    if (
      typeof invoiceData.supplier.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceData.supplier.email)
    ) {
      throw new ValidationError('Invalid supplier email format');
    }
  }

  if (invoiceData.supplier.phone !== undefined) {
    if (
      typeof invoiceData.supplier.phone !== 'string' ||
      !/^\+?[\d\s-()]+$/.test(invoiceData.supplier.phone)
    ) {
      throw new ValidationError('Invalid supplier phone format');
    }
  }

  // Validate items array
  if (!Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
    throw new ValidationError('Invalid or empty items array');
  }

  for (const [index, item] of invoiceData.items.entries()) {
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`Invalid item at index ${index}`);
    }

    if (!item.description || typeof item.description !== 'string') {
      throw new ValidationError(
        `Invalid or missing description for item at index ${index}`,
      );
    }

    // Verify total calculation
    const calculatedTotal = item.quantity * item.price;
    if (Math.abs(calculatedTotal - item.total) > 0.01) {
      // Allow for small floating-point differences
      throw new ValidationError(`Total mismatch for item at index ${index}`);
    }
  }

  // Validate totals
  if (!invoiceData.totals || typeof invoiceData.totals !== 'object') {
    throw new ValidationError('Invalid or missing totals');
  }

  const totalsFields = ['taxBase', 'final'] as const;
  for (const field of totalsFields) {
    if (
      !jobData.isCreditOrDebit &&
      (typeof invoiceData.totals[field] !== 'number' ||
        invoiceData.totals[field] < 0)
    ) {
      throw new ValidationError(`Invalid ${field}`);
    }
  }

  // Verify total calculation
  const calculatedTotal =
    invoiceData.totals.taxBase +
    invoiceData.totals.vatAmount +
    (invoiceData.totals.vatAmountReduced || 0);
  if (Math.abs(calculatedTotal - invoiceData.totals.final) > 0.01) {
    throw new ValidationError('Invoice total mismatch');
  }
}
