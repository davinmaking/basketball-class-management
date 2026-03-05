import { format } from "date-fns";
import { APP_CONFIG } from "./config";
import { MONTHS } from "./constants";

// ── Shared HTML wrapper ──────────────────────────────────

function wrapReportHtml(title: string, subtitle: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 30px 25px;
      font-size: 13px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 2px;
    }
    .report-title {
      text-align: center;
      font-size: 15px;
      font-weight: bold;
      margin: 12px 0;
      padding: 6px 0;
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
    }
    .subtitle {
      text-align: center;
      font-size: 13px;
      color: #666;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      margin: 20px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #ddd;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 6px 8px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
      font-weight: bold;
      white-space: nowrap;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .total-row { font-weight: bold; background: #f9f9f9; }
    .summary-box {
      border: 2px solid #333;
      padding: 12px;
      margin: 16px 0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }
    .summary-row.total {
      border-top: 1px solid #ccc;
      margin-top: 4px;
      padding-top: 8px;
      font-weight: bold;
      font-size: 14px;
    }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .footer {
      margin-top: 24px;
      font-size: 11px;
      color: #999;
      text-align: right;
    }
    .voided { text-decoration: line-through; color: #999; }
    @media print {
      body { margin: 0; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${APP_CONFIG.schoolName}</h1>
  </div>
  <div class="report-title">${title}</div>
  <div class="subtitle">${subtitle}</div>
  ${bodyContent}
  <div class="footer">生成日期 / Tarikh: ${format(new Date(), "dd/MM/yyyy")}</div>
  <script>window.print();</script>
</body>
</html>`;
}

function openPrintWindow(html: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

// ── 1. Student Report (学生财务报表) ──────────────────────

export interface StudentReportData {
  studentName: string;
  schoolClass: string | null;
  year: number;
  payments: { month: number; amount: number; date: string; notes: string | null }[];
  refunds: { month: number | null; amount: number; date: string; notes: string | null }[];
  totalPaid: number;
  totalRefunded: number;
  netAmount: number;
}

export function generateStudentReportHtml(data: StudentReportData): string {
  const paymentRows = data.payments.length > 0
    ? data.payments.map(p => `
      <tr>
        <td class="text-center">${p.month}月</td>
        <td class="text-right">${APP_CONFIG.currency} ${p.amount.toFixed(2)}</td>
        <td class="text-center">${p.date}</td>
        <td>${p.notes || "-"}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="text-center">无记录</td></tr>`;

  const refundRows = data.refunds.length > 0
    ? data.refunds.map(r => `
      <tr>
        <td class="text-center">${r.month ? `${r.month}月` : "全年"}</td>
        <td class="text-right">${APP_CONFIG.currency} ${r.amount.toFixed(2)}</td>
        <td class="text-center">${r.date}</td>
        <td>${r.notes || "-"}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="text-center">无记录</td></tr>`;

  const body = `
    <div style="margin-bottom:12px;">
      <strong>Nama / 学生:</strong> ${data.studentName}
      ${data.schoolClass ? ` &nbsp; <strong>Kelas / 班级:</strong> ${data.schoolClass}` : ""}
    </div>

    <div class="section-title">Pembayaran / 付款记录</div>
    <table>
      <thead><tr>
        <th class="text-center">Bulan / 月份</th>
        <th class="text-right">Jumlah / 金额</th>
        <th class="text-center">Tarikh / 日期</th>
        <th>Catatan / 备注</th>
      </tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>

    <div class="section-title">Bayaran Balik / 退费记录</div>
    <table>
      <thead><tr>
        <th class="text-center">Tempoh / 期间</th>
        <th class="text-right">Jumlah / 金额</th>
        <th class="text-center">Tarikh / 日期</th>
        <th>Catatan / 备注</th>
      </tr></thead>
      <tbody>${refundRows}</tbody>
    </table>

    <div class="summary-box">
      <div class="summary-row">
        <span>Jumlah dibayar / 付款总额:</span>
        <span>${APP_CONFIG.currency} ${data.totalPaid.toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span>Jumlah bayaran balik / 退费总额:</span>
        <span>${APP_CONFIG.currency} ${data.totalRefunded.toFixed(2)}</span>
      </div>
      <div class="summary-row total">
        <span>Bersih / 净额:</span>
        <span class="${data.netAmount >= 0 ? "positive" : "negative"}">${APP_CONFIG.currency} ${data.netAmount.toFixed(2)}</span>
      </div>
    </div>`;

  return wrapReportHtml(
    "LAPORAN KEWANGAN PELAJAR / 学生财务报表",
    `${data.year}年`,
    body
  );
}

export function printStudentReport(data: StudentReportData): boolean {
  return openPrintWindow(generateStudentReportHtml(data));
}

// ── 2. Monthly Report (月度收支报表) ──────────────────────

export interface MonthlyReportData {
  month: number;
  year: number;
  payments: { studentName: string; amount: number; date: string }[];
  refunds: { studentName: string; amount: number; date: string }[];
  totalPayments: number;
  totalRefunds: number;
  netIncome: number;
}

export function generateMonthlyReportHtml(data: MonthlyReportData): string {
  const paymentRows = data.payments.length > 0
    ? data.payments.map(p => `
      <tr>
        <td>${p.studentName}</td>
        <td class="text-right">${APP_CONFIG.currency} ${p.amount.toFixed(2)}</td>
        <td class="text-center">${p.date}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" class="text-center">无记录</td></tr>`;

  const refundRows = data.refunds.length > 0
    ? data.refunds.map(r => `
      <tr>
        <td>${r.studentName}</td>
        <td class="text-right">${APP_CONFIG.currency} ${r.amount.toFixed(2)}</td>
        <td class="text-center">${r.date}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" class="text-center">无记录</td></tr>`;

  const body = `
    <div class="section-title">Pendapatan / 进账（收入）</div>
    <table>
      <thead><tr>
        <th>Nama / 学生</th>
        <th class="text-right">Jumlah / 金额</th>
        <th class="text-center">Tarikh / 日期</th>
      </tr></thead>
      <tbody>
        ${paymentRows}
        <tr class="total-row">
          <td>Jumlah / 合计</td>
          <td class="text-right">${APP_CONFIG.currency} ${data.totalPayments.toFixed(2)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">Perbelanjaan / 出账（退费）</div>
    <table>
      <thead><tr>
        <th>Nama / 学生</th>
        <th class="text-right">Jumlah / 金额</th>
        <th class="text-center">Tarikh / 日期</th>
      </tr></thead>
      <tbody>
        ${refundRows}
        <tr class="total-row">
          <td>Jumlah / 合计</td>
          <td class="text-right">${APP_CONFIG.currency} ${data.totalRefunds.toFixed(2)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="summary-box">
      <div class="summary-row">
        <span>Pendapatan / 总收入:</span>
        <span class="positive">${APP_CONFIG.currency} ${data.totalPayments.toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span>Perbelanjaan / 总支出:</span>
        <span class="negative">${APP_CONFIG.currency} ${data.totalRefunds.toFixed(2)}</span>
      </div>
      <div class="summary-row total">
        <span>Bersih / 净收入:</span>
        <span class="${data.netIncome >= 0 ? "positive" : "negative"}">${APP_CONFIG.currency} ${data.netIncome.toFixed(2)}</span>
      </div>
    </div>`;

  return wrapReportHtml(
    "LAPORAN BULANAN / 月度收支报表",
    `${data.year}年${data.month}月`,
    body
  );
}

export function printMonthlyReport(data: MonthlyReportData): boolean {
  return openPrintWindow(generateMonthlyReportHtml(data));
}

// ── 3. Coach Payment Report (教练薪酬报表) ───────────────

export interface CoachPaymentReportData {
  month: number;
  year: number;
  coachPayments: { coachName: string; amount: number; date: string; notes: string | null }[];
  totalCoachPayments: number;
}

export function generateCoachPaymentReportHtml(data: CoachPaymentReportData): string {
  const rows = data.coachPayments.length > 0
    ? data.coachPayments.map(cp => `
      <tr>
        <td>${cp.coachName}</td>
        <td class="text-right">${APP_CONFIG.currency} ${cp.amount.toFixed(2)}</td>
        <td class="text-center">${cp.date}</td>
        <td>${cp.notes || "-"}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="text-center">无记录</td></tr>`;

  const body = `
    <table>
      <thead><tr>
        <th>Jurulatih / 教练</th>
        <th class="text-right">Jumlah / 金额</th>
        <th class="text-center">Tarikh / 日期</th>
        <th>Catatan / 备注</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td>Jumlah / 合计</td>
          <td class="text-right">${APP_CONFIG.currency} ${data.totalCoachPayments.toFixed(2)}</td>
          <td></td>
          <td></td>
        </tr>
      </tbody>
    </table>`;

  return wrapReportHtml(
    "BAYARAN JURULATIH / 教练薪酬报表",
    `${data.year}年${data.month}月`,
    body
  );
}

export function printCoachPaymentReport(data: CoachPaymentReportData): boolean {
  return openPrintWindow(generateCoachPaymentReportHtml(data));
}

// ── 4. Annual Report (年度财务报表) ──────────────────────

export interface AnnualReportData {
  year: number;
  monthlyData: {
    month: number;
    payments: number;
    refunds: number;
    coachPayments: number;
    netIncome: number;
  }[];
  yearTotals: {
    totalPayments: number;
    totalRefunds: number;
    totalCoachPayments: number;
    totalExpenses: number;
    netIncome: number;
  };
  outstandingBalance: number;
}

export function generateAnnualReportHtml(data: AnnualReportData): string {
  const fmt = (n: number) => `${APP_CONFIG.currency} ${n.toFixed(2)}`;
  const fmtClass = (n: number) => n >= 0 ? "positive" : "negative";

  // Section 1: Income
  const incomeRows = data.monthlyData.map(m => `
    <tr>
      <td class="text-center">${MONTHS[m.month - 1]}</td>
      <td class="text-right">${m.payments > 0 ? fmt(m.payments) : "-"}</td>
    </tr>`).join("");

  // Section 2: Expenses
  const expenseRows = data.monthlyData.map(m => {
    const total = m.refunds + m.coachPayments;
    return `
    <tr>
      <td class="text-center">${MONTHS[m.month - 1]}</td>
      <td class="text-right">${m.refunds > 0 ? fmt(m.refunds) : "-"}</td>
      <td class="text-right">${m.coachPayments > 0 ? fmt(m.coachPayments) : "-"}</td>
      <td class="text-right">${total > 0 ? fmt(total) : "-"}</td>
    </tr>`;
  }).join("");

  // Section 3: Net Income
  const netRows = data.monthlyData.map(m => {
    const expenses = m.refunds + m.coachPayments;
    return `
    <tr>
      <td class="text-center">${MONTHS[m.month - 1]}</td>
      <td class="text-right">${m.payments > 0 ? fmt(m.payments) : "-"}</td>
      <td class="text-right">${expenses > 0 ? fmt(expenses) : "-"}</td>
      <td class="text-right ${fmtClass(m.netIncome)}">${fmt(m.netIncome)}</td>
    </tr>`;
  }).join("");

  const t = data.yearTotals;

  const body = `
    <div class="section-title">一、收入总结 / RINGKASAN PENDAPATAN</div>
    <table>
      <thead><tr>
        <th class="text-center">Bulan / 月份</th>
        <th class="text-right">Yuran / 学费收入 (${APP_CONFIG.currency})</th>
      </tr></thead>
      <tbody>
        ${incomeRows}
        <tr class="total-row">
          <td class="text-center">Jumlah / 合计</td>
          <td class="text-right">${fmt(t.totalPayments)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">二、支出总结 / RINGKASAN PERBELANJAAN</div>
    <table>
      <thead><tr>
        <th class="text-center">Bulan / 月份</th>
        <th class="text-right">Bayaran Balik / 退费 (${APP_CONFIG.currency})</th>
        <th class="text-right">Jurulatih / 教练薪酬 (${APP_CONFIG.currency})</th>
        <th class="text-right">Jumlah / 合计 (${APP_CONFIG.currency})</th>
      </tr></thead>
      <tbody>
        ${expenseRows}
        <tr class="total-row">
          <td class="text-center">Jumlah / 合计</td>
          <td class="text-right">${fmt(t.totalRefunds)}</td>
          <td class="text-right">${fmt(t.totalCoachPayments)}</td>
          <td class="text-right">${fmt(t.totalExpenses)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">三、净收入 / PENDAPATAN BERSIH</div>
    <table>
      <thead><tr>
        <th class="text-center">Bulan / 月份</th>
        <th class="text-right">Pendapatan / 收入 (${APP_CONFIG.currency})</th>
        <th class="text-right">Perbelanjaan / 支出 (${APP_CONFIG.currency})</th>
        <th class="text-right">Bersih / 净收入 (${APP_CONFIG.currency})</th>
      </tr></thead>
      <tbody>
        ${netRows}
        <tr class="total-row">
          <td class="text-center">Jumlah / 合计</td>
          <td class="text-right">${fmt(t.totalPayments)}</td>
          <td class="text-right">${fmt(t.totalExpenses)}</td>
          <td class="text-right ${fmtClass(t.netIncome)}">${fmt(t.netIncome)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">四、未收余额 / BAKI TERTUNGGAK</div>
    <div class="summary-box">
      <div class="summary-row total">
        <span>Jumlah tertunggak / 学生未缴总额:</span>
        <span class="${data.outstandingBalance > 0 ? "negative" : "positive"}">${fmt(data.outstandingBalance)}</span>
      </div>
    </div>`;

  return wrapReportHtml(
    "PENYATA KEWANGAN TAHUNAN / 年度财务报表",
    `${data.year}年`,
    body
  );
}

export function printAnnualReport(data: AnnualReportData): boolean {
  return openPrintWindow(generateAnnualReportHtml(data));
}
