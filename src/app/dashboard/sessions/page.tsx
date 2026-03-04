"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Plus, Trash2, CalendarPlus } from "lucide-react";
import { format, parseISO, getDay, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

type Session = Tables<"class_sessions">;

const MONTHS = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
];

const DAYS_OF_WEEK = [
  "星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六",
];

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [bulkDay, setBulkDay] = useState("6"); // Saturday default

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

  async function deleteSession(id: string) {
    const { error } = await supabase
      .from("class_sessions")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("删除训练课失败");
      return;
    }

    toast.success("训练课已删除");
    fetchSessions();
  }

  return (
    <div>
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

      <div className="flex gap-3 mb-6">
        <Select
          value={String(selectedMonth)}
          onValueChange={(v) => setSelectedMonth(Number(v))}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((month, idx) => (
              <SelectItem key={idx} value={String(idx)}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2025, 2026, 2027].map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {MONTHS[selectedMonth]} {selectedYear} — {sessions.length} 节课
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">加载中...</p>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground">
              本月没有训练课。添加训练日期吧！
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const date = parseISO(session.session_date);
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <span className="font-medium">
                        {format(date, "d MMMM yyyy (EEEE)", { locale: zhCN })}
                      </span>
                      {session.notes && (
                        <span className="text-sm text-muted-foreground ml-2">
                          — {session.notes}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSession(session.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
              添加 {selectedYear} 年{MONTHS[selectedMonth]}的所有指定星期
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
