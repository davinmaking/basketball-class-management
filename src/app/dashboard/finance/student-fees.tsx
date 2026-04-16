"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DollarSign, MessageCircle, History, Trash2, Undo2, Plus, X, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { formatPhoneForWhatsApp } from "@/lib/phone";
import { MONTHS } from "@/lib/constants";
import { APP_CONFIG } from "@/lib/config";
import { getLanguageLabel } from "@/lib/language";

type Student = Tables<"students">;
type Coach = Tables<"coaches">;

interface HistoryPayment {
  id: string;
  amount: number;
  payment_date: string;
  month: number;
  year: number;
  receipt_id: string | null;
  notes: string | null;
  voided: boolean;
  voided_at: string | null;
  voided_reason: string | null;
  receipt: { id: string; receipt_number: string; voided: boolean } | null;
  coach: { name: string } | null;
}

interface Allocation {
  month: number;
  year: number;
  amount: string;
}

interface HistoryRefund {
  id: string;
  amount: number;
  refund_date: string;
  year: number;
  month: number | null;
  notes: string | null;
  voided: boolean;
  voided_at: string | null;
  voided_reason: string | null;
  credit_notes: { credit_note_number: string; voided: boolean }[];
  coach: { name: string } | null;
}

interface RefundCalc {
  totalPaid: number;
  totalSessions: number;
  totalDue: number;
  existingRefunds: number;
  refundable: number;
}

interface FeeRow {
  student: Student;
  sessionsAttended: number;
  amountDue: number;
  totalPaid: number;
  balance: number;
}

interface ArrearsEntry {
  student: Student;
  amount: number; // positive number representing outstanding from prior months
}

function getWhatsAppUrl(
  student: Student,
  amountDue: number,
  month: number,
  year: number
): string | null {
  const phone = formatPhoneForWhatsApp(student.phone);
  if (!phone) return null;

  const lang = student.preferred_language ?? "ms";

  let text: string;
  if (lang === "zh") {
    text =
      `您好，\n\n` +
      `这是${APP_CONFIG.className}缴费提醒（${student.name}）。\n\n` +
      `月份: ${year}年${month}月\n` +
      `欠缴金额: ${APP_CONFIG.currency}${amountDue.toFixed(2)}\n\n` +
      `请尽快付款，谢谢！`;
  } else {
    text =
      `Assalamualaikum / Salam sejahtera,\n\n` +
      `Ini adalah peringatan yuran ${APP_CONFIG.classNameBm.toLowerCase()} untuk ${student.name}.\n\n` +
      `Bulan: ${month}/${year}\n` +
      `Jumlah tertunggak: ${APP_CONFIG.currency}${amountDue.toFixed(2)}\n\n` +
      `Sila buat pembayaran secepat mungkin. Terima kasih!`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function StudentFees() {
  const [feeData, setFeeData] = useState<FeeRow[]>([]);
  const [arrears, setArrears] = useState<ArrearsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentCoachId, setPaymentCoachId] = useState("");
  // Owing per (year-month) for the student being paid, used to show "欠 RM X" hints
  const [studentOwingByKey, setStudentOwingByKey] = useState<Record<string, number>>({});
  const [loadingOwing, setLoadingOwing] = useState(false);

  // Coaches
  const [coaches, setCoaches] = useState<Coach[]>([]);

  // History + void dialog state
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [historyPayments, setHistoryPayments] = useState<HistoryPayment[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string>("");
  const [voidReason, setVoidReason] = useState("");
  const [voidingPayment, setVoidingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);

  // Refund dialog state
  const [showRefund, setShowRefund] = useState(false);
  const [refundStudent, setRefundStudent] = useState<Student | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [refundDate, setRefundDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [refundCalc, setRefundCalc] = useState<RefundCalc | null>(null);
  const [savingRefund, setSavingRefund] = useState(false);
  const [refundCoachId, setRefundCoachId] = useState("");
  const [refundPeriodType, setRefundPeriodType] = useState<"month" | "year">("year");
  const [loadingRefundCalc, setLoadingRefundCalc] = useState(false);

  // History refunds
  const [historyRefunds, setHistoryRefunds] = useState<HistoryRefund[]>([]);
  const [voidRefundId, setVoidRefundId] = useState<string>("");
  const [showVoidRefund, setShowVoidRefund] = useState(false);
  const [voidRefundReason, setVoidRefundReason] = useState("");
  const [voidingRefund, setVoidingRefund] = useState(false);
  const [deletingRefundId, setDeletingRefundId] = useState<string | null>(null);
  const [confirmDeleteRefundId, setConfirmDeleteRefundId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchFees = useCallback(async () => {
    setLoading(true);
    const month = selectedMonth + 1;
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${selectedYear}-${monthStr}-01`;
    const endMonth = selectedMonth === 11 ? 1 : selectedMonth + 2;
    const endYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const [studentsRes, sessionsRes, paymentsRes] = await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase
        .from("class_sessions")
        .select("id")
        .gte("session_date", startDate)
        .lt("session_date", endDate),
      supabase
        .from("payments")
        .select("student_id, amount")
        .eq("month", month)
        .eq("year", selectedYear)
        .eq("voided", false),
    ]);

    const students = studentsRes.data ?? [];
    const sessionIds = (sessionsRes.data ?? []).map((s) => s.id);

    // Get attendance for this month's sessions (only count chargeable: present AND NOT fee_exempt)
    let attendanceCounts: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("student_id")
        .in("session_id", sessionIds)
        .eq("present", true)
        .eq("fee_exempt", false);

      (attendanceData ?? []).forEach((a) => {
        attendanceCounts[a.student_id] = (attendanceCounts[a.student_id] ?? 0) + 1;
      });
    }

    // Sum payments per student
    const paymentSums: Record<string, number> = {};
    (paymentsRes.data ?? []).forEach((p) => {
      paymentSums[p.student_id] = (paymentSums[p.student_id] ?? 0) + Number(p.amount);
    });

    const rows: FeeRow[] = students
      .filter((s) => s.active !== false)
      .map((student) => {
        const sessionsAttended = attendanceCounts[student.id] ?? 0;
        const amountDue = sessionsAttended * APP_CONFIG.feePerSession;
        const totalPaid = paymentSums[student.id] ?? 0;
        const balance = totalPaid - amountDue;

        return { student, sessionsAttended, amountDue, totalPaid, balance };
      });

    // Sort by school_class (nulls last), then by student name
    rows.sort((a, b) => {
      const classA = a.student.school_class || "\uffff";
      const classB = b.student.school_class || "\uffff";
      const classCompare = classA.localeCompare(classB, "zh");
      if (classCompare !== 0) return classCompare;
      return a.student.name.localeCompare(b.student.name, "zh");
    });

    setFeeData(rows);

    // Compute historical arrears (net unpaid balance from BEFORE the selected month)
    const priorSessionsRes = await supabase
      .from("class_sessions")
      .select("id")
      .lt("session_date", startDate);
    const priorSessionIds = (priorSessionsRes.data ?? []).map((s) => s.id);

    const dueByStudent: Record<string, number> = {};
    if (priorSessionIds.length > 0) {
      const { data: priorAtt } = await supabase
        .from("attendance")
        .select("student_id")
        .eq("present", true)
        .eq("fee_exempt", false)
        .in("session_id", priorSessionIds);
      (priorAtt ?? []).forEach((a) => {
        dueByStudent[a.student_id] =
          (dueByStudent[a.student_id] ?? 0) + APP_CONFIG.feePerSession;
      });
    }

    // Prior payments: (year < selectedYear) OR (year = selectedYear AND month < month)
    const { data: priorPayData } = await supabase
      .from("payments")
      .select("student_id, amount, year, month")
      .eq("voided", false)
      .or(
        `year.lt.${selectedYear},and(year.eq.${selectedYear},month.lt.${month})`
      );

    const paidByStudent: Record<string, number> = {};
    (priorPayData ?? []).forEach((p) => {
      paidByStudent[p.student_id] =
        (paidByStudent[p.student_id] ?? 0) + Number(p.amount);
    });

    const studentById = new Map<string, Student>(students.map((s) => [s.id, s]));
    const arrearsList: ArrearsEntry[] = [];
    const seen = new Set<string>([
      ...Object.keys(dueByStudent),
      ...Object.keys(paidByStudent),
    ]);
    seen.forEach((sid) => {
      const st = studentById.get(sid);
      if (!st || st.active === false) return;
      const due = dueByStudent[sid] ?? 0;
      const paid = paidByStudent[sid] ?? 0;
      const balance = paid - due; // negative = owes
      if (balance < -0.009) {
        arrearsList.push({ student: st, amount: Math.abs(balance) });
      }
    });
    arrearsList.sort((a, b) => {
      const classA = a.student.school_class || "\uffff";
      const classB = b.student.school_class || "\uffff";
      const c = classA.localeCompare(classB, "zh");
      if (c !== 0) return c;
      return a.student.name.localeCompare(b.student.name, "zh");
    });
    setArrears(arrearsList);

    setLoading(false);
  }, [supabase, selectedMonth, selectedYear]);

  const fetchCoaches = useCallback(async () => {
    const { data } = await supabase
      .from("coaches")
      .select("*")
      .eq("active", true)
      .order("name");
    setCoaches(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchFees();
    fetchCoaches();
  }, [fetchFees, fetchCoaches]);

  async function openPaymentDialog(student: Student, suggestedAmount: number) {
    setPaymentStudent(student);
    setPaymentNotes("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentCoachId("");
    setAllocations([
      {
        month: selectedMonth + 1,
        year: selectedYear,
        amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
      },
    ]);
    setShowPayment(true);
    setStudentOwingByKey({});
    setLoadingOwing(true);

    // Fetch owing per month for this student (current year) so allocation rows can
    // show "欠 RM X" hints next to the month picker.
    const owing = await computeStudentOwing(student.id, selectedYear);
    setStudentOwingByKey(owing);
    setLoadingOwing(false);
  }

  async function computeStudentOwing(
    studentId: string,
    year: number
  ): Promise<Record<string, number>> {
    const [sessionsRes, paymentsRes] = await Promise.all([
      supabase
        .from("class_sessions")
        .select("id, session_date")
        .gte("session_date", `${year}-01-01`)
        .lt("session_date", `${year + 1}-01-01`),
      supabase
        .from("payments")
        .select("month, amount")
        .eq("student_id", studentId)
        .eq("year", year)
        .eq("voided", false),
    ]);

    const sessionMonth = new Map<string, number>();
    (sessionsRes.data ?? []).forEach((s) => {
      sessionMonth.set(s.id, new Date(s.session_date).getMonth() + 1);
    });

    const sessionIds = Array.from(sessionMonth.keys());
    let attendanceRows: { session_id: string }[] = [];
    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from("attendance")
        .select("session_id")
        .eq("student_id", studentId)
        .eq("present", true)
        .eq("fee_exempt", false)
        .in("session_id", sessionIds);
      attendanceRows = data ?? [];
    }

    const dueByMonth: Record<number, number> = {};
    attendanceRows.forEach((a) => {
      const m = sessionMonth.get(a.session_id);
      if (m) dueByMonth[m] = (dueByMonth[m] ?? 0) + APP_CONFIG.feePerSession;
    });

    const paidByMonth: Record<number, number> = {};
    (paymentsRes.data ?? []).forEach((p) => {
      paidByMonth[p.month] = (paidByMonth[p.month] ?? 0) + Number(p.amount);
    });

    const result: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const due = dueByMonth[m] ?? 0;
      const paid = paidByMonth[m] ?? 0;
      // balance: negative = owes, positive = overpaid, 0 = settled
      result[`${year}-${m}`] = paid - due;
    }
    return result;
  }

  function addAllocationRow() {
    // Default new row to the earliest still-owed month not already in allocations
    const used = new Set(allocations.map((a) => `${a.year}-${a.month}`));
    let defaultMonth = selectedMonth + 1;
    let defaultYear = selectedYear;
    for (let m = 1; m <= 12; m++) {
      const key = `${selectedYear}-${m}`;
      if (!used.has(key) && (studentOwingByKey[key] ?? 0) < 0) {
        defaultMonth = m;
        defaultYear = selectedYear;
        break;
      }
    }
    setAllocations((prev) => [
      ...prev,
      { month: defaultMonth, year: defaultYear, amount: "" },
    ]);
  }

  function updateAllocation(idx: number, patch: Partial<Allocation>) {
    setAllocations((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    );
  }

  function removeAllocation(idx: number) {
    setAllocations((prev) => prev.filter((_, i) => i !== idx));
  }

  const allocationsTotal = allocations.reduce((s, a) => {
    const n = parseFloat(a.amount);
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  const allocationsValid =
    allocations.length > 0 &&
    allocations.every((a) => {
      const n = parseFloat(a.amount);
      return !isNaN(n) && n > 0 && a.month >= 1 && a.month <= 12 && a.year > 0;
    }) &&
    // no duplicate (year, month) combos
    new Set(allocations.map((a) => `${a.year}-${a.month}`)).size ===
      allocations.length;

  function getOwingHint(month: number, year: number): string | null {
    if (year !== selectedYear) return null; // owing only prefetched for selectedYear
    const bal = studentOwingByKey[`${year}-${month}`];
    if (bal === undefined) return null;
    if (bal < 0) return `欠 ${APP_CONFIG.currency}${Math.abs(bal).toFixed(2)}`;
    if (bal > 0) return `多缴 ${APP_CONFIG.currency}${bal.toFixed(2)}`;
    return "已结清";
  }

  async function handleRecordPayment() {
    if (!paymentStudent || !allocationsValid) return;

    setSavingPayment(true);

    const baseRow = {
      student_id: paymentStudent.id,
      payment_date: paymentDate,
      notes: paymentNotes.trim() || null,
      coach_id: paymentCoachId && paymentCoachId !== "none" ? paymentCoachId : null,
    };

    // Step 1: Insert the first payment row (no receipt_id yet)
    const first = allocations[0];
    const firstAmount = parseFloat(first.amount);
    const { data: firstPayment, error: firstErr } = await supabase
      .from("payments")
      .insert({
        ...baseRow,
        amount: firstAmount,
        month: first.month,
        year: first.year,
      })
      .select()
      .single();

    if (firstErr || !firstPayment) {
      toast.error("记录付款失败");
      setSavingPayment(false);
      return;
    }

    // Step 2: Generate receipt_number scoped to payment_date's month, with retry on race
    const payDate = parseISO(paymentDate);
    const receiptYear = payDate.getFullYear();
    const receiptMonth = payDate.getMonth() + 1;
    const monthStr = String(receiptMonth).padStart(2, "0");

    let receiptId = "";
    let receiptNumber = "";
    let receiptOk = false;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data: lastReceipt } = await supabase
        .from("receipts")
        .select("receipt_number")
        .like(
          "receipt_number",
          `${APP_CONFIG.receiptPrefix}-${receiptYear}-${monthStr}-%`
        )
        .order("receipt_number", { ascending: false })
        .limit(1)
        .single();

      let nextNum = 1;
      if (lastReceipt?.receipt_number) {
        const parts = lastReceipt.receipt_number.split("-");
        nextNum = parseInt(parts[parts.length - 1]) + 1;
      }

      receiptNumber = `${APP_CONFIG.receiptPrefix}-${receiptYear}-${monthStr}-${String(nextNum).padStart(3, "0")}`;

      const { data: receiptData, error: receiptError } = await supabase
        .from("receipts")
        .insert({
          payment_id: firstPayment.id,
          receipt_number: receiptNumber,
        })
        .select()
        .single();

      if (!receiptError && receiptData) {
        receiptOk = true;
        receiptId = receiptData.id;
        break;
      }

      if (receiptError?.code === "23505" && attempt < maxRetries - 1) {
        continue;
      }
      break;
    }

    if (!receiptOk) {
      // Rollback first payment
      await supabase.from("payments").delete().eq("id", firstPayment.id);
      toast.error("生成收据失败，付款已取消");
      setSavingPayment(false);
      return;
    }

    // Step 3: Link first payment to receipt
    await supabase
      .from("payments")
      .update({ receipt_id: receiptId })
      .eq("id", firstPayment.id);

    // Step 4: Insert remaining allocations sharing the same receipt
    if (allocations.length > 1) {
      const remaining = allocations.slice(1).map((a) => ({
        ...baseRow,
        amount: parseFloat(a.amount),
        month: a.month,
        year: a.year,
        receipt_id: receiptId,
      }));
      const { error: restErr } = await supabase.from("payments").insert(remaining);
      if (restErr) {
        // Rollback: delete receipt (SET NULL cascades receipt_id on remaining), then delete all siblings + first
        await supabase.from("receipts").delete().eq("id", receiptId);
        await supabase.from("payments").delete().eq("id", firstPayment.id);
        toast.error("分配记录失败，付款已取消");
        setSavingPayment(false);
        return;
      }
    }

    toast.success(
      `已记录付款 ${APP_CONFIG.currency}${allocationsTotal.toFixed(2)}。收据: ${receiptNumber}`
    );
    setSavingPayment(false);
    setShowPayment(false);
    fetchFees();
  }

  async function openRefundDialog(student: Student) {
    setRefundStudent(student);
    setRefundAmount("");
    setRefundNotes("");
    setRefundDate(new Date().toISOString().split("T")[0]);
    setRefundCoachId("");
    setRefundCalc(null);
    setRefundPeriodType("year");
    setShowRefund(true);
    setLoadingRefundCalc(true);

    await calculateRefund(student, "year");
  }

  async function calculateRefund(student: Student, periodType: "month" | "year") {
    setLoadingRefundCalc(true);

    // Get date range for the period
    let startDate: string;
    let endDate: string;
    const year = selectedYear;

    if (periodType === "month") {
      const month = selectedMonth + 1;
      const monthStr = String(month).padStart(2, "0");
      startDate = `${year}-${monthStr}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
    } else {
      startDate = `${year}-01-01`;
      endDate = `${year + 1}-01-01`;
    }

    // Query payments, sessions, attendance, existing refunds in parallel
    const [paymentsRes, sessionsRes, refundsRes] = await Promise.all([
      // Total payments in period
      periodType === "month"
        ? supabase
            .from("payments")
            .select("amount")
            .eq("student_id", student.id)
            .eq("month", selectedMonth + 1)
            .eq("year", year)
            .eq("voided", false)
        : supabase
            .from("payments")
            .select("amount")
            .eq("student_id", student.id)
            .eq("year", year)
            .eq("voided", false),
      // Sessions in period
      supabase
        .from("class_sessions")
        .select("id")
        .gte("session_date", startDate)
        .lt("session_date", endDate),
      // Existing refunds in period
      periodType === "month"
        ? supabase
            .from("refunds")
            .select("amount")
            .eq("student_id", student.id)
            .eq("year", year)
            .eq("month", selectedMonth + 1)
            .eq("voided", false)
        : supabase
            .from("refunds")
            .select("amount")
            .eq("student_id", student.id)
            .eq("year", year)
            .is("month", null)
            .eq("voided", false),
    ]);

    const totalPaid = (paymentsRes.data ?? []).reduce(
      (s, p) => s + Number(p.amount),
      0
    );

    const sessionIds = (sessionsRes.data ?? []).map((s) => s.id);
    let totalSessions = 0;
    if (sessionIds.length > 0) {
      const { count } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .in("session_id", sessionIds)
        .eq("present", true)
        .eq("fee_exempt", false);
      totalSessions = count ?? 0;
    }

    const totalDue = totalSessions * APP_CONFIG.feePerSession;
    const existingRefunds = (refundsRes.data ?? []).reduce(
      (s, r) => s + Number(r.amount),
      0
    );
    const refundable = Math.max(0, totalPaid - totalDue - existingRefunds);

    const calc: RefundCalc = {
      totalPaid,
      totalSessions,
      totalDue,
      existingRefunds,
      refundable,
    };

    setRefundCalc(calc);
    setRefundAmount(refundable > 0 ? refundable.toFixed(2) : "");
    setLoadingRefundCalc(false);
  }

  async function handleRecordRefund() {
    if (!refundStudent || !refundAmount || !refundCalc) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("请输入有效金额");
      return;
    }

    if (amount > refundCalc.refundable) {
      toast.error("退费金额超过可退金额");
      return;
    }

    setSavingRefund(true);

    // Insert refund
    const { data: refundData, error: refundError } = await supabase
      .from("refunds")
      .insert({
        student_id: refundStudent.id,
        amount,
        refund_date: refundDate,
        year: selectedYear,
        month: refundPeriodType === "month" ? selectedMonth + 1 : null,
        total_paid: refundCalc.totalPaid,
        total_sessions: refundCalc.totalSessions,
        total_due: refundCalc.totalDue,
        notes: refundNotes.trim() || null,
        coach_id: refundCoachId && refundCoachId !== "none" ? refundCoachId : null,
      })
      .select()
      .single();

    if (refundError) {
      toast.error("记录退费失败");
      setSavingRefund(false);
      return;
    }

    // Auto-generate credit note with retry on conflict
    let creditNoteNumber = "";
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data: lastNote } = await supabase
        .from("credit_notes")
        .select("credit_note_number")
        .like(
          "credit_note_number",
          `${APP_CONFIG.creditNotePrefix}-${selectedYear}-%`
        )
        .order("credit_note_number", { ascending: false })
        .limit(1)
        .single();

      let nextNum = 1;
      if (lastNote?.credit_note_number) {
        const parts = lastNote.credit_note_number.split("-");
        nextNum = parseInt(parts[parts.length - 1]) + 1;
      }

      creditNoteNumber = `${APP_CONFIG.creditNotePrefix}-${selectedYear}-${String(nextNum).padStart(3, "0")}`;

      const { error: cnError } = await supabase.from("credit_notes").insert({
        refund_id: refundData.id,
        credit_note_number: creditNoteNumber,
      });

      if (!cnError) break;

      if (cnError.code === "23505" && attempt < maxRetries - 1) {
        continue;
      }

      toast.error("生成退费单失败，但退费已记录");
      setSavingRefund(false);
      setShowRefund(false);
      fetchFees();
      return;
    }

    toast.success(
      `已记录退费 ${APP_CONFIG.currency}${amount.toFixed(2)}。退费单: ${creditNoteNumber}`
    );
    setSavingRefund(false);
    setShowRefund(false);
    fetchFees();
  }

  async function openHistory(student: Student) {
    setHistoryStudent(student);
    setShowHistory(true);
    setLoadingHistory(true);

    const month = selectedMonth + 1;
    const [paymentsData, refundsData] = await Promise.all([
      supabase
        .from("payments")
        .select(
          "*, receipt:receipts!payments_receipt_id_fkey(id, receipt_number, voided), coach:coaches(name)"
        )
        .eq("student_id", student.id)
        .eq("month", month)
        .eq("year", selectedYear)
        .order("payment_date", { ascending: false }),
      supabase
        .from("refunds")
        .select("*, credit_notes(credit_note_number, voided), coach:coaches(name)")
        .eq("student_id", student.id)
        .eq("year", selectedYear)
        .order("refund_date", { ascending: false }),
    ]);

    setHistoryPayments(paymentsData.data ?? []);
    // Filter refunds: show if month matches or full-year refund
    const allRefunds = (refundsData.data ?? []) as HistoryRefund[];
    setHistoryRefunds(
      allRefunds.filter((r) => r.month === month || r.month === null)
    );
    setLoadingHistory(false);
  }

  function openVoidDialog(paymentId: string) {
    setVoidPaymentId(paymentId);
    setVoidReason("");
    setShowVoid(true);
  }

  async function handleVoidPayment() {
    if (!voidPaymentId) return;
    setVoidingPayment(true);

    // Look up the payment's receipt to decide scope: void at receipt level
    // (so all sibling payment rows sharing the same receipt are voided together).
    const { data: pay } = await supabase
      .from("payments")
      .select("receipt_id")
      .eq("id", voidPaymentId)
      .single();

    const voidPayload = {
      voided: true,
      voided_at: new Date().toISOString(),
      voided_reason: voidReason.trim() || null,
    };

    if (pay?.receipt_id) {
      // New model: void all payments sharing this receipt + the receipt itself
      const [{ error: payErr }, { error: recErr }] = await Promise.all([
        supabase
          .from("payments")
          .update(voidPayload)
          .eq("receipt_id", pay.receipt_id),
        supabase
          .from("receipts")
          .update({ voided: true })
          .eq("id", pay.receipt_id),
      ]);
      if (payErr || recErr) {
        toast.error("撤回付款失败");
        setVoidingPayment(false);
        return;
      }
    } else {
      // Legacy fallback (payment without receipt_id)
      const { error: payError } = await supabase
        .from("payments")
        .update(voidPayload)
        .eq("id", voidPaymentId);
      if (payError) {
        toast.error("撤回付款失败");
        setVoidingPayment(false);
        return;
      }
      await supabase
        .from("receipts")
        .update({ voided: true })
        .eq("payment_id", voidPaymentId);
    }

    toast.success("付款已撤回");
    setVoidingPayment(false);
    setShowVoid(false);

    if (historyStudent) {
      openHistory(historyStudent);
    }
    fetchFees();
  }

  async function handleDeletePayment(paymentId: string) {
    setDeletingPaymentId(paymentId);
    setConfirmDeletePaymentId(null);

    // Look up the payment's receipt to decide scope
    const { data: pay } = await supabase
      .from("payments")
      .select("receipt_id")
      .eq("id", paymentId)
      .single();

    if (pay?.receipt_id) {
      // Collect sibling payment ids BEFORE deleting the receipt (receipts.id FK
      // sets payments.receipt_id to NULL on delete, so we'd lose the link).
      const { data: siblings } = await supabase
        .from("payments")
        .select("id")
        .eq("receipt_id", pay.receipt_id);
      const siblingIds = (siblings ?? []).map((s) => s.id);

      // Delete receipt first (FK from receipts.payment_id forces this order)
      const { error: recErr } = await supabase
        .from("receipts")
        .delete()
        .eq("id", pay.receipt_id);
      if (recErr) {
        toast.error("删除收据失败");
        setDeletingPaymentId(null);
        return;
      }

      if (siblingIds.length > 0) {
        const { error: payErr } = await supabase
          .from("payments")
          .delete()
          .in("id", siblingIds);
        if (payErr) {
          toast.error("删除付款记录失败（收据已删除，请联系管理员）");
          setDeletingPaymentId(null);
          return;
        }
      }
    } else {
      // Legacy fallback
      const { error: receiptErr } = await supabase
        .from("receipts")
        .delete()
        .eq("payment_id", paymentId);
      if (receiptErr) {
        toast.error("删除收据失败");
        setDeletingPaymentId(null);
        return;
      }

      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId);
      if (error) {
        toast.error("删除付款记录失败（收据已删除，请联系管理员）");
        setDeletingPaymentId(null);
        return;
      }
    }

    toast.success("已删除撤回的付款记录");
    setDeletingPaymentId(null);

    if (historyStudent) {
      openHistory(historyStudent);
    }
    fetchFees();
  }

  // ── Refund void/delete handlers ─────────────────────────

  function openVoidRefundDialog(refundId: string) {
    setVoidRefundId(refundId);
    setVoidRefundReason("");
    setShowVoidRefund(true);
  }

  async function handleVoidRefund() {
    if (!voidRefundId) return;
    setVoidingRefund(true);

    const { error: refErr } = await supabase
      .from("refunds")
      .update({
        voided: true,
        voided_at: new Date().toISOString(),
        voided_reason: voidRefundReason.trim() || null,
      })
      .eq("id", voidRefundId);

    if (refErr) {
      toast.error("撤回退费失败");
      setVoidingRefund(false);
      return;
    }

    await supabase
      .from("credit_notes")
      .update({ voided: true })
      .eq("refund_id", voidRefundId);

    toast.success("退费已撤回");
    setVoidingRefund(false);
    setShowVoidRefund(false);

    if (historyStudent) openHistory(historyStudent);
    fetchFees();
  }

  async function handleDeleteRefund(refundId: string) {
    setDeletingRefundId(refundId);
    setConfirmDeleteRefundId(null);

    const { error: cnErr } = await supabase
      .from("credit_notes")
      .delete()
      .eq("refund_id", refundId);
    if (cnErr) {
      toast.error("删除退费单失败");
      setDeletingRefundId(null);
      return;
    }

    const { error } = await supabase
      .from("refunds")
      .delete()
      .eq("id", refundId);
    if (error) {
      toast.error("删除退费记录失败");
      setDeletingRefundId(null);
      return;
    }

    toast.success("已删除撤回的退费记录");
    setDeletingRefundId(null);

    if (historyStudent) openHistory(historyStudent);
    fetchFees();
  }

  // Group fee data by class for rendering
  const groupedFeeData = useMemo(() => {
    const groups: { className: string; rows: FeeRow[] }[] = [];
    let currentClass: string | null = null;

    feeData.forEach((row) => {
      const cls = row.student.school_class || "未分班";
      if (cls !== currentClass) {
        currentClass = cls;
        groups.push({ className: cls, rows: [] });
      }
      groups[groups.length - 1].rows.push(row);
    });

    return groups;
  }, [feeData]);

  const totalDue = feeData.reduce((s, r) => s + r.amountDue, 0);
  const totalPaid = feeData.reduce((s, r) => s + r.totalPaid, 0);
  const totalBalance = totalPaid - totalDue;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">费用</h1>

      <div className="flex gap-3 mb-6">
        <Select
          value={String(selectedMonth)}
          onValueChange={(v) => setSelectedMonth(Number(v))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((month, idx) => (
              <SelectItem key={idx} value={String(idx)}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={2024}
          max={2030}
          value={selectedYear}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val >= 2024 && val <= 2030) setSelectedYear(val);
          }}
          className="w-[100px]"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">应缴总额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{APP_CONFIG.currency} {totalDue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">已收总额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{APP_CONFIG.currency} {totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? "text-success" : "text-destructive"}`}>
              {APP_CONFIG.currency} {totalBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalBalance > 0 ? "多缴" : totalBalance < 0 ? "未缴" : "已结清"}
            </p>
          </CardContent>
        </Card>
      </div>

      {arrears.length > 0 && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                历史欠费结转 / Tunggakan Dari Bulan Lepas
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                截至 {selectedYear}年{selectedMonth + 1}月 前尚未结清
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">合计</div>
              <div className="font-bold tabular-nums text-destructive">
                {APP_CONFIG.currency}{" "}
                {arrears.reduce((s, a) => s + a.amount, 0).toFixed(2)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {arrears.map((a) => (
                <button
                  key={a.student.id}
                  type="button"
                  onClick={() => openHistory(a.student)}
                  className="inline-flex items-center gap-2 text-xs rounded-full border border-destructive/30 bg-background px-3 py-1 hover:bg-destructive/10 transition-colors"
                >
                  <span className="font-medium">{a.student.name}</span>
                  <span className="text-destructive tabular-nums">
                    {APP_CONFIG.currency} {a.amount.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>学生</TableHead>
                <TableHead className="text-center">收费课次</TableHead>
                <TableHead className="text-right">应缴</TableHead>
                <TableHead className="text-right">已缴</TableHead>
                <TableHead className="text-right">余额</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : feeData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                groupedFeeData.map((group) => (
                  <FeeGroupRows
                    key={group.className}
                    group={group}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onOpenHistory={openHistory}
                    onOpenPayment={openPaymentDialog}
                    onOpenRefund={openRefundDialog}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mt-2">
        费率: {APP_CONFIG.currency}{APP_CONFIG.feePerSession} / 课
      </p>

      {/* Payment history dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              付款记录 — {historyStudent?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedYear}年{selectedMonth + 1}月
          </p>
          {loadingHistory ? (
            <p className="text-muted-foreground py-4">加载中...</p>
          ) : historyPayments.length === 0 && historyRefunds.length === 0 ? (
            <p className="text-muted-foreground py-4">暂无记录</p>
          ) : (
            <div className="space-y-3">
              {/* Payments */}
              {historyPayments.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    付款
                  </p>
                  {historyPayments.map((payment) => {
                    const receipt = payment.receipt;
                    return (
                      <div
                        key={payment.id}
                        className={`border rounded-lg p-3 ${
                          payment.voided ? "text-muted-foreground" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${payment.voided ? "line-through" : ""}`}>
                            {APP_CONFIG.currency} {Number(payment.amount).toFixed(2)}
                          </span>
                          {payment.voided ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">已撤回</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                title="删除"
                                disabled={deletingPaymentId === payment.id}
                                onClick={() => setConfirmDeletePaymentId(payment.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs text-destructive"
                              onClick={() => openVoidDialog(payment.id)}
                            >
                              撤回
                            </Button>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {format(parseISO(payment.payment_date), "dd/MM/yyyy")}
                          {payment.coach?.name && (
                            <span className="ml-2">教练: {payment.coach.name}</span>
                          )}
                          {receipt && (
                            <span className="ml-2">
                              收据: {receipt.receipt_number}
                            </span>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="text-sm mt-1">{payment.notes}</p>
                        )}
                        {payment.voided && payment.voided_reason && (
                          <p className="text-sm text-destructive mt-1">
                            撤回原因: {payment.voided_reason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {/* Refunds */}
              {historyRefunds.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4">
                    退费
                  </p>
                  {historyRefunds.map((refund) => {
                    const cn = refund.credit_notes?.[0];
                    const periodLabel = refund.month
                      ? `${refund.month}/${refund.year}`
                      : `${refund.year}年全年`;
                    return (
                      <div
                        key={refund.id}
                        className={`border rounded-lg p-3 border-info/30 ${
                          refund.voided ? "text-muted-foreground" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-info/10 text-info">
                              退费
                            </Badge>
                            <span className={`font-medium ${refund.voided ? "line-through" : ""}`}>
                              {APP_CONFIG.currency} {Number(refund.amount).toFixed(2)}
                            </span>
                          </div>
                          {refund.voided ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">已撤回</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive"
                                title="删除"
                                disabled={deletingRefundId === refund.id}
                                onClick={() => setConfirmDeleteRefundId(refund.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs text-destructive"
                              onClick={() => openVoidRefundDialog(refund.id)}
                            >
                              撤回
                            </Button>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {format(parseISO(refund.refund_date), "dd/MM/yyyy")}
                          {refund.coach?.name && (
                            <span className="ml-2">教练: {refund.coach.name}</span>
                          )}
                          <span className="ml-2">期间: {periodLabel}</span>
                          {cn && (
                            <span className="ml-2">
                              退费单: {cn.credit_note_number}
                            </span>
                          )}
                        </div>
                        {refund.notes && (
                          <p className="text-sm mt-1">{refund.notes}</p>
                        )}
                        {refund.voided && refund.voided_reason && (
                          <p className="text-sm text-destructive mt-1">
                            撤回原因: {refund.voided_reason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void payment dialog */}
      <Dialog open={showVoid} onOpenChange={setShowVoid}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>撤回付款</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="void-reason">撤回原因（可选）</Label>
              <Textarea
                id="void-reason"
                placeholder="例：金额错误, 重复记录等"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowVoid(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleVoidPayment}
                disabled={voidingPayment}
              >
                {voidingPayment ? "撤回中..." : "确认撤回"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!confirmDeletePaymentId}
        onOpenChange={(open) => !open && setConfirmDeletePaymentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要永久删除此撤回的付款记录及其收据吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeletePaymentId && handleDeletePayment(confirmDeletePaymentId)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refund dialog */}
      <Dialog open={showRefund} onOpenChange={setShowRefund}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              退费 — {refundStudent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>退费范围</Label>
              <Select
                value={refundPeriodType}
                onValueChange={(v) => {
                  const pt = v as "month" | "year";
                  setRefundPeriodType(pt);
                  if (refundStudent) calculateRefund(refundStudent, pt);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">{selectedYear}年（全年）</SelectItem>
                  <SelectItem value="month">
                    {selectedYear}年{selectedMonth + 1}月
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingRefundCalc ? (
              <p className="text-muted-foreground text-sm py-2">计算中...</p>
            ) : refundCalc ? (
              <div className="border rounded-lg p-3 bg-muted/50 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">已付总额:</span>
                  <span>{APP_CONFIG.currency} {refundCalc.totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">收费课次:</span>
                  <span>{refundCalc.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">应缴费用:</span>
                  <span>{APP_CONFIG.currency} {refundCalc.totalDue.toFixed(2)}</span>
                </div>
                {refundCalc.existingRefunds > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">已退费:</span>
                    <span>{APP_CONFIG.currency} {refundCalc.existingRefunds.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>可退金额:</span>
                  <span className="text-info">
                    {APP_CONFIG.currency} {refundCalc.refundable.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="refund-amount">退费金额 ({APP_CONFIG.currency})</Label>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0"
                max={refundCalc?.refundable}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-date">退费日期</Label>
              <Input
                id="refund-date"
                type="date"
                value={refundDate}
                onChange={(e) => setRefundDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-notes">备注</Label>
              <Textarea
                id="refund-notes"
                placeholder="例如: 年终退费, 未出席退款等"
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
              />
            </div>
            {coaches.length > 0 && (
              <div className="space-y-2">
                <Label>负责教练</Label>
                <Select value={refundCoachId} onValueChange={setRefundCoachId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择教练（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不选择</SelectItem>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRefund(false)}>
                取消
              </Button>
              <Button
                onClick={handleRecordRefund}
                disabled={
                  savingRefund ||
                  loadingRefundCalc ||
                  !refundCalc ||
                  refundCalc.refundable <= 0
                }
              >
                {savingRefund ? "保存中..." : "确认退费"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Void refund dialog */}
      <Dialog open={showVoidRefund} onOpenChange={setShowVoidRefund}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>撤回退费</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="void-refund-reason">撤回原因（可选）</Label>
              <Textarea
                id="void-refund-reason"
                placeholder="例：金额错误, 重复记录等"
                value={voidRefundReason}
                onChange={(e) => setVoidRefundReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowVoidRefund(false)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={handleVoidRefund}
                disabled={voidingRefund}
              >
                {voidingRefund ? "撤回中..." : "确认撤回"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete refund confirmation */}
      <AlertDialog
        open={!!confirmDeleteRefundId}
        onOpenChange={(open) => !open && setConfirmDeleteRefundId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要永久删除此撤回的退费记录及其退费单吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                confirmDeleteRefundId &&
                handleDeleteRefund(confirmDeleteRefundId)
              }
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment dialog — supports multi-month allocation (one receipt, N rows) */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>记录付款 — {paymentStudent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pay-date">付款日期</Label>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            {/* Allocation rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>分配到月份</Label>
                {loadingOwing && (
                  <span className="text-xs text-muted-foreground">计算欠费中...</span>
                )}
              </div>
              <div className="space-y-2">
                {allocations.map((alloc, idx) => {
                  const hint = getOwingHint(alloc.month, alloc.year);
                  const dupKey = `${alloc.year}-${alloc.month}`;
                  const isDup =
                    allocations.filter((a) => `${a.year}-${a.month}` === dupKey)
                      .length > 1;
                  return (
                    <div
                      key={idx}
                      className="border rounded-md p-2 space-y-1.5 bg-muted/30"
                    >
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">月份</Label>
                          <Select
                            value={String(alloc.month)}
                            onValueChange={(v) =>
                              updateAllocation(idx, { month: Number(v) })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTHS.map((m, i) => (
                                <SelectItem key={i} value={String(i + 1)}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-[80px]">
                          <Label className="text-xs text-muted-foreground">年份</Label>
                          <Input
                            type="number"
                            min={2024}
                            max={2030}
                            value={alloc.year}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (!isNaN(v))
                                updateAllocation(idx, { year: v });
                            }}
                            className="h-9"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">
                            金额
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={alloc.amount}
                            onChange={(e) =>
                              updateAllocation(idx, { amount: e.target.value })
                            }
                            className="h-9"
                          />
                        </div>
                        {allocations.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => removeAllocation(idx)}
                            aria-label="删除此行"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {hint ?? ""}
                        </span>
                        {isDup && (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            月份重复
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAllocationRow}
                className="w-full"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                另一个月
              </Button>
            </div>

            <div className="flex justify-between items-center border-t pt-3 font-medium">
              <span>合计</span>
              <span className="tabular-nums">
                {APP_CONFIG.currency} {allocationsTotal.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pay-notes">备注</Label>
              <Textarea
                id="pay-notes"
                placeholder="例如: 现金支付, 预付等"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
            {coaches.length > 0 && (
              <div className="space-y-2">
                <Label>负责教练</Label>
                <Select value={paymentCoachId} onValueChange={setPaymentCoachId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择教练（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不选择</SelectItem>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPayment(false)}>
                取消
              </Button>
              <Button
                onClick={handleRecordPayment}
                disabled={savingPayment || !allocationsValid}
              >
                {savingPayment ? "保存中..." : "记录付款"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Fee group rows component ─────────────────────────────

function FeeGroupRows({
  group,
  selectedMonth,
  selectedYear,
  onOpenHistory,
  onOpenPayment,
  onOpenRefund,
}: {
  group: { className: string; rows: FeeRow[] };
  selectedMonth: number;
  selectedYear: number;
  onOpenHistory: (student: Student) => void;
  onOpenPayment: (student: Student, suggestedAmount: number) => void;
  onOpenRefund: (student: Student) => void;
}) {
  return (
    <>
      {/* Group header */}
      <TableRow className="bg-muted/50">
        <TableCell colSpan={6} className="py-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {group.className}（{group.rows.length}人）
          </span>
        </TableCell>
      </TableRow>

      {/* Fee rows */}
      {group.rows.map((row) => (
        <TableRow key={row.student.id}>
          <TableCell>
            <span className="font-medium">{row.student.name}</span>
          </TableCell>
          <TableCell className="text-center">
            {row.sessionsAttended}
          </TableCell>
          <TableCell className="text-right">
            {APP_CONFIG.currency} {row.amountDue.toFixed(2)}
          </TableCell>
          <TableCell className="text-right">
            {APP_CONFIG.currency} {row.totalPaid.toFixed(2)}
          </TableCell>
          <TableCell className="text-right">
            <span
              className={
                row.balance > 0
                  ? "text-success"
                  : row.balance < 0
                  ? "text-destructive"
                  : ""
              }
            >
              {APP_CONFIG.currency} {row.balance.toFixed(2)}
            </span>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="付款记录"
                onClick={() => onOpenHistory(row.student)}
              >
                <History className="h-4 w-4" />
              </Button>
              {row.balance < 0 && row.student.phone && (
                <div className="flex items-center gap-0.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 h-4 text-muted-foreground"
                  >
                    {getLanguageLabel(row.student.preferred_language)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    title="发送WhatsApp付费提醒"
                  >
                    <a
                      href={getWhatsAppUrl(
                        row.student,
                        Math.abs(row.balance),
                        selectedMonth + 1,
                        selectedYear
                      )!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4 text-success" />
                    </a>
                  </Button>
                </div>
              )}
              {row.balance > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-info border-info/30"
                  onClick={() => onOpenRefund(row.student)}
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  退费
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onOpenPayment(
                    row.student,
                    row.balance < 0 ? Math.abs(row.balance) : 0
                  )
                }
              >
                <DollarSign className="h-4 w-4 mr-1" />
                付款
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
