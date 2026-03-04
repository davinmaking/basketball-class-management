import { format, parseISO } from "date-fns";

interface ReceiptData {
  receiptNumber: string;
  issuedAt: string | null;
  studentName: string;
  amount: number;
  month: number;
  year: number;
  notes: string | null;
}

/**
 * Generates receipt HTML string for printing in a new window.
 */
export function generateReceiptHtml(data: ReceiptData): string {
  const dateStr = data.issuedAt
    ? format(parseISO(data.issuedAt), "dd/MM/yyyy")
    : "-";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>收据 ${data.receiptNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 20px; margin: 0; }
        .header p { color: #666; font-size: 14px; }
        .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
        .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
        .row .label { color: #666; }
        .total { font-size: 18px; font-weight: bold; margin: 15px 0; text-align: center; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>付款收据</h1>
        <p>篮球训练班</p>
      </div>
      <div class="divider"></div>
      <div class="row"><span class="label">收据号:</span><span>${data.receiptNumber}</span></div>
      <div class="row"><span class="label">日期:</span><span>${dateStr}</span></div>
      <div class="row"><span class="label">学生:</span><span>${data.studentName}</span></div>
      <div class="row"><span class="label">期间:</span><span>${data.year}年${data.month}月</span></div>
      ${data.notes ? `<div class="row"><span class="label">备注:</span><span>${data.notes}</span></div>` : ""}
      <div class="divider"></div>
      <div class="total">RM ${data.amount.toFixed(2)}</div>
      <div class="divider"></div>
      <div class="footer">
        <p>感谢您的付款。</p>
      </div>
      <script>window.print();</script>
    </body>
    </html>
  `;
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
