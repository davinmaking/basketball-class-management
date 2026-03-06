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
import { ChevronLeft, ChevronRight, Dribbble } from "lucide-react";
import { ParentReceiptButton } from "./receipt-button";
import { ParentCreditNoteButton } from "./credit-note-button";
import { APP_CONFIG } from "@/lib/config";

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
    .select("*, coach:coaches(name)")
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

  // Get refunds with credit notes
  const { data: refunds } = await supabase
    .from("refunds")
    .select(
      `
      *,
      credit_notes(credit_note_number, voided, issued_at),
      coach:coaches(name)
    `
    )
    .eq("student_id", student.id)
    .eq("year", displayYear)
    .eq("voided", false)
    .order("refund_date", { ascending: false });

  const totalRefunded = (refunds ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0
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

    const due = chargeable * APP_CONFIG.feePerSession;
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
    <div className="min-h-[100dvh] bg-muted/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
            <Dribbble className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{APP_CONFIG.className}</h1>
          <p className="text-sm text-muted-foreground">家长门户 / Portal Ibu Bapa</p>
        </div>

        {/* Student Info */}
        <Card>
          <CardHeader>
            <CardTitle>{student.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {student.school_class && (
              <p>
                <span className="text-muted-foreground">班级 / Kelas:</span>{" "}
                {student.school_class}
              </p>
            )}
            {student.parent_name && (
              <p>
                <span className="text-muted-foreground">联系人 / Hubungan:</span>{" "}
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
        <div className={`grid gap-4 ${totalRefunded > 0 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{displayYear}年总费用 / Jumlah Yuran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums">{APP_CONFIG.currency} {totalDue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">已支付 / Telah Dibayar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums">{APP_CONFIG.currency} {totalPaid.toFixed(2)}</div>
            </CardContent>
          </Card>
          {totalRefunded > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">已退费 / Dikembalikan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-blue-600">
                  {APP_CONFIG.currency} {totalRefunded.toFixed(2)}
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">余额 / Baki</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  totalPaid - totalDue - totalRefunded >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {APP_CONFIG.currency} {(totalPaid - totalDue - totalRefunded).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>{displayYear}年月度汇总 / Ringkasan Bulanan</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>月份 / Bulan</TableHead>
                  <TableHead className="text-center">出勤 / Hadir</TableHead>
                  <TableHead className="text-right">费用 / Yuran</TableHead>
                  <TableHead className="text-right">已支付 / Dibayar</TableHead>
                  <TableHead className="text-right">余额 / Baki</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummaries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      本年暂无数据 / Tiada data untuk tahun ini
                    </TableCell>
                  </TableRow>
                ) : (
                  monthlySummaries.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>{m.month}月</TableCell>
                      <TableCell className="text-center">
                        {m.attended} / {m.totalSessions}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {APP_CONFIG.currency} {m.due.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {APP_CONFIG.currency} {m.paid.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span
                          className={
                            m.balance > 0
                              ? "text-success"
                              : m.balance < 0
                              ? "text-destructive"
                              : ""
                          }
                        >
                          {APP_CONFIG.currency} {m.balance.toFixed(2)}
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
              <CardTitle>付款记录 / Rekod Bayaran</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期 / Tarikh</TableHead>
                    <TableHead>期间 / Tempoh</TableHead>
                    <TableHead className="text-right">金额 / Amaun</TableHead>
                    <TableHead>教练 / Jurulatih</TableHead>
                    <TableHead className="text-right">收据 / Resit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments ?? []).map((payment: any) => {
                    const receipt = receiptMap.get(payment.id);
                    const isVoided = payment.voided;
                    return (
                      <TableRow key={payment.id} className={isVoided ? "opacity-50" : ""}>
                        <TableCell className={`whitespace-nowrap ${isVoided ? "line-through" : ""}`}>
                          {format(parseISO(payment.payment_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap ${isVoided ? "line-through" : ""}`}>
                          {payment.year}年{payment.month}月
                          {isVoided && (
                            <Badge variant="destructive" className="ml-2 text-xs">已撤回 / Batal</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-medium whitespace-nowrap ${isVoided ? "line-through" : ""}`}>
                          {APP_CONFIG.currency} {Number(payment.amount).toFixed(2)}
                        </TableCell>
                        <TableCell className={isVoided ? "line-through" : ""}>
                          {payment.coach?.name ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {receipt && !isVoided && (
                            <ParentReceiptButton
                              receiptNumber={receipt.receipt_number}
                              issuedAt={receipt.issued_at ?? ""}
                              date={payment.payment_date}
                              studentName={student.name}
                              schoolClass={student.school_class}
                              amount={Number(payment.amount)}
                              month={payment.month}
                              year={payment.year}
                              notes={payment.notes}
                              coachName={payment.coach?.name}
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

        {/* Refunds & Credit Notes */}
        {(refunds ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>退费记录 / Rekod Bayaran Balik</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期 / Tarikh</TableHead>
                    <TableHead>期间 / Tempoh</TableHead>
                    <TableHead className="text-right">金额 / Amaun</TableHead>
                    <TableHead>教练 / Jurulatih</TableHead>
                    <TableHead className="text-right">退费单 / Nota Kredit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(refunds ?? []).map((refund: any) => {
                    const creditNote = (refund.credit_notes as any[])?.[0];
                    return (
                      <TableRow key={refund.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(refund.refund_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {refund.month
                            ? `${refund.year}年${refund.month}月`
                            : `${refund.year}年（全年 / Setahun）`}
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {APP_CONFIG.currency} {Number(refund.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {refund.coach?.name ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {creditNote && !creditNote.voided && (
                            <ParentCreditNoteButton
                              creditNoteNumber={creditNote.credit_note_number}
                              issuedAt={creditNote.issued_at ?? ""}
                              date={refund.refund_date}
                              studentName={student.name}
                              schoolClass={student.school_class}
                              amount={Number(refund.amount)}
                              year={refund.year}
                              month={refund.month}
                              totalPaid={Number(refund.total_paid)}
                              totalSessions={refund.total_sessions}
                              totalDue={Number(refund.total_due)}
                              notes={refund.notes}
                              coachName={refund.coach?.name}
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
          费率 / Kadar: {APP_CONFIG.currency}{APP_CONFIG.feePerSession} / 课 / sesi
        </p>
      </div>
    </div>
  );
}
