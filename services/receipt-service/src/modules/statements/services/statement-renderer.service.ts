import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ecoswift/database';
import PDFDocument from 'pdfkit';

const BRAND_NAVY = '#0B1F3A';
const MUTED = '#6B7280';

export interface StatementLine {
  date: string;
  description: string;
  reference: string;
  debit?: string;
  credit?: string;
}

/**
 * Renders a statement fresh from `Transaction` rows every time it's
 * downloaded, rather than persisting a generated file — `Statement.fileUrl`
 * stays unused (no object-storage service exists in this project). The
 * `Statement` row itself still exists and still matters: it's the
 * customer-visible record that a given period *was* generated and when,
 * matching `StatementRequest`'s QUEUED -> RUNNING -> COMPLETED lifecycle
 * (`StatementWorker`) — only the bytes are recomputed, not the fact of
 * generation.
 */
@Injectable()
export class StatementRendererService {
  constructor(private readonly prisma: PrismaService) {}

  async loadLines(accountId: string, periodStart: Date, periodEnd: Date): Promise<StatementLine[]> {
    const inclusiveEnd = new Date(periodEnd);
    inclusiveEnd.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        OR: [{ sourceAccountId: accountId }, { destinationAccountId: accountId }],
        createdAt: { gte: periodStart, lte: inclusiveEnd },
      },
      orderBy: { createdAt: 'asc' },
    });

    return transactions.map((t) => ({
      date: t.createdAt.toISOString(),
      description: t.description ?? t.transactionReference,
      reference: t.transactionReference,
      debit: t.sourceAccountId === accountId ? t.amount.toString() : undefined,
      credit: t.destinationAccountId === accountId ? t.amount.toString() : undefined,
    }));
  }

  renderCsv(lines: StatementLine[]): string {
    const header = 'Date,Description,Reference,Debit,Credit';
    const rows = lines.map((l) => [l.date, `"${l.description.replace(/"/g, '""')}"`, l.reference, l.debit ?? '', l.credit ?? ''].join(','));
    return [header, ...rows].join('\n');
  }

  renderPdf(params: { accountNumber: string; currencyCode: string; periodStart: Date; periodEnd: Date; lines: StatementLine[] }): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.rect(0, 0, doc.page.width, 90).fill(BRAND_NAVY);
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('Ecoswift Bank', 50, 32);
    doc.fillColor('#9CA3AF').fontSize(10).font('Helvetica').text('Smart Digital Banking Platform', 50, 58);

    doc.fillColor(BRAND_NAVY).fontSize(16).font('Helvetica-Bold').text('Account Statement', 50, 120);
    doc
      .fillColor(MUTED)
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Account ${params.accountNumber} · ${params.periodStart.toLocaleDateString('en-US')} – ${params.periodEnd.toLocaleDateString('en-US')}`,
        50,
        142,
      );

    let y = 180;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(MUTED);
    doc.text('Date', 50, y, { width: 80 });
    doc.text('Description', 130, y, { width: 220 });
    doc.text('Debit', 350, y, { width: 90, align: 'right' });
    doc.text('Credit', 445, y, { width: 90, align: 'right' });
    y += 16;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#D1D5DB').lineWidth(1).stroke();
    y += 8;

    doc.font('Helvetica').fontSize(9);
    if (params.lines.length === 0) {
      doc.fillColor(MUTED).text('No transactions in this period.', 50, y);
      y += 20;
    }
    for (const line of params.lines) {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }
      doc.fillColor(BRAND_NAVY).text(new Date(line.date).toLocaleDateString('en-US'), 50, y, { width: 80 });
      doc.text(line.description, 130, y, { width: 220 });
      doc.text(line.debit ? `${line.debit} ${params.currencyCode}` : '', 350, y, { width: 90, align: 'right' });
      doc.text(line.credit ? `${line.credit} ${params.currencyCode}` : '', 445, y, { width: 90, align: 'right' });
      y += 18;
    }

    return doc;
  }
}
