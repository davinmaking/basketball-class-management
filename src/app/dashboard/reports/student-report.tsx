"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { APP_CONFIG } from "@/lib/config";
import { Button } from "@/components/ui/button";
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
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { printStudentReport, type StudentReportData } from "@/lib/report-html";

interface Student {
  id: string;
  name: string;
  school_class: string | null;
}

interface PaymentRow {
  month: number;
  amount: number;
  payment_date: string;
  notes: string | null;
}

interface RefundRow {
  month: number | null;
  amount: number;
  refund_date: string;
  notes: string | null;
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

export function StudentReport() {
  const supabase = createClient();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchStudents() {
      const { data } = await supabase
        .from("students")
        .select("id, name, school_class")
        .eq("active", true)
        .order("name");
      if (data) setStudents(data);
    }
    fetchStudents();
  }, [supabase]);

  const fetchReport = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    setLoaded(false);

    const [paymentsRes, refundsRes] = await Promise.all([
      supabase
        .from("payments")
        .select("amount, payment_date, month, notes")
        .eq("student_id", selectedStudentId)
        .eq("year", selectedYear)
        .eq("voided", false)
        .order("month"),
      supabase
        .from("refunds")
        .select("amount, refund_date, month, notes")
        .eq("student_id", selectedStudentId)
        .eq("year", selectedYear)
        .eq("voided", false)
        .order("refund_date"),
    ]);

    setPayments((paymentsRes.data as PaymentRow[]) || []);
    setRefunds((refundsRes.data as RefundRow[]) || []);
    setLoading(false);
    setLoaded(true);
  }, [supabase, selectedStudentId, selectedYear]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalRefunded = refunds.reduce((s, r) => s + Number(r.amount), 0);
  const netAmount = totalPaid - totalRefunded;

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  function handlePrint() {
    if (!selectedStudent) return;
    const data: StudentReportData = {
      studentName: selectedStudent.name,
      schoolClass: selectedStudent.school_class,
      year: selectedYear,
      payments: payments.map((p) => ({
        month: p.month,
        amount: Number(p.amount),
        date: format(parseISO(p.payment_date), "dd/MM/yyyy"),
        notes: p.notes,
      })),
      refunds: refunds.map((r) => ({
        month: r.month,
        amount: Number(r.amount),
        date: format(parseISO(r.refund_date), "dd/MM/yyyy"),
        notes: r.notes,
      })),
      totalPaid,
      totalRefunded,
      netAmount,
    };
    if (!printStudentReport(data)) {
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
        <div className="w-full sm:w-64">
          <label className="text-sm font-medium mb-1 block">学生</label>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="选择学生" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchReport} disabled={!selectedStudentId || loading}>
          {loading ? "加载中..." : "查看报表"}
        </Button>
        {loaded && (
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            打印
          </Button>
        )}
      </div>

      {/* Report content */}
      {loaded && (
        <div className="space-y-4">
          {/* Payments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">付款记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">月份</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-center whitespace-nowrap">日期</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          无记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-center">{p.month}月</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {APP_CONFIG.currency} {Number(p.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {format(parseISO(p.payment_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{p.notes || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Refunds */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">退费记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">期间</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-center whitespace-nowrap">日期</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          无记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      refunds.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-center">
                            {r.month ? `${r.month}月` : "全年"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {APP_CONFIG.currency} {Number(r.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {format(parseISO(r.refund_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>{r.notes || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-muted-foreground">付款总额</div>
                  <div className="text-lg font-bold text-success">
                    {APP_CONFIG.currency} {totalPaid.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">退费总额</div>
                  <div className="text-lg font-bold text-destructive">
                    {APP_CONFIG.currency} {totalRefunded.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">净额</div>
                  <div
                    className={`text-lg font-bold ${netAmount >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {APP_CONFIG.currency} {netAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
