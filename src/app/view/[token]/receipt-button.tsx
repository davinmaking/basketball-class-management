"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printReceiptHtml } from "@/lib/receipt-html";
import { toast } from "sonner";

interface Props {
  receiptNumber: string;
  issuedAt: string;
  studentName: string;
  schoolClass?: string | null;
  amount: number;
  month: number;
  year: number;
  notes: string | null;
  coachName?: string | null;
}

export function ParentReceiptButton({
  receiptNumber,
  issuedAt,
  studentName,
  schoolClass,
  amount,
  month,
  year,
  notes,
  coachName,
}: Props) {
  function handlePrint() {
    const success = printReceiptHtml({
      receiptNumber,
      issuedAt: issuedAt || null,
      studentName,
      schoolClass,
      amount,
      month,
      year,
      notes,
      coachName,
    });
    if (!success) {
      toast.error("打印窗口被浏览器拦截，请允许弹出窗口后重试");
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-1" />
      {receiptNumber}
    </Button>
  );
}
