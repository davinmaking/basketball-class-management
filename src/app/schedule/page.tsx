import { createClient } from "@/lib/supabase/server";
import { Dribbble, CalendarDays, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_CONFIG } from "@/lib/config";
import { MALAY_MONTHS } from "@/lib/constants";

const DAY_LABELS: Record<number, string> = {
  0: "星期日 / Ahad",
  1: "星期一 / Isnin",
  2: "星期二 / Selasa",
  3: "星期三 / Rabu",
  4: "星期四 / Khamis",
  5: "星期五 / Jumaat",
  6: "星期六 / Sabtu",
};

export default async function SchedulePage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date")
    .order("session_date");

  // Find sessions that have attendance records
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const completedSet = new Set<string>();
  if (sessionIds.length > 0) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("present", true);
    for (const a of attendance ?? []) {
      completedSet.add(a.session_id);
    }
  }

  // Group sessions by month
  const grouped = new Map<string, { date: string; day: number; completed: boolean }[]>();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  for (const s of sessions ?? []) {
    const [year, month] = s.session_date.split("-");
    const key = `${year}-${month}`;
    const d = new Date(s.session_date + "T00:00:00");
    const entry = { date: s.session_date, day: d.getDay(), completed: completedSet.has(s.id) };
    if (grouped.has(key)) {
      grouped.get(key)!.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }

  const totalSessions = sessions?.length ?? 0;

  return (
    <main id="main-content" className="min-h-[100dvh] bg-muted/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
            <Dribbble className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {APP_CONFIG.className}
          </h1>
          <p className="text-sm text-muted-foreground">
            训练时间表 / Jadual Latihan
          </p>
        </div>

        <div className="text-center">
          <Badge variant="secondary" className="text-sm">
            共 {totalSessions} 节课 / Jumlah {totalSessions} sesi
          </Badge>
        </div>

        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([key, dates]) => {
            const [year, month] = key.split("-");
            const monthIdx = parseInt(month) - 1;
            const isPast = key < todayStr.slice(0, 7);

            return (
              <Card key={key} className={isPast ? "text-muted-foreground" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    {year}年{parseInt(month)}月 / {MALAY_MONTHS[monthIdx]} {year}
                    <Badge variant="outline" className="ml-auto text-xs font-normal">
                      {dates.length} 节 / sesi
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-2">
                    {dates.map((d) => {
                      const [y, m, dd] = d.date.split("-");
                      const formatted = `${dd}-${m}-${y}`;
                      const isToday = d.date === todayStr;
                      const isPastDate = d.date < todayStr;

                      return (
                        <div
                          key={d.date}
                          className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                            isToday
                              ? "bg-primary/10 ring-1 ring-primary font-semibold"
                              : d.completed
                              ? "bg-success/10 text-success"
                              : isPastDate
                              ? "bg-muted/30 text-muted-foreground"
                              : "bg-muted/50"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {d.completed && (
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            )}
                            {formatted}（{DAY_LABELS[d.day]}）
                          </span>
                          {isToday && (
                            <Badge className="text-xs">
                              今天 / Hari ini
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {totalSessions === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              暂无训练日期 / Tiada jadual latihan
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
