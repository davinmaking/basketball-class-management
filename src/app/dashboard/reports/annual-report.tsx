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
import { printAnnualReport, type AnnualReportData } from "@/lib/report-html";

interface PaymentAgg {
  month: number;
  amount: number;
}

interface RefundAgg {
  month: number | null;
  amount: number;
}

interface CoachPaymentAgg {
  month: number;
  amount: number;
}

interface AttendanceRow {
  fee_exempt: boolean;
  session: { session_date: string };
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

export function AnnualReport() {
  const supabase = createClient();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);

  // Raw data
  const [payments, setPayments] = useState<PaymentAgg[]>([]);
  const [refunds, setRefunds] = useState<RefundAgg[]>([]);
  const [coachPayments, setCoachPayments] = useState<CoachPaymentAgg[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);

  const fetchReport = useCallback(async () => {
    setLoading(true);

    const [paymentsRes, refundsRes, coachPayRes, attendanceRes, paymentsForBalanceRes] =
      await Promise.all([
        // All payments for the year
        supabase
          .from("payments")
          .select("month, amount")
          .eq("year", selectedYear)
          .eq("voided", false),
        // All refunds for the year
        supabase
          .from("refunds")
          .select("month, amount")
          .eq("year", selectedYear)
          .eq("voided", false),
        // All coach payments for the year
        supabase
          .from("coach_payments")
          .select("month, amount")
          .eq("year", selectedYear)
          .eq("voided", false),
        // Attendance for the year (for outstanding balance calculation)
        supabase
          .from("attendance")
          .select("fee_exempt, session:class_sessions!inner(session_date)")
          .eq("present", true)
          .gte("class_sessions.session_date", `${selectedYear}-01-01`)
          .lte("class_sessions.session_date", `${selectedYear}-12-31`),
        // Total payments for the year (for balance calc)
        supabase
          .from("payments")
          .select("amount")
          .eq("year", selectedYear)
          .eq("voided", false),
      ]);

    setPayments((paymentsRes.data as PaymentAgg[]) || []);
    setRefunds((refundsRes.data as RefundAgg[]) || []);
    setCoachPayments((coachPayRes.data as CoachPaymentAgg[]) || []);

    // Calculate outstanding balance:
    // total fees due (non-exempt attendance * fee rate) - total payments
    const attendanceData = (attendanceRes.data as unknown as AttendanceRow[]) || [];
    const nonExemptSessions = attendanceData.filter((a) => !a.fee_exempt).length;
    const totalDue = nonExemptSessions * APP_CONFIG.feePerSession;
    const totalPaid = (paymentsForBalanceRes.data || []).reduce(
      (s: number, p: { amount: number }) => s + Number(p.amount),
      0
    );
    setOutstandingBalance(Math.max(0, totalDue - totalPaid));

    setLoading(false);
  }, [supabase, selectedYear]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Aggregate by month (1-12)
  function aggregateByMonth(items: { month: number; amount: number }[]): number[] {
    const result = Array(12).fill(0);
    for (const item of items) {
      if (item.month >= 1 && item.month <= 12) {
        result[item.month - 1] += Number(item.amount);
      }
    }
    return result;
  }

  const paymentsByMonth = aggregateByMonth(payments);
  const coachPayByMonth = aggregateByMonth(coachPayments);

  // Refunds can have null month (year-level refund) — distribute to month 0 or spread
  const refundsByMonth = (() => {
    const result = Array(12).fill(0);
    for (const r of refunds) {
      if (r.month && r.month >= 1 && r.month <= 12) {
        result[r.month - 1] += Number(r.amount);
      } else {
        // null month = whole-year refund, put in first month for display
        result[0] += Number(r.amount);
      }
    }
    return result;
  })();

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const pay = paymentsByMonth[i];
    const ref = refundsByMonth[i];
    const cp = coachPayByMonth[i];
    return {
      month: i + 1,
      payments: pay,
      refunds: ref,
      coachPayments: cp,
      netIncome: pay - ref - cp,
    };
  });

  const yearTotals = {
    totalPayments: monthlyData.reduce((s, m) => s + m.payments, 0),
    totalRefunds: monthlyData.reduce((s, m) => s + m.refunds, 0),
    totalCoachPayments: monthlyData.reduce((s, m) => s + m.coachPayments, 0),
    totalExpenses: monthlyData.reduce((s, m) => s + m.refunds + m.coachPayments, 0),
    netIncome: monthlyData.reduce((s, m) => s + m.netIncome, 0),
  };

  const fmt = (n: number) => `${APP_CONFIG.currency} ${n.toFixed(2)}`;

  function handlePrint() {
    const data: AnnualReportData = {
      year: selectedYear,
      monthlyData,
      yearTotals,
      outstandingBalance,
    };
    if (!printAnnualReport(data)) {
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">年度总收入</div>
                <div className="text-xl font-bold text-green-600">
                  {fmt(yearTotals.totalPayments)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">年度总支出</div>
                <div className="text-xl font-bold text-red-600">
                  {fmt(yearTotals.totalExpenses)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">年度净收入</div>
                <div
                  className={`text-xl font-bold ${yearTotals.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {fmt(yearTotals.netIncome)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-sm text-muted-foreground">未收余额</div>
                <div
                  className={`text-xl font-bold ${outstandingBalance > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {fmt(outstandingBalance)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 1: Income Summary */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">一、收入总结</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">月份</TableHead>
                      <TableHead className="text-right">学费收入</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell className="text-center">{MONTHS[m.month - 1]}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {m.payments > 0 ? fmt(m.payments) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="text-center">合计</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmt(yearTotals.totalPayments)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Expense Summary */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">二、支出总结</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">月份</TableHead>
                      <TableHead className="text-right">退费</TableHead>
                      <TableHead className="text-right">教练薪酬</TableHead>
                      <TableHead className="text-right">合计</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((m) => {
                      const total = m.refunds + m.coachPayments;
                      return (
                        <TableRow key={m.month}>
                          <TableCell className="text-center">{MONTHS[m.month - 1]}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {m.refunds > 0 ? fmt(m.refunds) : "-"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {m.coachPayments > 0 ? fmt(m.coachPayments) : "-"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {total > 0 ? fmt(total) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="text-center">合计</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmt(yearTotals.totalRefunds)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmt(yearTotals.totalCoachPayments)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmt(yearTotals.totalExpenses)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Net Income */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">三、净收入</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">月份</TableHead>
                      <TableHead className="text-right">收入</TableHead>
                      <TableHead className="text-right">支出</TableHead>
                      <TableHead className="text-right">净收入</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((m) => {
                      const expenses = m.refunds + m.coachPayments;
                      return (
                        <TableRow key={m.month}>
                          <TableCell className="text-center">{MONTHS[m.month - 1]}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {m.payments > 0 ? fmt(m.payments) : "-"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {expenses > 0 ? fmt(expenses) : "-"}
                          </TableCell>
                          <TableCell
                            className={`text-right whitespace-nowrap font-medium ${m.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {fmt(m.netIncome)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="text-center">合计</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmt(yearTotals.totalPayments)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {fmt(yearTotals.totalExpenses)}
                      </TableCell>
                      <TableCell
                        className={`text-right whitespace-nowrap ${yearTotals.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {fmt(yearTotals.netIncome)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Outstanding Balance */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-3">四、未收余额</h3>
              <div className="text-center py-4">
                <div className="text-sm text-muted-foreground mb-1">
                  学生未缴总额（应收 - 已收）
                </div>
                <div
                  className={`text-2xl font-bold ${outstandingBalance > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {fmt(outstandingBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  基于 {selectedYear}年 全部出勤记录（非免费）计算
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
