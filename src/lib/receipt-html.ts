import { format, parseISO } from "date-fns";
import { APP_CONFIG } from "./config";

interface ReceiptData {
  receiptNumber: string;
  issuedAt: string | null;
  studentName: string;
  schoolClass?: string | null;
  amount: number;
  month: number;
  year: number;
  notes: string | null;
}

/**
 * Generates receipt HTML in bilingual Malaysian school format (BM + Chinese).
 */
export function generateReceiptHtml(data: ReceiptData): string {
  const dateStr = data.issuedAt
    ? format(parseISO(data.issuedAt), "dd/MM/yyyy")
    : "-";

  const schoolAddress = APP_CONFIG.schoolAddress
    ? `<p class="school-address">${APP_CONFIG.schoolAddress}</p>`
    : "";

  const schoolPhone = APP_CONFIG.schoolPhone
    ? `<p class="school-phone">Tel: ${APP_CONFIG.schoolPhone}</p>`
    : "";

  const schoolClassRow = data.schoolClass
    ? `<tr>
        <td class="label">Kelas / 班级:</td>
        <td class="value">${data.schoolClass}</td>
      </tr>`
    : "";

  const notesRow = data.notes
    ? `<tr>
        <td class="label">Catatan / 备注:</td>
        <td class="value">${data.notes}</td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <title>Resit ${data.receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      max-width: 500px;
      margin: 0 auto;
      padding: 30px 25px;
      font-size: 13px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .school-address, .school-phone {
      font-size: 11px;
      color: #666;
    }
    .receipt-title {
      text-align: center;
      font-size: 15px;
      font-weight: bold;
      margin: 16px 0 12px;
      padding: 6px 0;
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
    }
    .info-table {
      width: 100%;
      margin-bottom: 16px;
    }
    .info-table td {
      padding: 4px 0;
      vertical-align: top;
    }
    .info-table .label {
      color: #666;
      width: 160px;
      white-space: nowrap;
    }
    .info-table .value {
      font-weight: 500;
    }
    .amount-box {
      border: 2px solid #333;
      padding: 10px;
      margin: 16px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
      font-weight: bold;
    }
    .signature-section {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      gap: 30px;
    }
    .signature-block {
      flex: 1;
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      margin-bottom: 6px;
      height: 50px;
    }
    .signature-label {
      font-size: 11px;
      color: #666;
    }
    .stamp-area {
      margin-top: 24px;
      text-align: center;
    }
    .stamp-box {
      display: inline-block;
      width: 120px;
      height: 80px;
      border: 1px dashed #ccc;
      margin-bottom: 6px;
    }
    .stamp-label {
      font-size: 11px;
      color: #999;
    }
    @media print {
      body { margin: 0; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${APP_CONFIG.schoolName}</h1>
    ${schoolAddress}
    ${schoolPhone}
  </div>

  <div class="receipt-title">RESIT RASMI / 正式收据</div>

  <table class="info-table">
    <tr>
      <td class="label">No. Resit / 收据号:</td>
      <td class="value">${data.receiptNumber}</td>
    </tr>
    <tr>
      <td class="label">Tarikh / 日期:</td>
      <td class="value">${dateStr}</td>
    </tr>
    <tr>
      <td class="label">Nama Murid / 学生:</td>
      <td class="value">${data.studentName}</td>
    </tr>
    ${schoolClassRow}
    <tr>
      <td class="label">Keterangan / 项目:</td>
      <td class="value">Yuran ${APP_CONFIG.classNameBm} - ${data.month}/${data.year}</td>
    </tr>
    ${notesRow}
  </table>

  <div class="amount-box">
    <span>Jumlah / 金额:</span>
    <span>${APP_CONFIG.currency} ${data.amount.toFixed(2)}</span>
  </div>

  <div class="signature-section">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-label">Diterima oleh / 收款人</div>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-label">Tandatangan Pelajar / 学生签名</div>
    </div>
  </div>

  <div class="stamp-area">
    <div class="stamp-box"></div>
    <div class="stamp-label">Cop Sekolah / 校方盖章</div>
  </div>

  <script>window.print();</script>
</body>
</html>`;
}

/**
 * Opens a new window and prints a receipt. Returns false if popup was blocked.
 */
export function printReceiptHtml(data: ReceiptData): boolean {
  const html = generateReceiptHtml(data);
  const win = window.open("", "_blank");
  if (!win) {
    return false;
  }
  win.document.write(html);
  win.document.close();
  return true;
}

// ── Credit Note (退费单) ──────────────────────────────────

interface CreditNoteData {
  creditNoteNumber: string;
  issuedAt: string | null;
  studentName: string;
  schoolClass?: string | null;
  amount: number;
  year: number;
  month: number | null; // null = full year
  totalPaid: number;
  totalSessions: number;
  totalDue: number;
  notes: string | null;
}

/**
 * Generates credit note HTML in bilingual Malaysian school format (BM + Chinese).
 */
export function generateCreditNoteHtml(data: CreditNoteData): string {
  const dateStr = data.issuedAt
    ? format(parseISO(data.issuedAt), "dd/MM/yyyy")
    : "-";

  const schoolAddress = APP_CONFIG.schoolAddress
    ? `<p class="school-address">${APP_CONFIG.schoolAddress}</p>`
    : "";

  const schoolPhone = APP_CONFIG.schoolPhone
    ? `<p class="school-phone">Tel: ${APP_CONFIG.schoolPhone}</p>`
    : "";

  const schoolClassRow = data.schoolClass
    ? `<tr>
        <td class="label">Kelas / 班级:</td>
        <td class="value">${data.schoolClass}</td>
      </tr>`
    : "";

  const periodStr = data.month
    ? `${data.month}/${data.year}`
    : `${data.year} (全年 / Setahun)`;

  const notesRow = data.notes
    ? `<tr>
        <td class="label">Catatan / 备注:</td>
        <td class="value">${data.notes}</td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <title>Nota Kredit ${data.creditNoteNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      max-width: 500px;
      margin: 0 auto;
      padding: 30px 25px;
      font-size: 13px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .school-address, .school-phone {
      font-size: 11px;
      color: #666;
    }
    .credit-note-title {
      text-align: center;
      font-size: 15px;
      font-weight: bold;
      margin: 16px 0 12px;
      padding: 6px 0;
      border-top: 2px solid #1a5276;
      border-bottom: 2px solid #1a5276;
      color: #1a5276;
    }
    .info-table {
      width: 100%;
      margin-bottom: 16px;
    }
    .info-table td {
      padding: 4px 0;
      vertical-align: top;
    }
    .info-table .label {
      color: #666;
      width: 180px;
      white-space: nowrap;
    }
    .info-table .value {
      font-weight: 500;
    }
    .breakdown {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px 12px;
      margin: 12px 0;
      background: #f8f9fa;
      font-size: 12px;
    }
    .breakdown-title {
      font-weight: bold;
      margin-bottom: 6px;
      color: #555;
    }
    .breakdown-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    .breakdown-row.total {
      border-top: 1px solid #ccc;
      margin-top: 4px;
      padding-top: 6px;
      font-weight: bold;
    }
    .amount-box {
      border: 2px solid #1a5276;
      padding: 10px;
      margin: 16px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
      font-weight: bold;
      color: #1a5276;
    }
    .signature-section {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      gap: 30px;
    }
    .signature-block {
      flex: 1;
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      margin-bottom: 6px;
      height: 50px;
    }
    .signature-label {
      font-size: 11px;
      color: #666;
    }
    .stamp-area {
      margin-top: 24px;
      text-align: center;
    }
    .stamp-box {
      display: inline-block;
      width: 120px;
      height: 80px;
      border: 1px dashed #ccc;
      margin-bottom: 6px;
    }
    .stamp-label {
      font-size: 11px;
      color: #999;
    }
    @media print {
      body { margin: 0; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${APP_CONFIG.schoolName}</h1>
    ${schoolAddress}
    ${schoolPhone}
  </div>

  <div class="credit-note-title">NOTA KREDIT / 退费单</div>

  <table class="info-table">
    <tr>
      <td class="label">No. Nota Kredit / 退费单号:</td>
      <td class="value">${data.creditNoteNumber}</td>
    </tr>
    <tr>
      <td class="label">Tarikh / 日期:</td>
      <td class="value">${dateStr}</td>
    </tr>
    <tr>
      <td class="label">Nama Murid / 学生:</td>
      <td class="value">${data.studentName}</td>
    </tr>
    ${schoolClassRow}
    <tr>
      <td class="label">Tempoh / 退费期间:</td>
      <td class="value">Yuran ${APP_CONFIG.classNameBm} - ${periodStr}</td>
    </tr>
    ${notesRow}
  </table>

  <div class="breakdown">
    <div class="breakdown-title">Pengiraan / 计算明细:</div>
    <div class="breakdown-row">
      <span>Jumlah dibayar / 已付总额:</span>
      <span>${APP_CONFIG.currency} ${data.totalPaid.toFixed(2)}</span>
    </div>
    <div class="breakdown-row">
      <span>Sesi hadir / 出席课次:</span>
      <span>${data.totalSessions}</span>
    </div>
    <div class="breakdown-row">
      <span>Yuran sepatutnya / 应缴费用:</span>
      <span>${APP_CONFIG.currency} ${data.totalDue.toFixed(2)}</span>
    </div>
    <div class="breakdown-row total">
      <span>Bayaran balik / 退费金额:</span>
      <span>${APP_CONFIG.currency} ${data.amount.toFixed(2)}</span>
    </div>
  </div>

  <div class="amount-box">
    <span>Jumlah Bayaran Balik / 退费金额:</span>
    <span>${APP_CONFIG.currency} ${data.amount.toFixed(2)}</span>
  </div>

  <div class="signature-section">
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-label">Diluluskan oleh / 批准人</div>
    </div>
    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-label">Penerima / 收款人</div>
    </div>
  </div>

  <div class="stamp-area">
    <div class="stamp-box"></div>
    <div class="stamp-label">Cop Sekolah / 校方盖章</div>
  </div>

  <script>window.print();</script>
</body>
</html>`;
}

/**
 * Opens a new window and prints a credit note. Returns false if popup was blocked.
 */
export function printCreditNoteHtml(data: CreditNoteData): boolean {
  const html = generateCreditNoteHtml(data);
  const win = window.open("", "_blank");
  if (!win) {
    return false;
  }
  win.document.write(html);
  win.document.close();
  return true;
}
