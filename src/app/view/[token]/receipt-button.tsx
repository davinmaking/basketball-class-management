"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printReceiptHtml, type ReceiptAllocation } from "@/lib/receipt-html";
import { toast } from "sonner";

interface Props {
  receiptNumber: string;
  issuedAt: string;
  date?: string | null;
  studentName: string;
  schoolClass?: string | null;
  amount: number;
  month: number;
  year: number;
  allocations?: ReceiptAllocation[];
  notes: string | null;
  coachName?: string | null;
}

export function ParentReceiptButton({
  receiptNumber,
  issuedAt,
  date,
  studentName,
  schoolClass,
  amount,
  month,
  year,
  allocations,
  notes,
  coachName,
}: Props) {
  function handlePrint() {
    const success = printReceiptHtml({
      receiptNumber,
      issuedAt: issuedAt || null,
      date,
      studentName,
      schoolClass,
      amount,
      month,
      year,
      allocations,
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
