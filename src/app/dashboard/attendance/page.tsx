"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  ExternalLink,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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
  session_coaches: { coach: { id: string; name: string } }[];
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
  const [newCoachIds, setNewCoachIds] = useState<string[]>([]);

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
      .select("*, session_coaches(coach:coaches(id, name))")
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
      .insert({ session_date: dateStr })
      .select("*, session_coaches(coach:coaches(id, name))")
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("该日期已存在");
      } else {
        toast.error("创建训练课失败");
      }
      return;
    }

    // Insert coach assignments
    if (newCoachIds.length > 0) {
      await supabase.from("session_coaches").insert(
        newCoachIds.map((cid) => ({ session_id: data.id, coach_id: cid }))
      );
    }

    await fetchData();
    // Re-fetch the session with coaches populated
    const { data: refreshed } = await supabase
      .from("class_sessions")
      .select("*, session_coaches(coach:coaches(id, name))")
      .eq("id", data.id)
      .single();
    setDialogSession(refreshed ?? data);
    setDialogDate(dateStr);
    setDialogOpen(true);
  }

  // ── Add single date (for dates in other months) ────────

  async function addSession() {
    if (!newDate) return;
    const { data, error } = await supabase
      .from("class_sessions")
      .insert({ session_date: newDate })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("该日期已存在");
      } else {
        toast.error("添加训练课失败");
      }
      return;
    }

    // Insert coach assignments
    if (newCoachIds.length > 0 && data) {
      await supabase.from("session_coaches").insert(
        newCoachIds.map((cid) => ({ session_id: data.id, coach_id: cid }))
      );
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
    }));

    if (dates.length === 0) {
      toast.error("没有匹配的日期");
      return;
    }

    const { data: insertedSessions, error } = await supabase
      .from("class_sessions")
      .upsert(dates, { onConflict: "session_date" })
      .select("id");

    if (error) {
      toast.error("添加训练课失败");
      return;
    }

    // Insert coach assignments for all new sessions
    if (newCoachIds.length > 0 && insertedSessions && insertedSessions.length > 0) {
      const coachRows = insertedSessions.flatMap((s) =>
        newCoachIds.map((cid) => ({ session_id: s.id, coach_id: cid }))
      );
      await supabase
        .from("session_coaches")
        .upsert(coachRows, { onConflict: "session_id,coach_id" });
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
        <h1 className="text-2xl font-bold tracking-tight">出勤</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/schedule", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            家长时间表
          </Button>
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

      {/* Main content: side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row-reverse lg:gap-6 lg:items-start">

        {/* Calendar section — top on mobile, right on desktop */}
        <div className="lg:w-[340px] lg:shrink-0">
          {/* Month navigation */}
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[120px] text-center">
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
                className="ml-1"
              >
                今天
              </Button>
            )}
          </div>

          {/* Calendar grid */}
          <div className="border rounded-lg overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {CAL_HEADERS.map((d) => (
                <div
                  key={d}
                  className="py-1.5 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            {loading ? (
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square p-1">
                    <Skeleton className="h-full w-full rounded" />
                  </div>
                ))}
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

                  const coachNames = session?.session_coaches
                    ?.map((sc) => sc.coach?.name)
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <button
                      key={dateStr}
                      onClick={() => inMonth && handleDateClick(day)}
                      disabled={!inMonth}
                      className={`
                        relative aspect-square flex flex-col items-center justify-center
                        text-xs border-b border-r transition-colors
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
                      {coachNames && inMonth && (
                        <span className={`text-[9px] leading-tight truncate max-w-full px-0.5 ${
                          hasAttendance ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}>
                          {coachNames}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 mb-4 lg:mb-0">
            <p className="text-xs text-muted-foreground">
              点击日期记录出勤
            </p>
            <span className="text-xs text-muted-foreground">
              本月 {sessions.length} 节课
            </span>
          </div>
        </div>

        {/* Summary section — below on mobile, left on desktop */}
        <div className="flex-1 min-w-0">
          {!loading && sessions.length > 0 && activeStudents.length > 0 && (
            <Card>
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
        </div>

      </div>

      {/* Attendance Dialog */}
      <AttendanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={dialogSession}
        sessionDate={dialogDate}
        students={students}
        coaches={coaches}
        onSaved={() => fetchData()}
        onDeleted={() => fetchData()}
      />

      {/* Add single date dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => {
        setShowAdd(open);
        if (!open) setNewCoachIds([]);
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
            <CoachMultiSelect
              coaches={coaches}
              selectedIds={newCoachIds}
              onChange={setNewCoachIds}
            />
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
            setNewCoachIds([]);
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
          <CoachMultiSelect
            coaches={coaches}
            selectedIds={newCoachIds}
            onChange={setNewCoachIds}
          />
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
        if (!open) setNewCoachIds([]);
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
            <CoachMultiSelect
              coaches={coaches}
              selectedIds={newCoachIds}
              onChange={setNewCoachIds}
            />
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

// ── Coach multi-select component ──────────────────────────

function CoachMultiSelect({
  coaches,
  selectedIds,
  onChange,
}: {
  coaches: Coach[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  if (coaches.length === 0) return null;

  function toggle(coachId: string) {
    if (selectedIds.includes(coachId)) {
      onChange(selectedIds.filter((id) => id !== coachId));
    } else {
      onChange([...selectedIds, coachId]);
    }
  }

  return (
    <div className="space-y-2">
      <Label>负责教练</Label>
      <div className="space-y-1">
        {coaches.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
          >
            <Checkbox
              checked={selectedIds.includes(c.id)}
              onCheckedChange={() => toggle(c.id)}
            />
            <span className="text-sm">{c.name}</span>
          </label>
        ))}
      </div>
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
