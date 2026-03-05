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
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { printMonthlyReport, type MonthlyReportData } from "@/lib/report-html";

interface PaymentRow {
  amount: number;
  payment_date: string;
  student: { name: string };
}

interface RefundRow {
  amount: number;
  refund_date: string;
  student: { name: string };
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth(); // 0-based
const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

export function MonthlyReport() {
  const supabase = createClient();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(false);

  const month = selectedMonth + 1; // 1-based

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const [paymentsRes, refundsRes] = await Promise.all([
      supabase
        .from("payments")
        .select("amount, payment_date, student:students!inner(name)")
        .eq("month", month)
        .eq("year", selectedYear)
        .eq("voided", false)
        .order("payment_date"),
      supabase
        .from("refunds")
        .select("amount, refund_date, student:students!inner(name)")
        .eq("year", selectedYear)
        .eq("voided", false)
        .or(`month.eq.${month},month.is.null`)
        .order("refund_date"),
    ]);

    setPayments((paymentsRes.data as unknown as PaymentRow[]) || []);
    setRefunds((refundsRes.data as unknown as RefundRow[]) || []);
    setLoading(false);
  }, [supabase, month, selectedYear]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const totalPayments = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalRefunds = refunds.reduce((s, r) => s + Number(r.amount), 0);
  const netIncome = totalPayments - totalRefunds;

  function handlePrint() {
    const data: MonthlyReportData = {
      month,
      year: selectedYear,
      payments: payments.map((p) => ({
        studentName: p.student.name,
        amount: Number(p.amount),
        date: format(parseISO(p.payment_date), "dd/MM/yyyy"),
      })),
      refunds: refunds.map((r) => ({
        studentName: r.student.name,
        amount: Number(r.amount),
        date: format(parseISO(r.refund_date), "dd/MM/yyyy"),
      })),
      totalPayments,
      totalRefunds,
      netIncome,
    };
    if (!printMonthlyReport(data)) {
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
        <Button variant="outline" onClick={handlePrint} disabled={loading}>
          <Printer className="h-4 w-4 mr-1" />
          打印
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">加载中...</p>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">总收入</div>
                <div className="text-xl font-bold text-green-600">
                  {APP_CONFIG.currency} {totalPayments.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">总支出</div>
                <div className="text-xl font-bold text-red-600">
                  {APP_CONFIG.currency} {totalRefunds.toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">净收入</div>
                <div
                  className={`text-xl font-bold ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {APP_CONFIG.currency} {netIncome.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payments table */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">进账（收入）</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学生</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-center whitespace-nowrap">日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          无记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {payments.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell>{p.student.name}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {APP_CONFIG.currency} {Number(p.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center whitespace-nowrap">
                              {format(parseISO(p.payment_date), "dd/MM/yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell>合计</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {APP_CONFIG.currency} {totalPayments.toFixed(2)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Refunds table */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">出账（退费）</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学生</TableHead>
                      <TableHead className="text-right">金额</TableHead>
                      <TableHead className="text-center whitespace-nowrap">日期</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          无记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {refunds.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.student.name}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {APP_CONFIG.currency} {Number(r.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center whitespace-nowrap">
                              {format(parseISO(r.refund_date), "dd/MM/yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell>合计</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {APP_CONFIG.currency} {totalRefunds.toFixed(2)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
