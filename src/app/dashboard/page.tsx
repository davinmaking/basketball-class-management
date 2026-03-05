import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, ClipboardCheck, DollarSign, Undo2, Banknote } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Get stats
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const monthEnd =
    currentMonth === 12
      ? `${currentYear + 1}-01-01`
      : `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;

  const [studentsResult, sessionsResult, attendanceResult, chargeableResult, paymentsResult, refundsResult] =
    await Promise.all([
      supabase.from("students").select("id, name, school_class").eq("active", true).order("name"),
      supabase
        .from("class_sessions")
        .select("id")
        .gte("session_date", monthStart)
        .lt("session_date", monthEnd),
      supabase
        .from("attendance")
        .select("student_id, session:class_sessions!inner(session_date)")
        .eq("present", true)
        .gte("class_sessions.session_date", monthStart)
        .lt("class_sessions.session_date", monthEnd),
      supabase
        .from("attendance")
        .select("student_id, session:class_sessions!inner(session_date)")
        .eq("present", true)
        .eq("fee_exempt", false)
        .gte("class_sessions.session_date", monthStart)
        .lt("class_sessions.session_date", monthEnd),
      supabase
        .from("payments")
        .select("student_id, amount")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("voided", false),
      supabase
        .from("refunds")
        .select("amount")
        .eq("year", currentYear)
        .eq("voided", false),
    ]);

  const students = studentsResult.data ?? [];
  const totalStudents = students.length;
  const monthSessions = (sessionsResult.data ?? []).length;
  const monthAttendances = (attendanceResult.data ?? []).length;
  const chargeableAttendances = (chargeableResult.data ?? []).length;
  const monthPaymentsTotal =
    paymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const yearRefunds =
    refundsResult.data?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;

  const totalPossible = totalStudents * monthSessions;
  const attendanceRate =
    totalPossible > 0
      ? Math.round((monthAttendances / totalPossible) * 100)
      : 0;
  const monthDue = chargeableAttendances * APP_CONFIG.feePerSession;

  // Per-student chargeable attendance counts
  const chargeableCounts: Record<string, number> = {};
  (chargeableResult.data ?? []).forEach((a) => {
    chargeableCounts[a.student_id] = (chargeableCounts[a.student_id] ?? 0) + 1;
  });

  // Per-student payment sums
  const paymentSums: Record<string, number> = {};
  (paymentsResult.data ?? []).forEach((p) => {
    paymentSums[p.student_id] = (paymentSums[p.student_id] ?? 0) + Number(p.amount);
  });

  // Outstanding students: balance < 0
  const outstandingStudents = students
    .map((s) => {
      const due = (chargeableCounts[s.id] ?? 0) * APP_CONFIG.feePerSession;
      const paid = paymentSums[s.id] ?? 0;
      return { ...s, due, paid, balance: paid - due };
    })
    .filter((s) => s.balance < 0)
    .sort((a, b) => a.balance - b.balance);

  const stats: {
    title: string;
    value: string | number;
    icon: typeof Users;
    description: string;
  }[] = [
    {
      title: "学生总数",
      value: totalStudents,
      icon: Users,
      description: "活跃学生",
    },
    {
      title: "本月训练课",
      value: monthSessions,
      icon: Calendar,
      description: `${currentYear}年${currentMonth}月`,
    },
    {
      title: "本月出勤",
      value: `${attendanceRate}%`,
      icon: ClipboardCheck,
      description: `${monthAttendances} / ${totalPossible} 次`,
    },
    {
      title: "本月应缴付",
      value: `${APP_CONFIG.currency} ${monthDue.toFixed(2)}`,
      icon: Banknote,
      description: `${chargeableAttendances} 次 × ${APP_CONFIG.currency}${APP_CONFIG.feePerSession}`,
    },
    {
      title: "本月收款",
      value: `${APP_CONFIG.currency} ${monthPaymentsTotal.toFixed(2)}`,
      icon: DollarSign,
      description: `${currentYear}年${currentMonth}月`,
    },
  ];

  if (yearRefunds > 0) {
    stats.push({
      title: "本年退费",
      value: `${APP_CONFIG.currency} ${yearRefunds.toFixed(2)}`,
      icon: Undo2,
      description: `${currentYear}年`,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">仪表盘</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outstanding Students */}
      {outstandingStudents.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              本月欠费学生
            </CardTitle>
            <Badge variant="destructive" className="tabular-nums">
              {outstandingStudents.length} 人
            </Badge>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead className="text-right">应缴</TableHead>
                  <TableHead className="text-right">已付</TableHead>
                  <TableHead className="text-right">欠费</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.school_class || "-"}</TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {APP_CONFIG.currency} {s.due.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {APP_CONFIG.currency} {s.paid.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap text-destructive font-medium">
                      {APP_CONFIG.currency} {s.balance.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
