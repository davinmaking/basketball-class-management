import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, ClipboardCheck, DollarSign } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Get stats
  const [studentsResult, sessionsResult, attendanceResult, paymentsResult] =
    await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
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
        .select("id, present, session:class_sessions!inner(session_date)")
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
        .eq("year", currentYear),
    ]);

  const totalStudents = studentsResult.count ?? 0;
  const monthSessions = sessionsResult.count ?? 0;
  const monthAttendances = attendanceResult.data?.length ?? 0;
  const monthPayments =
    paymentsResult.data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  const stats = [
    {
      title: "Jumlah Pelajar",
      value: totalStudents,
      icon: Users,
      description: "Jumlah keseluruhan",
    },
    {
      title: "Sesi Bulan Ini",
      value: monthSessions,
      icon: Calendar,
      description: `Bulan ${currentMonth}/${currentYear}`,
    },
    {
      title: "Kehadiran Bulan Ini",
      value: monthAttendances,
      icon: ClipboardCheck,
      description: "Jumlah kehadiran",
    },
    {
      title: "Kutipan Bulan Ini",
      value: `RM ${monthPayments.toFixed(2)}`,
      icon: DollarSign,
      description: `Bulan ${currentMonth}/${currentYear}`,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
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
