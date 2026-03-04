"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { printCreditNoteHtml } from "@/lib/receipt-html";
import { toast } from "sonner";

interface Props {
  creditNoteNumber: string;
  issuedAt: string;
  studentName: string;
  schoolClass?: string | null;
  amount: number;
  year: number;
  month: number | null;
  totalPaid: number;
  totalSessions: number;
  totalDue: number;
  notes: string | null;
}

export function ParentCreditNoteButton({
  creditNoteNumber,
  issuedAt,
  studentName,
  schoolClass,
  amount,
  year,
  month,
  totalPaid,
  totalSessions,
  totalDue,
  notes,
}: Props) {
  function handlePrint() {
    const success = printCreditNoteHtml({
      creditNoteNumber,
      issuedAt: issuedAt || null,
      studentName,
      schoolClass,
      amount,
      year,
      month,
      totalPaid,
      totalSessions,
      totalDue,
      notes,
    });
    if (!success) {
      toast.error("打印窗口被浏览器拦截，请允许弹出窗口后重试");
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-1" />
      {creditNoteNumber}
    </Button>
  );
}
