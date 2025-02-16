import { JobData } from '../types';

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

  const invoiceData = jobData.data;

  // Validate required string fields
  const requiredStringFields = ['invoiceNumber', 'date', 'dueDate'] as const;

  for (const field of requiredStringFields) {
    if (!invoiceData[field] || typeof invoiceData[field] !== 'string') {
      throw new ValidationError(`Invalid or missing ${field}`);
    }
  }

  // Validate company details
  if (
    !invoiceData.companyDetails ||
    typeof invoiceData.companyDetails !== 'object'
  ) {
    throw new ValidationError('Invalid or missing company details');
  }

  const companyFields = ['name', 'address', 'email', 'phone'] as const;
  for (const field of companyFields) {
    if (
      !invoiceData.companyDetails[field] ||
      typeof invoiceData.companyDetails[field] !== 'string'
    ) {
      throw new ValidationError(`Invalid or missing company ${field}`);
    }
  }

  // Validate client details
  if (
    !invoiceData.clientDetails ||
    typeof invoiceData.clientDetails !== 'object'
  ) {
    throw new ValidationError('Invalid or missing client details');
  }

  const clientFields = ['name', 'address', 'email'] as const;
  for (const field of clientFields) {
    if (
      !invoiceData.clientDetails[field] ||
      typeof invoiceData.clientDetails[field] !== 'string'
    ) {
      throw new ValidationError(`Invalid or missing client ${field}`);
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

    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
      throw new ValidationError(`Invalid quantity for item at index ${index}`);
    }

    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
      throw new ValidationError(
        `Invalid unit price for item at index ${index}`,
      );
    }

    if (typeof item.total !== 'number' || item.total < 0) {
      throw new ValidationError(`Invalid total for item at index ${index}`);
    }

    // Verify total calculation
    const calculatedTotal = item.quantity * item.unitPrice;
    if (Math.abs(calculatedTotal - item.total) > 0.01) {
      // Allow for small floating-point differences
      throw new ValidationError(`Total mismatch for item at index ${index}`);
    }
  }

  // Validate totals
  const requiredNumberFields = ['subtotal', 'tax', 'total'] as const;
  for (const field of requiredNumberFields) {
    if (typeof invoiceData[field] !== 'number' || invoiceData[field] < 0) {
      throw new ValidationError(`Invalid ${field}`);
    }
  }

  // Verify total calculation
  const calculatedTotal = invoiceData.subtotal + invoiceData.tax;
  if (Math.abs(calculatedTotal - invoiceData.total) > 0.01) {
    throw new ValidationError('Invoice total mismatch');
  }
}
