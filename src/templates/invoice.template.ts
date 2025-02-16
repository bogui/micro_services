import { InvoiceData } from '../types';

export function generateInvoiceHTML(data: InvoiceData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${data.invoiceNumber}</title>
      <style>
        :root {
          --primary-color: #2563eb;
          --text-color: #1f2937;
          --border-color: #e5e7eb;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Arial', sans-serif;
          color: var(--text-color);
          line-height: 1.5;
          padding: 40px;
        }

        .invoice-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid var(--border-color);
        }

        .company-details {
          max-width: 50%;
        }

        .invoice-info {
          text-align: right;
        }

        .invoice-title {
          color: var(--primary-color);
          font-size: 32px;
          margin-bottom: 10px;
        }

        .invoice-number {
          font-size: 18px;
          color: var(--text-color);
          margin-bottom: 5px;
        }

        .invoice-date {
          color: #6b7280;
        }

        .section-title {
          font-size: 18px;
          color: var(--primary-color);
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid var(--border-color);
        }

        .client-details {
          margin: 30px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
        }

        th {
          background-color: #f8fafc;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: var(--primary-color);
          border-bottom: 2px solid var(--border-color);
        }

        td {
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .amount {
          text-align: right;
        }

        .quantity {
          text-align: center;
        }

        .totals {
          float: right;
          width: 300px;
        }

        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .totals-row.final {
          border-bottom: 2px solid var(--primary-color);
          font-weight: bold;
          font-size: 18px;
          color: var(--primary-color);
        }

        .footer {
          margin-top: 60px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-header">
        <div class="company-details">
          <h2>${data.companyDetails.name}</h2>
          <p>${data.companyDetails.address}</p>
          <p>Email: ${data.companyDetails.email}</p>
          <p>Phone: ${data.companyDetails.phone}</p>
        </div>
        <div class="invoice-info">
          <h1 class="invoice-title">INVOICE</h1>
          <p class="invoice-number">#${data.invoiceNumber}</p>
          <p class="invoice-date">
            Date: ${data.date}<br>
            Due Date: ${data.dueDate}
          </p>
        </div>
      </div>

      <div class="client-details">
        <h3 class="section-title">Bill To</h3>
        <p>${data.clientDetails.name}</p>
        <p>${data.clientDetails.address}</p>
        <p>Email: ${data.clientDetails.email}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40%">Description</th>
            <th style="width: 20%">Quantity</th>
            <th style="width: 20%">Unit Price</th>
            <th style="width: 20%">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items
            .map(
              item => `
            <tr>
              <td>${item.description}</td>
              <td class="quantity">${item.quantity}</td>
              <td class="amount">$${item.unitPrice.toFixed(2)}</td>
              <td class="amount">$${item.total.toFixed(2)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>$${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>Tax</span>
          <span>$${data.tax.toFixed(2)}</span>
        </div>
        <div class="totals-row final">
          <span>Total</span>
          <span>$${data.total.toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;
}
