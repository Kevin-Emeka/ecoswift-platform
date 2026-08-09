import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

const BRAND_NAVY = '#0B1F3A';
const BRAND_GREEN = '#059669';
const MUTED = '#6B7280';

/** Natural-language reads better on a receipt than a raw system status code — see the in-app receipt dialog's identical mapping. */
const STATUS_HEADLINE: Record<string, string> = {
  COMPLETED: 'Successful',
  PENDING: 'Pending Review',
  PROCESSING: 'Processing',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
  CANCELLED: 'Cancelled',
};

export interface ReceiptPdfData {
  receiptReference: string;
  transactionReference: string;
  status: string;
  amount: string;
  currencyCode: string;
  senderName?: string;
  recipientName?: string;
  sourceAccountNumber?: string;
  destinationAccountNumber?: string;
  description?: string;
  sandbox: boolean;
  transactionCreatedAt: string;
  // Wire transfers only — see ReceiptGeneratorService's doc comment.
  beneficiaryBankName?: string;
  beneficiarySwiftBic?: string;
  beneficiaryBankAddress?: string;
  beneficiaryBankCountryCode?: string;
  beneficiaryRoutingNumber?: string;
}

/**
 * Renders a `Receipt.content` JSON snapshot into a PDF on demand —
 * nothing binary is stored in Postgres; every download re-renders from
 * the same JSON source of truth, so there's exactly one place a receipt's
 * data can drift (`ReceiptGeneratorService`), not two. `pdfkit` chosen
 * over a headless-browser approach (Puppeteer etc.) for a one-page,
 * mostly-tabular document — no HTML/CSS layout engine needed, and it
 * avoids shipping a Chromium binary for something this simple.
 */
@Injectable()
export class ReceiptPdfService {
  render(data: ReceiptPdfData): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.rect(0, 0, doc.page.width, 90).fill(BRAND_NAVY);
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('Ecoswift Bank', 50, 32);
    doc
      .fillColor('#9CA3AF')
      .fontSize(10)
      .font('Helvetica')
      .text('Smart Digital Banking Platform', 50, 58);

    doc
      .fillColor(BRAND_NAVY)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Transaction Receipt', 50, 120);
    doc
      .fillColor(MUTED)
      .fontSize(10)
      .font('Helvetica')
      .text(`Receipt ${data.receiptReference}`, 50, 142);

    const rows: [string, string][] = [
      ['Receipt Number', data.receiptReference],
      ['Transfer Reference', data.transactionReference],
      [
        'Date',
        new Date(data.transactionCreatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      ],
      ['Time', new Date(data.transactionCreatedAt).toLocaleTimeString('en-US')],
      ['Amount', `${data.amount} ${data.currencyCode}`],
      ['Sender', data.senderName ?? data.sourceAccountNumber ?? '—'],
      ['Recipient', data.recipientName ?? data.destinationAccountNumber ?? '—'],
      ['Status', STATUS_HEADLINE[data.status] ?? data.status],
    ];
    if (data.description) rows.push(['Description', data.description]);
    if (data.beneficiaryBankName) rows.push(['Beneficiary Bank', data.beneficiaryBankName]);
    if (data.beneficiarySwiftBic) rows.push(['SWIFT / BIC', data.beneficiarySwiftBic]);
    if (data.beneficiaryBankAddress) {
      const address = [data.beneficiaryBankAddress, data.beneficiaryBankCountryCode]
        .filter(Boolean)
        .join(', ');
      rows.push(['Bank Address', address]);
    }
    if (data.beneficiaryRoutingNumber)
      rows.push(['Routing / Sort Code', data.beneficiaryRoutingNumber]);

    let y = 180;
    for (const [label, value] of rows) {
      doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(label, 50, y, { width: 160 });
      doc
        .fillColor(BRAND_NAVY)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(value, 220, y, { width: 300 });
      doc
        .moveTo(50, y + 22)
        .lineTo(545, y + 22)
        .strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .stroke();
      y += 34;
    }

    doc
      .fillColor(BRAND_GREEN)
      .fontSize(9)
      .font('Helvetica')
      .text('Ecoswift Bank — Smart Digital Banking Platform', 50, doc.page.height - 70, {
        width: 495,
        align: 'center',
      });

    return doc;
  }
}
