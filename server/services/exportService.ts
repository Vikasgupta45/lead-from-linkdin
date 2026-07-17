import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import PDFDocument from 'pdfkit';
import { Lead } from '../types/api.js';

export type ExportFormat = 'csv' | 'pdf' | 'docx';

const exportHeaders = ['Name', 'Title', 'Company', 'Location', 'LinkedIn Profile'];

function csvCell(value: string | undefined): string {
  const normalized = value ?? '';
  const safe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return `"${safe.replace(/"/g, '""')}"`;
}

function leadCells(lead: Lead): string[] {
  return [lead.name, lead.title ?? '', lead.company ?? '', lead.location ?? '', lead.profileUrl];
}

export class LeadExportService {
  static createCsv(leads: Lead[]): Buffer {
    const rows = [exportHeaders, ...leads.map(leadCells)];
    return Buffer.from(rows.map(row => row.map(csvCell).join(',')).join('\r\n'), 'utf8');
  }

  static async createDocx(leads: Lead[]): Promise<Buffer> {
    const headerRow = new TableRow({
      children: exportHeaders.map(header => new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
      })),
    });

    const dataRows = leads.map(lead => new TableRow({
      children: leadCells(lead).map(value => new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        children: [new Paragraph(value ?? '')],
      })),
    }));

    const document = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'LinkedIn Post Engagement Leads', heading: HeadingLevel.TITLE }),
          new Paragraph({ text: `Generated ${new Date().toLocaleDateString('en-US')} · ${leads.length} lead${leads.length === 1 ? '' : 's'}` }),
          new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      }],
    });

    return Packer.toBuffer(document);
  }

  static createPdf(leads: Lead[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ margin: 42, size: 'A4', info: { Title: 'LinkedIn Post Engagement Leads', Author: 'SBL.so' } });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      document.fontSize(20).fillColor('#0f172a').text('LinkedIn Post Engagement Leads');
      document.moveDown(0.25).fontSize(9).fillColor('#475569').text(`Generated ${new Date().toLocaleDateString('en-US')} · ${leads.length} lead${leads.length === 1 ? '' : 's'}`);
      document.moveDown(1);

      for (const [index, lead] of leads.entries()) {
        if (document.y > 700) document.addPage();
        document.fontSize(12).fillColor('#0f172a').text(`${index + 1}. ${lead.name}`);
        const details = [lead.title, lead.company, lead.location].filter(Boolean).join(' · ');
        if (details) document.fontSize(9).fillColor('#475569').text(details);
        document.fontSize(8).fillColor('#2563eb').text(lead.profileUrl, { link: lead.profileUrl, underline: true });
        document.moveDown(0.65);
      }

      document.end();
    });
  }
}
