/// <reference types="jest" />

import { validateJobData, ValidationError } from '../../utils/validation.utils';
import {
  mockJobData,
  createMockJobData,
  createInvalidJobData,
  createMockInvoiceData,
} from '../setup';

describe('Validation Utils', () => {
  describe('validateJobData', () => {
    describe('Basic validation', () => {
      it('should validate correct job data without throwing', () => {
        expect(() => validateJobData(mockJobData)).not.toThrow();
      });

      it('should throw for null or undefined data', () => {
        [null, undefined].forEach(invalidValue => {
          expect(() => validateJobData(invalidValue)).toThrow(ValidationError);
        });
      });

      it('should throw for missing required fields', () => {
        const invalidData = createInvalidJobData();
        expect(() => validateJobData(invalidData)).toThrow(ValidationError);
      });
    });

    describe('Job metadata validation', () => {
      it('should throw for invalid jobId', () => {
        const testCases = [
          { jobId: '' },
          { jobId: null },
          { jobId: undefined },
        ];

        testCases.forEach(testCase => {
          const invalidData = createMockJobData({
            jobId: testCase.jobId as any,
          });
          expect(() => validateJobData(invalidData)).toThrow(
            'Invalid or missing jobId',
          );
        });
      });

      it('should throw for invalid invoiceId', () => {
        const testCases = [
          { invoiceId: '' },
          { invoiceId: null },
          { invoiceId: undefined },
        ];

        testCases.forEach(testCase => {
          const invalidData = createMockJobData({
            invoiceId: testCase.invoiceId as any,
          });
          expect(() => validateJobData(invalidData)).toThrow(
            'Invalid or missing invoiceId',
          );
        });
      });
    });

    describe('Company details validation', () => {
      it('should throw for missing company fields', () => {
        const requiredFields = ['name', 'address', 'email', 'phone'];

        requiredFields.forEach(field => {
          const companyDetails = { ...mockJobData.data.companyDetails };
          delete (companyDetails as any)[field];

          const invalidData = createMockJobData({
            data: createMockInvoiceData({
              companyDetails,
            }),
          });

          expect(() => validateJobData(invalidData)).toThrow(
            /Invalid or missing company/,
          );
        });
      });
    });

    describe('Client details validation', () => {
      it('should throw for missing client fields', () => {
        const requiredFields = ['name', 'address', 'email'];

        requiredFields.forEach(field => {
          const clientDetails = { ...mockJobData.data.clientDetails };
          delete (clientDetails as any)[field];

          const invalidData = createMockJobData({
            data: createMockInvoiceData({
              clientDetails,
            }),
          });

          expect(() => validateJobData(invalidData)).toThrow(
            /Invalid or missing client/,
          );
        });
      });
    });

    describe('Items validation', () => {
      it('should throw for empty items array', () => {
        const invalidData = createMockJobData({
          data: createMockInvoiceData({
            items: [],
          }),
        });
        expect(() => validateJobData(invalidData)).toThrow(
          'Invalid or empty items array',
        );
      });

      it('should validate item calculations', () => {
        const testCases = [
          {
            description: 'invalid quantity',
            item: {
              description: 'Test',
              quantity: -1,
              unitPrice: 100,
              total: 100,
            },
          },
          {
            description: 'invalid unit price',
            item: {
              description: 'Test',
              quantity: 1,
              unitPrice: -50,
              total: 50,
            },
          },
          {
            description: 'mismatched total',
            item: {
              description: 'Test',
              quantity: 2,
              unitPrice: 100,
              total: 150,
            },
          },
        ];

        testCases.forEach(({ item }) => {
          const invalidData = createMockJobData({
            data: createMockInvoiceData({
              items: [item],
            }),
          });
          expect(() => validateJobData(invalidData)).toThrow();
        });
      });
    });

    describe('Total calculations validation', () => {
      it('should validate invoice total calculations', () => {
        const testCases = [
          {
            description: 'mismatched subtotal',
            data: {
              ...mockJobData.data,
              subtotal: 100,
              tax: 20,
              total: 150,
            },
          },
          {
            description: 'negative tax',
            data: {
              ...mockJobData.data,
              subtotal: 200,
              tax: -20,
              total: 180,
            },
          },
          {
            description: 'incorrect total',
            data: {
              ...mockJobData.data,
              subtotal: 200,
              tax: 20,
              total: 250,
            },
          },
        ];

        testCases.forEach(({ data }) => {
          const invalidData = createMockJobData({
            data,
          });
          expect(() => validateJobData(invalidData)).toThrow();
        });
      });
    });
  });
});
