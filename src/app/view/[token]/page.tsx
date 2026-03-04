import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ParentReceiptButton } from "./receipt-button";
import { FEE_PER_SESSION } from "@/lib/constants";

export default async function ParentViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  // Find student by token
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("view_token", token)
    .single();

  if (!student) {
    notFound();
  }

  const nowYear = new Date().getFullYear();
  const selectedYear = resolvedSearchParams.year
    ? parseInt(resolvedSearchParams.year)
    : nowYear;

  // Validate year range
  const displayYear =
    isNaN(selectedYear) || selectedYear < 2020 || selectedYear > nowYear + 1
      ? nowYear
      : selectedYear;

  // Get all sessions for selected year
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("*")
    .gte("session_date", `${displayYear}-01-01`)
    .lt("session_date", `${displayYear + 1}-01-01`)
    .order("session_date");

  // Get attendance
  const { data: attendanceData } = await supabase
    .from("attendance")
    .select("session_id, present, fee_exempt")
    .eq("student_id", student.id)
    .eq("present", true);

  const attendedSessionIds = new Set(
    (attendanceData ?? []).map((a) => a.session_id)
  );

  // Sessions that are chargeable (present AND NOT fee_exempt)
  const chargeableSessionIds = new Set(
    (attendanceData ?? [])
      .filter((a) => !a.fee_exempt)
      .map((a) => a.session_id)
  );

  // Get payments
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("student_id", student.id)
    .eq("year", displayYear)
    .order("payment_date", { ascending: false });

  // Get receipts
  const paymentIds = (payments ?? []).map((p) => p.id);
  const { data: receipts } = paymentIds.length > 0
    ? await supabase
        .from("receipts")
        .select("*")
        .in("payment_id", paymentIds)
    : { data: [] };

  const receiptMap = new Map(
    (receipts ?? []).map((r) => [r.payment_id, r])
  );

  // Calculate monthly summaries
  const monthlySummaries = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthSessions = (sessions ?? []).filter((s) => {
      const d = parseISO(s.session_date);
      return d.getMonth() === i;
    });

    const attended = monthSessions.filter((s) =>
      attendedSessionIds.has(s.id)
    ).length;

    const chargeable = monthSessions.filter((s) =>
      chargeableSessionIds.has(s.id)
    ).length;

    const due = chargeable * FEE_PER_SESSION;
    const paid = (payments ?? [])
      .filter((p) => p.month === month && !p.voided)
      .reduce((s, p) => s + Number(p.amount), 0);

    return {
      month,
      totalSessions: monthSessions.length,
      attended,
      due,
      paid,
      balance: paid - due,
    };
  }).filter((m) => m.totalSessions > 0 || m.paid > 0);

  const totalDue = monthlySummaries.reduce((s, m) => s + m.due, 0);
  const totalPaid = monthlySummaries.reduce((s, m) => s + m.paid, 0);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">篮球训练班</h1>
          <p className="text-muted-foreground">家长门户</p>
        </div>

        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle>{student.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {student.school_class && (
              <p>
                <span className="text-muted-foreground">班级:</span>{" "}
                {student.school_class}
              </p>
            )}
            {student.parent_name && (
              <p>
                <span className="text-muted-foreground">联系人:</span>{" "}
                {student.parent_name}
                {student.relationship && ` (${student.relationship})`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Year Navigation */}
        <div className="flex items-center justify-center gap-3">
          <Link href={`/view/${token}?year=${displayYear - 1}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-lg font-semibold">{displayYear}年</span>
          {displayYear < nowYear && (
            <Link href={`/view/${token}?year=${displayYear + 1}`}>
              <Button variant="ghost" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {displayYear >= nowYear && <div className="w-9" />}
        </div>

        {/* Fee Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{displayYear}年总费用</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {totalDue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">已支付</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">RM {totalPaid.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">余额</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  totalPaid - totalDue >= 0 ? "text-green-600" : "text-destructive"
                }`}
              >
                RM {(totalPaid - totalDue).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{displayYear}年月度汇总</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份</TableHead>
                  <TableHead className="text-center">出勤</TableHead>
                  <TableHead className="text-right">费用</TableHead>
                  <TableHead className="text-right">已支付</TableHead>
                  <TableHead className="text-right">余额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummaries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      本年暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  monthlySummaries.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>{m.month}月</TableCell>
                      <TableCell className="text-center">
                        {m.attended} / {m.totalSessions}
                      </TableCell>
                      <TableCell className="text-right">
                        RM {m.due.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        RM {m.paid.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            m.balance > 0
                              ? "text-green-600"
                              : m.balance < 0
                              ? "text-destructive"
                              : ""
                          }
                        >
                          RM {m.balance.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payments & Receipts */}
        {(payments ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>付款记录</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>期间</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">收据</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments ?? []).map((payment) => {
                    const receipt = receiptMap.get(payment.id);
                    const isVoided = payment.voided;
                    return (
                      <TableRow key={payment.id} className={isVoided ? "opacity-50" : ""}>
                        <TableCell className={isVoided ? "line-through" : ""}>
                          {format(parseISO(payment.payment_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className={isVoided ? "line-through" : ""}>
                          {payment.year}年{payment.month}月
                          {isVoided && (
                            <Badge variant="destructive" className="ml-2 text-xs">已撤回</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${isVoided ? "line-through" : ""}`}>
                          RM {Number(payment.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {receipt && !isVoided && (
                            <ParentReceiptButton
                              receiptNumber={receipt.receipt_number}
                              issuedAt={receipt.issued_at ?? ""}
                              studentName={student.name}
                              amount={Number(payment.amount)}
                              month={payment.month}
                              year={payment.year}
                              notes={payment.notes}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          费率: RM{FEE_PER_SESSION} / 课
        </p>
      </div>
    </div>
  );
}
