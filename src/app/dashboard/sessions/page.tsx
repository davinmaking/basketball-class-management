"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ChevronLeft, ChevronRight, Plus, CalendarPlus } from "lucide-react";
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
import { toast } from "sonner";
import { MONTHS } from "@/lib/constants";

type Session = Tables<"class_sessions">;

const DAYS_OF_WEEK = [
  "星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六",
];

const CAL_HEADERS = ["一", "二", "三", "四", "五", "六", "日"];

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [bulkDay, setBulkDay] = useState("6");

  const supabase = createClient();

  const fetchSessions = useCallback(async () => {
    const monthStr = String(selectedMonth + 1).padStart(2, "0");
    const startDate = `${selectedYear}-${monthStr}-01`;
    const endMonth = selectedMonth === 11 ? 1 : selectedMonth + 2;
    const endYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("class_sessions")
      .select("*")
      .gte("session_date", startDate)
      .lt("session_date", endDate)
      .order("session_date");

    if (error) {
      toast.error("加载训练课失败");
      return;
    }
    setSessions(data ?? []);
    setLoading(false);
  }, [supabase, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Session lookup maps
  const sessionMap = useMemo(
    () => new Map(sessions.map((s) => [s.session_date, s])),
    [sessions]
  );

  // Calendar grid: 6 weeks starting from Monday
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));

    // getDay: 0=Sun, 1=Mon ... 6=Sat
    // We want Monday as first column, so offset: Mon=0, Tue=1, ..., Sun=6
    const startDow = getDay(monthStart);
    const mondayOffset = startDow === 0 ? 6 : startDow - 1;
    const gridStart = subDays(monthStart, mondayOffset);

    // Calculate weeks needed: from gridStart to monthEnd
    const daysFromGridStartToMonthEnd =
      Math.ceil((monthEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weeksNeeded = Math.ceil(daysFromGridStartToMonthEnd / 7);
    const totalDays = weeksNeeded * 7;

    const gridEnd = addDays(gridStart, totalDays - 1);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [selectedMonth, selectedYear]);

  const currentMonthDate = new Date(selectedYear, selectedMonth);
  const now = new Date();
  const isCurrentMonth =
    selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  // Month navigation
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

  // Toggle session on/off for a date
  async function toggleSession(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = sessionMap.get(dateStr);

    if (existing) {
      // Delete
      const { error } = await supabase
        .from("class_sessions")
        .delete()
        .eq("id", existing.id);

      if (error) {
        toast.error("删除训练课失败");
        return;
      }
      toast.success("训练课已删除");
    } else {
      // Add
      const { error } = await supabase
        .from("class_sessions")
        .insert({ session_date: dateStr });

      if (error) {
        if (error.code === "23505") {
          toast.error("该日期已存在");
        } else {
          toast.error("添加训练课失败");
        }
        return;
      }
      toast.success("训练课已添加");
    }
    fetchSessions();
  }

  // Keep existing addSession for the dialog (adding dates in other months)
  async function addSession() {
    if (!newDate) return;
    const { error } = await supabase
      .from("class_sessions")
      .insert({ session_date: newDate });

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
    fetchSessions();
  }

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

    const { error } = await supabase
      .from("class_sessions")
      .upsert(dates, { onConflict: "session_date" });

    if (error) {
      toast.error("添加训练课失败");
      return;
    }

    toast.success(`成功添加 ${dates.length} 节训练课`);
    setShowBulk(false);
    fetchSessions();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">训练课</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowBulk(true)} variant="outline" size="sm">
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
          <Button variant="ghost" size="sm" onClick={goToday} className="ml-2">
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
              const hasSession = sessionMap.has(dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => inMonth && toggleSession(day)}
                  disabled={!inMonth}
                  className={`
                    relative aspect-square flex items-center justify-center
                    text-sm border-b border-r transition-colors
                    ${!inMonth
                      ? "text-muted-foreground/25 cursor-default bg-muted/20"
                      : hasSession
                        ? "bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                        : "hover:bg-muted cursor-pointer"
                    }
                    ${today && inMonth ? "ring-2 ring-primary ring-inset" : ""}
                  `}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        点击日期添加或删除训练课
      </p>

      {/* Add single date dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
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

      {/* Bulk add dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
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
