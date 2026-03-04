"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Search, Printer, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { printReceiptHtml, printCreditNoteHtml } from "@/lib/receipt-html";
import { APP_CONFIG } from "@/lib/config";

interface ReceiptRow {
  id: string;
  payment_id: string;
  receipt_number: string;
  issued_at: string | null;
  amount: number;
  payment_date: string;
  month: number;
  year: number;
  student_name: string;
  school_class: string | null;
  notes: string | null;
  voided: boolean;
  payment_voided: boolean;
  coach_name: string | null;
}

interface CreditNoteRow {
  id: string;
  credit_note_number: string;
  issued_at: string | null;
  voided: boolean;
  refund_id: string;
  amount: number;
  refund_date: string;
  year: number;
  month: number | null;
  total_paid: number;
  total_sessions: number;
  total_due: number;
  notes: string | null;
  refund_voided: boolean;
  student_name: string;
  school_class: string | null;
  coach_name: string | null;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [search, setSearch] = useState("");
  const [cnSearch, setCnSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cnLoading, setCnLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteReceipt, setConfirmDeleteReceipt] = useState<ReceiptRow | null>(null);
  const [confirmDeleteCN, setConfirmDeleteCN] = useState<CreditNoteRow | null>(null);

  const supabase = createClient();

  const fetchReceipts = useCallback(async () => {
    const { data, error } = await supabase
      .from("receipts")
      .select(
        `
        id,
        payment_id,
        receipt_number,
        issued_at,
        voided,
        payment:payments!inner(
          id,
          amount,
          payment_date,
          month,
          year,
          notes,
          voided,
          student:students!inner(name, school_class),
          coach:coaches(name)
        )
      `
      )
      .order("issued_at", { ascending: false });

    if (error) {
      toast.error("加载收据失败");
      setLoading(false);
      return;
    }

    const rows: ReceiptRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      payment_id: r.payment_id,
      receipt_number: r.receipt_number,
      issued_at: r.issued_at,
      amount: r.payment.amount,
      payment_date: r.payment.payment_date,
      month: r.payment.month,
      year: r.payment.year,
      student_name: r.payment.student.name,
      school_class: r.payment.student.school_class ?? null,
      notes: r.payment.notes,
      voided: r.voided ?? false,
      payment_voided: r.payment.voided ?? false,
      coach_name: r.payment.coach?.name ?? null,
    }));

    setReceipts(rows);
    setLoading(false);
  }, [supabase]);

  const fetchCreditNotes = useCallback(async () => {
    setCnLoading(true);
    const { data, error } = await supabase
      .from("credit_notes")
      .select(
        `
        id,
        credit_note_number,
        issued_at,
        voided,
        refund_id,
        refund:refunds!inner(
          id,
          amount,
          refund_date,
          year,
          month,
          total_paid,
          total_sessions,
          total_due,
          notes,
          voided,
          student:students!inner(name, school_class),
          coach:coaches(name)
        )
      `
      )
      .order("issued_at", { ascending: false });

    if (error) {
      toast.error("加载退费单失败");
      setCnLoading(false);
      return;
    }

    const rows: CreditNoteRow[] = (data ?? []).map((cn: any) => ({
      id: cn.id,
      credit_note_number: cn.credit_note_number,
      issued_at: cn.issued_at,
      voided: cn.voided ?? false,
      refund_id: cn.refund_id,
      amount: cn.refund.amount,
      refund_date: cn.refund.refund_date,
      year: cn.refund.year,
      month: cn.refund.month,
      total_paid: cn.refund.total_paid,
      total_sessions: cn.refund.total_sessions,
      total_due: cn.refund.total_due,
      notes: cn.refund.notes,
      refund_voided: cn.refund.voided ?? false,
      student_name: cn.refund.student.name,
      school_class: cn.refund.student.school_class ?? null,
      coach_name: cn.refund.coach?.name ?? null,
    }));

    setCreditNotes(rows);
    setCnLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchReceipts();
    fetchCreditNotes();
  }, [fetchReceipts, fetchCreditNotes]);

  const filtered = receipts.filter(
    (r) =>
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.receipt_number.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCN = creditNotes.filter(
    (cn) =>
      cn.student_name.toLowerCase().includes(cnSearch.toLowerCase()) ||
      cn.credit_note_number.toLowerCase().includes(cnSearch.toLowerCase())
  );

  function handlePrintReceipt(receipt: ReceiptRow) {
    const success = printReceiptHtml({
      receiptNumber: receipt.receipt_number,
      issuedAt: receipt.issued_at,
      studentName: receipt.student_name,
      schoolClass: receipt.school_class,
      amount: Number(receipt.amount),
      month: receipt.month,
      year: receipt.year,
      notes: receipt.notes,
    });
    if (!success) {
      toast.error("打印窗口被浏览器拦截，请允许弹出窗口后重试");
    }
  }

  async function handleDeleteReceipt(receipt: ReceiptRow) {
    setDeletingId(receipt.id);
    setConfirmDeleteReceipt(null);

    // Delete receipt first, then payment
    const { error: rErr } = await supabase
      .from("receipts")
      .delete()
      .eq("id", receipt.id);
    if (rErr) {
      toast.error("删除收据失败");
      setDeletingId(null);
      return;
    }

    const { error: pErr } = await supabase
      .from("payments")
      .delete()
      .eq("id", receipt.payment_id);
    if (pErr) {
      toast.error("删除付款记录失败（收据已删除，请联系管理员）");
      setDeletingId(null);
      return;
    }

    toast.success("已删除撤回的收据和付款记录");
    setDeletingId(null);
    fetchReceipts();
  }

  function handlePrintCreditNote(cn: CreditNoteRow) {
    const success = printCreditNoteHtml({
      creditNoteNumber: cn.credit_note_number,
      issuedAt: cn.issued_at,
      studentName: cn.student_name,
      schoolClass: cn.school_class,
      amount: Number(cn.amount),
      year: cn.year,
      month: cn.month,
      totalPaid: Number(cn.total_paid),
      totalSessions: cn.total_sessions,
      totalDue: Number(cn.total_due),
      notes: cn.notes,
    });
    if (!success) {
      toast.error("打印窗口被浏览器拦截，请允许弹出窗口后重试");
    }
  }

  async function handleDeleteCreditNote(cn: CreditNoteRow) {
    setDeletingId(cn.id);
    setConfirmDeleteCN(null);

    // Delete credit note first, then refund
    const { error: cnErr } = await supabase
      .from("credit_notes")
      .delete()
      .eq("id", cn.id);
    if (cnErr) {
      toast.error("删除退费单失败");
      setDeletingId(null);
      return;
    }

    const { error: rErr } = await supabase
      .from("refunds")
      .delete()
      .eq("id", cn.refund_id);
    if (rErr) {
      toast.error("删除退费记录失败（退费单已删除，请联系管理员）");
      setDeletingId(null);
      return;
    }

    toast.success("已删除撤回的退费单和退费记录");
    setDeletingId(null);
    fetchCreditNotes();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">收据</h1>

      <Tabs defaultValue="receipts">
        <TabsList className="mb-4">
          <TabsTrigger value="receipts">收据</TabsTrigger>
          <TabsTrigger value="credit-notes">退费单</TabsTrigger>
        </TabsList>

        {/* ── Receipts Tab ──────────────────────────────── */}
        <TabsContent value="receipts">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索收据号或学生姓名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>收据号</TableHead>
                    <TableHead>学生</TableHead>
                    <TableHead>期间</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>教练</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {search ? "未找到收据" : "暂无收据"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((receipt) => {
                      const isVoided = receipt.voided || receipt.payment_voided;
                      return (
                        <TableRow key={receipt.id} className={isVoided ? "opacity-50" : ""}>
                          <TableCell className={`font-mono text-sm ${isVoided ? "line-through" : ""}`}>
                            {receipt.receipt_number}
                            {isVoided && (
                              <Badge variant="destructive" className="ml-2 text-xs">已撤回</Badge>
                            )}
                          </TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>{receipt.student_name}</TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>
                            {receipt.year}年{receipt.month}月
                          </TableCell>
                          <TableCell className={`text-right font-medium ${isVoided ? "line-through" : ""}`}>
                            {APP_CONFIG.currency} {Number(receipt.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>
                            {receipt.coach_name ?? "-"}
                          </TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>
                            {receipt.issued_at
                              ? format(parseISO(receipt.issued_at), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isVoided ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                title="删除"
                                disabled={deletingId === receipt.id}
                                onClick={() => setConfirmDeleteReceipt(receipt)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                删除
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintReceipt(receipt)}
                              >
                                <Printer className="h-4 w-4 mr-1" />
                                打印
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground mt-2">
            {filtered.length} 张收据
          </p>
        </TabsContent>

        {/* ── Credit Notes Tab ──────────────────────────── */}
        <TabsContent value="credit-notes">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索退费单号或学生姓名..."
              value={cnSearch}
              onChange={(e) => setCnSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>退费单号</TableHead>
                    <TableHead>学生</TableHead>
                    <TableHead>期间</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>教练</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cnLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : filteredCN.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {cnSearch ? "未找到退费单" : "暂无退费单"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCN.map((cn) => {
                      const isVoided = cn.voided || cn.refund_voided;
                      return (
                        <TableRow key={cn.id} className={isVoided ? "opacity-50" : ""}>
                          <TableCell className={`font-mono text-sm ${isVoided ? "line-through" : ""}`}>
                            {cn.credit_note_number}
                            {isVoided && (
                              <Badge variant="destructive" className="ml-2 text-xs">已撤回</Badge>
                            )}
                          </TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>{cn.student_name}</TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>
                            {cn.month ? `${cn.year}年${cn.month}月` : `${cn.year}年（全年）`}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${isVoided ? "line-through" : ""}`}>
                            {APP_CONFIG.currency} {Number(cn.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>
                            {cn.coach_name ?? "-"}
                          </TableCell>
                          <TableCell className={isVoided ? "line-through" : ""}>
                            {cn.issued_at
                              ? format(parseISO(cn.issued_at), "dd/MM/yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isVoided ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                title="删除"
                                disabled={deletingId === cn.id}
                                onClick={() => setConfirmDeleteCN(cn)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                删除
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintCreditNote(cn)}
                              >
                                <Printer className="h-4 w-4 mr-1" />
                                打印
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground mt-2">
            {filteredCN.length} 张退费单
          </p>
        </TabsContent>
      </Tabs>

      {/* Delete receipt confirmation dialog */}
      <AlertDialog
        open={!!confirmDeleteReceipt}
        onOpenChange={(open) => !open && setConfirmDeleteReceipt(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要永久删除收据 {confirmDeleteReceipt?.receipt_number} 及其关联的付款记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteReceipt && handleDeleteReceipt(confirmDeleteReceipt)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete credit note confirmation dialog */}
      <AlertDialog
        open={!!confirmDeleteCN}
        onOpenChange={(open) => !open && setConfirmDeleteCN(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要永久删除退费单 {confirmDeleteCN?.credit_note_number} 及其关联的退费记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteCN && handleDeleteCreditNote(confirmDeleteCN)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
