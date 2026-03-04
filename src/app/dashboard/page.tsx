import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, ClipboardCheck, DollarSign } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Get stats
  const [studentsResult, sessionsResult, attendanceResult, paymentsResult] =
    await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .gte("session_date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`)
        .lt(
          "session_date",
          currentMonth === 12
            ? `${currentYear + 1}-01-01`
            : `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`
        ),
      supabase
        .from("attendance")
        .select("*, session:class_sessions!inner(session_date)", { count: "exact", head: true })
        .eq("present", true)
        .gte("class_sessions.session_date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`)
        .lt(
          "class_sessions.session_date",
          currentMonth === 12
            ? `${currentYear + 1}-01-01`
            : `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`
        ),
      supabase
        .from("payments")
        .select("amount")
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .eq("voided", false),
    ]);

  const totalStudents = studentsResult.count ?? 0;
  const monthSessions = sessionsResult.count ?? 0;
  const monthAttendances = attendanceResult.count ?? 0;
  const monthPayments =
    paymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const stats = [
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
      value: monthAttendances,
      icon: ClipboardCheck,
      description: "总出勤次数",
    },
    {
      title: "本月收款",
      value: `${APP_CONFIG.currency} ${monthPayments.toFixed(2)}`,
      icon: DollarSign,
      description: `${currentYear}年${currentMonth}月`,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">仪表盘</h1>
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
              <div className="text-2xl font-bold">{stat.value}</div>
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
