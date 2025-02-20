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
      it('should throw for missing supplier fields', () => {
        const requiredFields = ['name', 'address', 'email', 'phone'];

        requiredFields.forEach(field => {
          const supplier = { ...mockJobData.data.supplier };
          delete (supplier as any)[field];

          const invalidData = createMockJobData({
            data: createMockInvoiceData({
              supplier,
            }),
          });

          expect(() => validateJobData(invalidData)).toThrow(
            /Invalid or missing supplier/,
          );
        });
      });
    });

    describe('Client details validation', () => {
      it('should throw for missing recipient fields', () => {
        const requiredFields = ['name', 'address', 'email', 'phone'];

        requiredFields.forEach(field => {
          const recipient = { ...mockJobData.data.recipient };
          delete (recipient as any)[field];

          const invalidData = createMockJobData({
            data: createMockInvoiceData({
              recipient,
            }),
          });

          expect(() => validateJobData(invalidData)).toThrow(
            /Invalid or missing recipient/,
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
              number: 1,
              description: 'Test',
              unit: 'pcs',
              quantity: -1,
              price: 100,
              total: 100,
            },
          },
          {
            description: 'invalid price',
            item: {
              number: 1,
              description: 'Test',
              unit: 'pcs',
              quantity: 1,
              price: -50,
              total: 50,
            },
          },
          {
            description: 'mismatched total',
            item: {
              number: 1,
              description: 'Test',
              unit: 'pcs',
              quantity: 2,
              price: 100,
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
            description: 'mismatched tax base',
            data: {
              ...mockJobData.data,
              totals: {
                taxBase: 100,
                vatAmount: 20,
                vatAmountReduced: 0,
                final: 150,
              },
            },
          },
          {
            description: 'negative VAT',
            data: {
              ...mockJobData.data,
              totals: {
                taxBase: 200,
                vatAmount: -20,
                vatAmountReduced: 0,
                final: 180,
              },
            },
          },
          {
            description: 'incorrect final total',
            data: {
              ...mockJobData.data,
              totals: {
                taxBase: 200,
                vatAmount: 20,
                vatAmountReduced: 0,
                final: 250,
              },
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
