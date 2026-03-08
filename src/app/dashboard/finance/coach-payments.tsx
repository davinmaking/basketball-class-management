"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { APP_CONFIG } from "@/lib/config";
import { MONTHS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  printCoachPaymentReport,
  type CoachPaymentReportData,
} from "@/lib/report-html";

interface Coach {
  id: string;
  name: string;
}

interface CoachPaymentRow {
  id: string;
  coach_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  voided: boolean;
  voided_at: string | null;
  voided_reason: string | null;
  coach: { name: string };
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth(); // 0-based
const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

export function CoachPayments() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachPayments, setCoachPayments] = useState<CoachPaymentRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogCoachId, setDialogCoachId] = useState("");
  const [dialogAmount, setDialogAmount] = useState("");
  const [dialogDate, setDialogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dialogNotes, setDialogNotes] = useState("");

  // Void state
  const [voidReason, setVoidReason] = useState("");

  const month = selectedMonth + 1;

  useEffect(() => {
    async function fetchCoaches() {
      const { data } = await supabase
        .from("coaches")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (data) setCoaches(data);
    }
    fetchCoaches();
  }, [supabase]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("coach_payments")
      .select("*, coach:coaches!inner(name)")
      .eq("month", month)
      .eq("year", selectedYear)
      .order("payment_date");
    setCoachPayments((data as unknown as CoachPaymentRow[]) || []);
    setLoading(false);
  }, [supabase, month, selectedYear]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const nonVoided = coachPayments.filter((cp) => !cp.voided);
  const totalAmount = nonVoided.reduce((s, cp) => s + Number(cp.amount), 0);

  async function handleSave() {
    if (!dialogCoachId || !dialogAmount) return;
    const amount = parseFloat(dialogAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("请输入有效金额");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("coach_payments").insert({
      coach_id: dialogCoachId,
      amount,
      month,
      year: selectedYear,
      payment_date: dialogDate,
      notes: dialogNotes.trim() || null,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("该教练本月已有薪酬记录，请先撤回旧记录再重新录入");
      } else {
        toast.error("记录失败");
      }
      setSaving(false);
      return;
    }

    toast.success("教练薪酬已记录");
    setSaving(false);
    setShowDialog(false);
    setDialogCoachId("");
    setDialogAmount("");
    setDialogNotes("");
    fetchPayments();
  }

  async function handleVoid(id: string, reason: string) {
    if (!reason.trim()) {
      toast.error("请输入撤回原因");
      return;
    }
    const { error } = await supabase
      .from("coach_payments")
      .update({
        voided: true,
        voided_at: new Date().toISOString(),
        voided_reason: reason.trim(),
      })
      .eq("id", id);

    if (error) {
      toast.error("撤回失败");
      return;
    }
    toast.success("已撤回");
    setVoidReason("");
    fetchPayments();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from("coach_payments")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除失败");
      return;
    }
    toast.success("已删除");
    fetchPayments();
  }

  function handlePrint() {
    const data: CoachPaymentReportData = {
      month,
      year: selectedYear,
      coachPayments: nonVoided.map((cp) => ({
        coachName: cp.coach.name,
        amount: Number(cp.amount),
        date: format(parseISO(cp.payment_date), "dd/MM/yyyy"),
        notes: cp.notes,
      })),
      totalCoachPayments: totalAmount,
    };
    if (!printCoachPaymentReport(data)) {
      toast.error("打印窗口被浏览器拦截，请允许弹窗");
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="w-full sm:w-48">
          <label className="text-sm font-medium mb-1 block">年份</label>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <label className="text-sm font-medium mb-1 block">月份</label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          记录薪酬
        </Button>
        <Button variant="outline" onClick={handlePrint} disabled={loading}>
          <Printer className="h-4 w-4 mr-1" />
          打印
        </Button>
      </div>

      {/* Total */}
      <Card>
        <CardContent className="pt-6 text-center">
          <div className="text-sm text-muted-foreground">
            {selectedYear}年{month}月 教练薪酬总额
          </div>
          <div className="text-2xl font-bold">
            {APP_CONFIG.currency} {totalAmount.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>教练</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-center whitespace-nowrap">日期</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coachPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    无记录
                  </TableCell>
                </TableRow>
              ) : (
                coachPayments.map((cp) => (
                  <TableRow key={cp.id} className={cp.voided ? "text-muted-foreground" : ""}>
                    <TableCell className={cp.voided ? "line-through" : ""}>
                      {cp.coach.name}
                    </TableCell>
                    <TableCell
                      className={`text-right whitespace-nowrap ${cp.voided ? "line-through" : ""}`}
                    >
                      {APP_CONFIG.currency} {Number(cp.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {format(parseISO(cp.payment_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {cp.voided ? (
                        <span className="text-sm text-muted-foreground">
                          撤回: {cp.voided_reason}
                        </span>
                      ) : (
                        cp.notes || "-"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {cp.voided ? (
                        <Badge variant="destructive">已撤回</Badge>
                      ) : (
                        <Badge variant="default">有效</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!cp.voided && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="撤回">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>撤回教练薪酬</AlertDialogTitle>
                                <AlertDialogDescription>
                                  撤回 {cp.coach.name} 的 {APP_CONFIG.currency}{" "}
                                  {Number(cp.amount).toFixed(2)} 薪酬记录？请输入撤回原因：
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Input
                                placeholder="撤回原因"
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                              />
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setVoidReason("")}>
                                  取消
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleVoid(cp.id, voidReason)}
                                >
                                  确认撤回
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {cp.voided && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="删除">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>删除记录</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要永久删除此已撤回的记录？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(cp.id)}>
                                  确认删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Record payment dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              记录教练薪酬 — {selectedYear}年{month}月
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">教练</label>
              <Select value={dialogCoachId} onValueChange={setDialogCoachId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择教练" />
                </SelectTrigger>
                <SelectContent>
                  {coaches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                金额 ({APP_CONFIG.currency})
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={dialogAmount}
                onChange={(e) => setDialogAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">付款日期</label>
              <Input
                type="date"
                value={dialogDate}
                onChange={(e) => setDialogDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">备注</label>
              <Textarea
                value={dialogNotes}
                onChange={(e) => setDialogNotes(e.target.value)}
                placeholder="可选"
                rows={2}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving || !dialogCoachId || !dialogAmount}
            >
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
