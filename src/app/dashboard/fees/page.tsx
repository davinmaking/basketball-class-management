"use client";

import { useEffect, useState, useCallback } from "react";
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
import { DollarSign, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const FEE_PER_SESSION = 5; // RM5

const MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

type Student = Tables<"students">;

interface FeeRow {
  student: Student;
  sessionsAttended: number;
  amountDue: number;
  totalPaid: number;
  balance: number;
}

export default function FeesPage() {
  const [feeData, setFeeData] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [savingPayment, setSavingPayment] = useState(false);

  const supabase = createClient();
  const router = useRouter();

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
        .eq("year", selectedYear),
    ]);

    const students = studentsRes.data ?? [];
    const sessionIds = (sessionsRes.data ?? []).map((s) => s.id);

    // Get attendance for this month's sessions
    let attendanceCounts: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("student_id")
        .in("session_id", sessionIds)
        .eq("present", true);

      (attendanceData ?? []).forEach((a) => {
        attendanceCounts[a.student_id] = (attendanceCounts[a.student_id] ?? 0) + 1;
      });
    }

    // Sum payments per student
    const paymentSums: Record<string, number> = {};
    (paymentsRes.data ?? []).forEach((p) => {
      paymentSums[p.student_id] = (paymentSums[p.student_id] ?? 0) + Number(p.amount);
    });

    const rows: FeeRow[] = students.map((student) => {
      const sessionsAttended = attendanceCounts[student.id] ?? 0;
      const amountDue = student.fee_exempt ? 0 : sessionsAttended * FEE_PER_SESSION;
      const totalPaid = paymentSums[student.id] ?? 0;
      const balance = totalPaid - amountDue;

      return { student, sessionsAttended, amountDue, totalPaid, balance };
    });

    setFeeData(rows);
    setLoading(false);
  }, [supabase, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  function openPaymentDialog(student: Student, suggestedAmount: number) {
    setPaymentStudent(student);
    setPaymentAmount(suggestedAmount > 0 ? String(suggestedAmount) : "");
    setPaymentNotes("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setShowPayment(true);
  }

  async function handleRecordPayment() {
    if (!paymentStudent || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Sila masukkan jumlah yang sah");
      return;
    }

    setSavingPayment(true);
    const month = selectedMonth + 1;

    // Insert payment
    const { data: paymentData, error: paymentError } = await supabase
      .from("payments")
      .insert({
        student_id: paymentStudent.id,
        amount,
        payment_date: paymentDate,
        month,
        year: selectedYear,
        notes: paymentNotes.trim() || null,
      })
      .select()
      .single();

    if (paymentError) {
      toast.error("Gagal merekod pembayaran");
      setSavingPayment(false);
      return;
    }

    // Auto-generate receipt
    const { data: lastReceipt } = await supabase
      .from("receipts")
      .select("receipt_number")
      .order("issued_at", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastReceipt?.receipt_number) {
      const parts = lastReceipt.receipt_number.split("-");
      nextNum = parseInt(parts[parts.length - 1]) + 1;
    }

    const receiptNumber = `RCP-${selectedYear}-${String(nextNum).padStart(3, "0")}`;

    await supabase.from("receipts").insert({
      payment_id: paymentData.id,
      receipt_number: receiptNumber,
    });

    toast.success(
      `Pembayaran RM${amount.toFixed(2)} direkod. Resit: ${receiptNumber}`
    );
    setSavingPayment(false);
    setShowPayment(false);
    fetchFees();
  }

  const totalDue = feeData.reduce((s, r) => s + r.amountDue, 0);
  const totalPaid = feeData.reduce((s, r) => s + r.totalPaid, 0);
  const totalBalance = totalPaid - totalDue;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Yuran</h1>

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
        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2025, 2026, 2027].map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Jumlah Patut Bayar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM {totalDue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Jumlah Diterima</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">RM {totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Baki</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
              RM {totalBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalBalance > 0 ? "Lebihan" : totalBalance < 0 ? "Belum bayar" : "Seimbang"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pelajar</TableHead>
                <TableHead className="text-center">Sesi Hadir</TableHead>
                <TableHead className="text-right">Patut Bayar</TableHead>
                <TableHead className="text-right">Telah Bayar</TableHead>
                <TableHead className="text-right">Baki</TableHead>
                <TableHead className="text-right">Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Memuatkan...
                  </TableCell>
                </TableRow>
              ) : feeData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Tiada data
                  </TableCell>
                </TableRow>
              ) : (
                feeData.map((row) => (
                  <TableRow key={row.student.id}>
                    <TableCell>
                      <span className="font-medium">{row.student.name}</span>
                      {row.student.fee_exempt && (
                        <Badge variant="secondary" className="ml-2">
                          Dikecualikan
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.sessionsAttended}
                    </TableCell>
                    <TableCell className="text-right">
                      RM {row.amountDue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      RM {row.totalPaid.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          row.balance > 0
                            ? "text-green-600"
                            : row.balance < 0
                            ? "text-destructive"
                            : ""
                        }
                      >
                        RM {row.balance.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {!row.student.fee_exempt && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openPaymentDialog(
                              row.student,
                              row.balance < 0 ? Math.abs(row.balance) : 0
                            )
                          }
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Bayar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mt-2">
        Kadar: RM{FEE_PER_SESSION} / sesi
      </p>

      {/* Payment dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Rekod Pembayaran — {paymentStudent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Jumlah (RM)</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Tarikh Bayar</Label>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">Nota</Label>
              <Textarea
                id="pay-notes"
                placeholder="cth: Bayar tunai, bayar untuk 2 bulan, dll"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPayment(false)}>
                Batal
              </Button>
              <Button onClick={handleRecordPayment} disabled={savingPayment}>
                {savingPayment ? "Menyimpan..." : "Rekod Pembayaran"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
