import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .gte("session_date", monthStart)
        .lt("session_date", monthEnd),
      supabase
        .from("attendance")
        .select("*, session:class_sessions!inner(session_date)", { count: "exact", head: true })
        .eq("present", true)
        .gte("class_sessions.session_date", monthStart)
        .lt("class_sessions.session_date", monthEnd),
      supabase
        .from("attendance")
        .select("*, session:class_sessions!inner(session_date)", { count: "exact", head: true })
        .eq("present", true)
        .eq("fee_exempt", false)
        .gte("class_sessions.session_date", monthStart)
        .lt("class_sessions.session_date", monthEnd),
      supabase
        .from("payments")
        .select("amount")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("voided", false),
      supabase
        .from("refunds")
        .select("amount")
        .eq("year", currentYear)
        .eq("voided", false),
    ]);

  const totalStudents = studentsResult.count ?? 0;
  const monthSessions = sessionsResult.count ?? 0;
  const monthAttendances = attendanceResult.count ?? 0;
  const chargeableAttendances = chargeableResult.count ?? 0;
  const monthPayments =
    paymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const yearRefunds =
    refundsResult.data?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;

  const totalPossible = totalStudents * monthSessions;
  const attendanceRate =
    totalPossible > 0
      ? Math.round((monthAttendances / totalPossible) * 100)
      : 0;
  const monthDue = chargeableAttendances * APP_CONFIG.feePerSession;

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
      value: `${APP_CONFIG.currency} ${monthPayments.toFixed(2)}`,
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
    </div>
  );
}
