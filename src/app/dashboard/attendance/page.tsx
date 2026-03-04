"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarPlus,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  subDays,
  addDays,
  isSameMonth,
  isToday,
} from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MONTHS, DAYS_OF_WEEK } from "@/lib/constants";
import { groupStudentsByClass } from "@/lib/student-groups";
import { AttendanceDialog } from "./attendance-dialog";

type Session = Tables<"class_sessions"> & {
  coach: { name: string } | null;
};
type Student = Tables<"students">;
type Coach = Tables<"coaches">;

const CAL_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];

export default function AttendancePage() {
  const now = new Date();

  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Data
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceBySession, setAttendanceBySession] = useState<
    Map<string, Set<string>>
  >(new Map());

  // Attendance dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSession, setDialogSession] = useState<Session | null>(null);
  const [dialogDate, setDialogDate] = useState("");

  // Bulk/single add dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [bulkDay, setBulkDay] = useState("6");
  const [newCoachId, setNewCoachId] = useState<string>("");

  // Coaches
  const [coaches, setCoaches] = useState<Coach[]>([]);

  // Summary
  const [summaryAttendance, setSummaryAttendance] = useState<
    Map<string, number>
  >(new Map());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  const [loading, setLoading] = useState(true);
  const [confirmCreateDate, setConfirmCreateDate] = useState<Date | null>(null);

  const supabase = createClient();

  // Session lookup
  const sessionMap = useMemo(
    () => new Map(sessions.map((s) => [s.session_date, s])),
    [sessions]
  );

  // Set of session IDs that have at least one attendance record
  const sessionsWithAttendance = useMemo(() => {
    const set = new Set<string>();
    attendanceBySession.forEach((studentSet, sessionId) => {
      if (studentSet.size > 0) set.add(sessionId);
    });
    return set;
  }, [attendanceBySession]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
    const startDow = getDay(monthStart);
    const mondayOffset = startDow === 0 ? 6 : startDow - 1;
    const gridStart = subDays(monthStart, mondayOffset);
    const daysFromGridStartToMonthEnd =
      Math.ceil(
        (monthEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    const weeksNeeded = Math.ceil(daysFromGridStartToMonthEnd / 7);
    const totalDays = weeksNeeded * 7;
    const gridEnd = addDays(gridStart, totalDays - 1);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [selectedMonth, selectedYear]);

  const currentMonthDate = new Date(selectedYear, selectedMonth);
  const isCurrentMonth =
    selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  // Active students
  const activeStudents = useMemo(
    () => students.filter((s) => s.active !== false),
    [students]
  );

  // Grouped students for summary (same grouping as dialog)
  const groupedStudents = useMemo(
    () => groupStudentsByClass(activeStudents),
    [activeStudents]
  );

  // ── Data fetching ──────────────────────────────────────

  // Students and coaches are independent of month - fetch once
  const fetchStudents = useCallback(async () => {
    const { data } = await supabase.from("students").select("*").order("name");
    setStudents(data ?? []);
  }, [supabase]);

  const fetchCoaches = useCallback(async () => {
    const { data } = await supabase
      .from("coaches")
      .select("*")
      .eq("active", true)
      .order("name");
    setCoaches(data ?? []);
  }, [supabase]);

  useEffect(() => {
    fetchStudents();
    fetchCoaches();
  }, [fetchStudents, fetchCoaches]);

  const fetchData = useCallback(async () => {
    const monthStr = String(selectedMonth + 1).padStart(2, "0");
    const startDate = `${selectedYear}-${monthStr}-01`;
    const endMonth = selectedMonth === 11 ? 1 : selectedMonth + 2;
    const endYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const sessionsRes = await supabase
      .from("class_sessions")
      .select("*, coach:coaches(name)")
      .gte("session_date", startDate)
      .lt("session_date", endDate)
      .order("session_date");

    const sessionsData = sessionsRes.data ?? [];

    setSessions(sessionsData);

    // Fetch attendance for all sessions in this month
    const sessionIds = sessionsData.map((s) => s.id);
    if (sessionIds.length > 0) {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("session_id, student_id, present")
        .in("session_id", sessionIds)
        .eq("present", true);

      // Build per-session attendance set (for calendar indicators)
      const bySession = new Map<string, Set<string>>();
      // Build per-student attendance count (for summary)
      const studentCounts = new Map<string, number>();

      (attendanceData ?? []).forEach((a) => {
        // Per-session
        const set = bySession.get(a.session_id) ?? new Set();
        set.add(a.student_id);
        bySession.set(a.session_id, set);

        // Per-student
        studentCounts.set(
          a.student_id,
          (studentCounts.get(a.student_id) ?? 0) + 1
        );
      });

      setAttendanceBySession(bySession);
      setSummaryAttendance(studentCounts);
    } else {
      setAttendanceBySession(new Map());
      setSummaryAttendance(new Map());
    }

    setLoading(false);
  }, [supabase, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Month navigation ──────────────────────────────────

  function prevMonth() {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  function goToday() {
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
  }

  // ── Click date → open attendance dialog ────────────────

  function handleDateClick(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    const session = sessionMap.get(dateStr) ?? null;

    if (!session) {
      // Confirm before creating a new session
      setConfirmCreateDate(date);
      return;
    }

    setDialogSession(session);
    setDialogDate(dateStr);
    setDialogOpen(true);
  }

  async function confirmCreateSession() {
    if (!confirmCreateDate) return;
    const dateStr = format(confirmCreateDate, "yyyy-MM-dd");
    setConfirmCreateDate(null);

    const { data, error } = await supabase
      .from("class_sessions")
      .insert({
        session_date: dateStr,
        coach_id: newCoachId && newCoachId !== "none" ? newCoachId : null,
      })
      .select("*, coach:coaches(name)")
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("该日期已存在");
      } else {
        toast.error("创建训练课失败");
      }
      return;
    }

    await fetchData();
    setDialogSession(data);
    setDialogDate(dateStr);
    setDialogOpen(true);
  }

  // ── Add single date (for dates in other months) ────────

  async function addSession() {
    if (!newDate) return;
    const { error } = await supabase
      .from("class_sessions")
      .insert({ session_date: newDate, coach_id: newCoachId || null });

    if (error) {
      if (error.code === "23505") {
        toast.error("该日期已存在");
      } else {
        toast.error("添加训练课失败");
      }
      return;
    }

    toast.success("训练课已添加");
    setNewDate("");
    setShowAdd(false);
    fetchData();
  }

  // ── Bulk add sessions ──────────────────────────────────

  async function bulkAddSessions() {
    const dayOfWeek = parseInt(bulkDay);
    const start = startOfMonth(new Date(selectedYear, selectedMonth));
    const end = endOfMonth(new Date(selectedYear, selectedMonth));
    const allDays = eachDayOfInterval({ start, end });
    const matchingDays = allDays.filter((d) => getDay(d) === dayOfWeek);

    const dates = matchingDays.map((d) => ({
      session_date: format(d, "yyyy-MM-dd"),
      coach_id: newCoachId && newCoachId !== "none" ? newCoachId : null,
    }));

    if (dates.length === 0) {
      toast.error("没有匹配的日期");
      return;
    }

    const { error } = await supabase
      .from("class_sessions")
      .upsert(dates, { onConflict: "session_date" });

    if (error) {
      toast.error("添加训练课失败");
      return;
    }

    toast.success(`成功添加 ${dates.length} 节训练课`);
    setShowBulk(false);
    fetchData();
  }

  // ── Toggle group collapse ──────────────────────────────

  function toggleGroup(groupName: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">出勤</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowBulk(true)}
            variant="outline"
            size="sm"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            批量添加
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            添加日期
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-[140px] text-center">
          {selectedYear}年{MONTHS[selectedMonth]}
        </h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentMonth && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="ml-2"
          >
            今天
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          本月 {sessions.length} 节课
        </span>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {CAL_HEADERS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-sm font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, currentMonthDate);
              const today = isToday(day);
              const session = sessionMap.get(dateStr);
              const hasSession = !!session;
              const hasAttendance =
                hasSession && sessionsWithAttendance.has(session.id);

              const coachName = session?.coach?.name;

              return (
                <button
                  key={dateStr}
                  onClick={() => inMonth && handleDateClick(day)}
                  disabled={!inMonth}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center
                    text-sm border-b border-r transition-colors
                    ${
                      !inMonth
                        ? "text-muted-foreground/25 cursor-default bg-muted/20"
                        : hasAttendance
                        ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                        : hasSession
                        ? "bg-primary/20 text-primary font-semibold hover:bg-primary/30"
                        : "hover:bg-muted cursor-pointer"
                    }
                    ${today && inMonth ? "ring-2 ring-primary ring-inset" : ""}
                  `}
                >
                  {day.getDate()}
                  {coachName && inMonth && (
                    <span className={`text-[10px] leading-tight truncate max-w-full px-0.5 ${
                      hasAttendance ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}>
                      {coachName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        点击日期记录出勤，再次点击查看/修改出勤记录
      </p>

      {/* Monthly Summary */}
      {!loading && sessions.length > 0 && activeStudents.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              {selectedYear}年{MONTHS[selectedMonth]} 月度汇总
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead className="text-center">出勤</TableHead>
                  <TableHead className="text-center">总课</TableHead>
                  <TableHead className="text-center">出勤率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedStudents.map(([className, group]) => {
                  const isCollapsed = collapsedGroups.has(className);
                  return (
                    <GroupRows
                      key={className}
                      className={className}
                      students={group}
                      totalSessions={sessions.length}
                      summaryAttendance={summaryAttendance}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleGroup(className)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Attendance Dialog */}
      <AttendanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={dialogSession}
        sessionDate={dialogDate}
        students={students}
        coachName={dialogSession?.coach?.name}
        onSaved={() => fetchData()}
        onDeleted={() => fetchData()}
      />

      {/* Add single date dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => {
        setShowAdd(open);
        if (!open) setNewCoachId("");
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>添加训练日期</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>日期</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            {coaches.length > 0 && (
              <div className="space-y-2">
                <Label>负责教练</Label>
                <Select value={newCoachId} onValueChange={setNewCoachId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择教练（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不指定</SelectItem>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                取消
              </Button>
              <Button onClick={addSession} disabled={!newDate}>
                添加
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm session creation */}
      <AlertDialog
        open={!!confirmCreateDate}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmCreateDate(null);
            setNewCoachId("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>添加训练课</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCreateDate && `${format(confirmCreateDate, "yyyy-MM-dd")}（${DAYS_OF_WEEK[getDay(confirmCreateDate)]}）尚未安排训练课。是否创建并记录出勤？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {coaches.length > 0 && (
            <div className="space-y-2">
              <Label>负责教练</Label>
              <Select value={newCoachId} onValueChange={setNewCoachId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择教练（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {coaches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCreateSession}>
              创建
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk add dialog */}
      <Dialog open={showBulk} onOpenChange={(open) => {
        setShowBulk(open);
        if (!open) setNewCoachId("");
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>批量添加训练课</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              添加 {selectedYear}年{MONTHS[selectedMonth]}的所有指定星期
            </p>
            <div className="space-y-2">
              <Label>星期</Label>
              <Select value={bulkDay} onValueChange={setBulkDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {coaches.length > 0 && (
              <div className="space-y-2">
                <Label>负责教练</Label>
                <Select value={newCoachId} onValueChange={setNewCoachId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择教练（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不指定</SelectItem>
                    {coaches.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowBulk(false)}>
                取消
              </Button>
              <Button onClick={bulkAddSessions}>添加</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Summary group rows component ─────────────────────────

function GroupRows({
  className,
  students,
  totalSessions,
  summaryAttendance,
  isCollapsed,
  onToggle,
}: {
  className: string;
  students: Student[];
  totalSessions: number;
  summaryAttendance: Map<string, number>;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Group header row */}
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell colSpan={5} className="py-2">
          <div className="flex items-center gap-1 text-sm font-semibold">
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {className}（{students.length}人）
          </div>
        </TableCell>
      </TableRow>

      {/* Student rows */}
      {!isCollapsed &&
        students.map((student) => {
          const attended = summaryAttendance.get(student.id) ?? 0;
          const rate =
            totalSessions > 0
              ? Math.round((attended / totalSessions) * 100)
              : 0;
          return (
            <TableRow key={student.id}>
              <TableCell className="pl-8 font-medium">
                {student.name}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {student.school_class ?? "-"}
              </TableCell>
              <TableCell className="text-center">{attended}</TableCell>
              <TableCell className="text-center">{totalSessions}</TableCell>
              <TableCell className="text-center">
                {totalSessions > 0 ? `${rate}%` : "-"}
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}
