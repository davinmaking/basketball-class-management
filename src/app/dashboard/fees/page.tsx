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
import { DollarSign, MessageCircle, History, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { formatPhoneForWhatsApp } from "@/lib/phone";
import { MONTHS } from "@/lib/constants";
import { APP_CONFIG } from "@/lib/config";
import { getLanguageLabel } from "@/lib/language";

type Student = Tables<"students">;

interface HistoryPayment {
  id: string;
  amount: number;
  payment_date: string;
  month: number;
  year: number;
  notes: string | null;
  voided: boolean;
  voided_at: string | null;
  voided_reason: string | null;
  receipts: { receipt_number: string; voided: boolean }[];
}

interface FeeRow {
  student: Student;
  sessionsAttended: number;
  amountDue: number;
  totalPaid: number;
  balance: number;
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
      toast.error("请输入有效金额");
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
      toast.error("记录付款失败");
      setSavingPayment(false);
      return;
    }

    // Auto-generate receipt with retry on conflict
    let receiptNumber = "";
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data: lastReceipt } = await supabase
        .from("receipts")
        .select("receipt_number")
        .like("receipt_number", `${APP_CONFIG.receiptPrefix}-${selectedYear}-%`)
        .order("receipt_number", { ascending: false })
        .limit(1)
        .single();

      let nextNum = 1;
      if (lastReceipt?.receipt_number) {
        const parts = lastReceipt.receipt_number.split("-");
        nextNum = parseInt(parts[parts.length - 1]) + 1;
      }

      receiptNumber = `${APP_CONFIG.receiptPrefix}-${selectedYear}-${String(nextNum).padStart(3, "0")}`;

      const { error: receiptError } = await supabase.from("receipts").insert({
        payment_id: paymentData.id,
        receipt_number: receiptNumber,
      });

      if (!receiptError) break;

      // Retry on unique constraint violation (race condition)
      if (receiptError.code === "23505" && attempt < maxRetries - 1) {
        continue;
      }

      // Final attempt failed or non-constraint error
      toast.error("生成收据失败，但付款已记录");
      setSavingPayment(false);
      setShowPayment(false);
      fetchFees();
      return;
    }

    toast.success(
      `已记录付款 ${APP_CONFIG.currency}${amount.toFixed(2)}。收据: ${receiptNumber}`
    );
    setSavingPayment(false);
    setShowPayment(false);
    fetchFees();
  }

  async function openHistory(student: Student) {
    setHistoryStudent(student);
    setShowHistory(true);
    setLoadingHistory(true);

    const month = selectedMonth + 1;
    const { data } = await supabase
      .from("payments")
      .select("*, receipts(receipt_number, voided)")
      .eq("student_id", student.id)
      .eq("month", month)
      .eq("year", selectedYear)
      .order("payment_date", { ascending: false });

    setHistoryPayments(data ?? []);
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

    // Void the payment
    const { error: payError } = await supabase
      .from("payments")
      .update({
        voided: true,
        voided_at: new Date().toISOString(),
        voided_reason: voidReason.trim() || null,
      })
      .eq("id", voidPaymentId);

    if (payError) {
      toast.error("撤回付款失败");
      setVoidingPayment(false);
      return;
    }

    // Void linked receipt
    await supabase
      .from("receipts")
      .update({ voided: true })
      .eq("payment_id", voidPaymentId);

    toast.success("付款已撤回");
    setVoidingPayment(false);
    setShowVoid(false);

    // Refresh history if open
    if (historyStudent) {
      openHistory(historyStudent);
    }
    fetchFees();
  }

  async function handleDeletePayment(paymentId: string) {
    setDeletingPaymentId(paymentId);
    setConfirmDeletePaymentId(null);

    // Delete receipt first (child), then payment (parent)
    const { error: receiptErr } = await supabase.from("receipts").delete().eq("payment_id", paymentId);
    if (receiptErr) {
      toast.error("删除收据失败");
      setDeletingPaymentId(null);
      return;
    }

    const { error } = await supabase.from("payments").delete().eq("id", paymentId);
    if (error) {
      toast.error("删除付款记录失败（收据已删除，请联系管理员）");
      setDeletingPaymentId(null);
      return;
    }

    toast.success("已删除撤回的付款记录");
    setDeletingPaymentId(null);

    // Refresh history if open
    if (historyStudent) {
      openHistory(historyStudent);
    }
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
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-destructive"}`}>
              {APP_CONFIG.currency} {totalBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalBalance > 0 ? "多缴" : totalBalance < 0 ? "未缴" : "已结清"}
            </p>
          </CardContent>
        </Card>
      </div>

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
          ) : historyPayments.length === 0 ? (
            <p className="text-muted-foreground py-4">暂无付款记录</p>
          ) : (
            <div className="space-y-3">
              {historyPayments.map((payment) => {
                const receipt = payment.receipts?.[0];
                return (
                  <div
                    key={payment.id}
                    className={`border rounded-lg p-3 ${
                      payment.voided ? "opacity-50" : ""
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

      {/* Payment dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              记录付款 — {paymentStudent?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">金额 ({APP_CONFIG.currency})</Label>
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
              <Label htmlFor="pay-date">付款日期</Label>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">备注</Label>
              <Textarea
                id="pay-notes"
                placeholder="例如: 现金支付, 预付2个月等"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPayment(false)}>
                取消
              </Button>
              <Button onClick={handleRecordPayment} disabled={savingPayment}>
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
}: {
  group: { className: string; rows: FeeRow[] };
  selectedMonth: number;
  selectedYear: number;
  onOpenHistory: (student: Student) => void;
  onOpenPayment: (student: Student, suggestedAmount: number) => void;
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
                  ? "text-green-600"
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
                      <MessageCircle className="h-4 w-4 text-green-600" />
                    </a>
                  </Button>
                </div>
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
