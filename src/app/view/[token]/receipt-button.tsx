"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format, parseISO } from "date-fns";

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

interface Props {
  receiptNumber: string;
  issuedAt: string;
  studentName: string;
  amount: number;
  month: number;
  year: number;
  notes: string | null;
}

export function ParentReceiptButton({
  receiptNumber,
  issuedAt,
  studentName,
  amount,
  month,
  year,
  notes,
}: Props) {
  function printReceipt() {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>收据 ${receiptNumber}</title>
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
        <div class="row"><span class="label">收据号:</span><span>${receiptNumber}</span></div>
        <div class="row"><span class="label">日期:</span><span>${issuedAt ? format(parseISO(issuedAt), "dd/MM/yyyy") : "-"}</span></div>
        <div class="row"><span class="label">学生:</span><span>${studentName}</span></div>
        <div class="row"><span class="label">期间:</span><span>${MONTHS[month - 1]} ${year}</span></div>
        ${notes ? `<div class="row"><span class="label">备注:</span><span>${notes}</span></div>` : ""}
        <div class="divider"></div>
        <div class="total">RM ${amount.toFixed(2)}</div>
        <div class="divider"></div>
        <div class="footer">
          <p>感谢您的付款。</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={printReceipt}>
      <Printer className="h-4 w-4 mr-1" />
      {receiptNumber}
    </Button>
  );
}
