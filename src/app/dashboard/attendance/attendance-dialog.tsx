"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO, getDay } from "date-fns";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";

type Session = Tables<"class_sessions">;
type Student = Tables<"students">;

const DAYS_OF_WEEK = [
  "星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六",
];

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
  sessionDate: string; // "yyyy-MM-dd"
  students: Student[];
  onSaved: () => void;
  onDeleted: () => void;
}

export function AttendanceDialog({
  open,
  onOpenChange,
  session,
  sessionDate,
  students,
  onSaved,
  onDeleted,
}: AttendanceDialogProps) {
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [feeExempt, setFeeExempt] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const supabase = createClient();

  const activeStudents = useMemo(
    () => students.filter((s) => s.active !== false),
    [students]
  );

  // Group students by school_class
  const groupedStudents = useMemo(() => {
    const groups = new Map<string, Student[]>();

    activeStudents.forEach((s) => {
      const key = s.school_class || "未分班";
      const group = groups.get(key) ?? [];
      group.push(s);
      groups.set(key, group);
    });

    // Sort groups: named classes first (sorted), "未分班" last
    const entries = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "未分班") return 1;
      if (b[0] === "未分班") return -1;
      return a[0].localeCompare(b[0], "zh");
    });

    // Sort students within each group alphabetically
    entries.forEach(([, group]) => {
      group.sort((a, b) => a.name.localeCompare(b.name, "zh"));
    });

    return entries;
  }, [activeStudents]);

  // Load existing attendance when dialog opens
  useEffect(() => {
    if (!open || !session) {
      // Reset state when dialog closes or no session
      if (!open) {
        setAttendance({});
        setFeeExempt({});
      }
      return;
    }

    async function loadAttendance() {
      setLoadingAttendance(true);
      const map: Record<string, boolean> = {};
      const exemptMap: Record<string, boolean> = {};
      activeStudents.forEach((s) => {
        map[s.id] = false;
        exemptMap[s.id] = false;
      });

      const { data } = await supabase
        .from("attendance")
        .select("student_id, present, fee_exempt")
        .eq("session_id", session!.id);

      data?.forEach((a) => {
        map[a.student_id] = a.present ?? false;
        exemptMap[a.student_id] = a.fee_exempt ?? false;
      });

      setAttendance(map);
      setFeeExempt(exemptMap);
      setLoadingAttendance(false);
    }

    loadAttendance();
  }, [open, session, activeStudents, supabase]);

  const presentCount = Object.values(attendance).filter(Boolean).length;

  function toggleAll(checked: boolean) {
    const updated: Record<string, boolean> = {};
    activeStudents.forEach((s) => (updated[s.id] = checked));
    setAttendance(updated);
  }

  const allChecked = activeStudents.length > 0 && activeStudents.every((s) => attendance[s.id]);

  async function saveAttendance() {
    if (!session) return;
    setSaving(true);

    const records = activeStudents.map((s) => ({
      student_id: s.id,
      session_id: session.id,
      present: attendance[s.id] ?? false,
      fee_exempt: feeExempt[s.id] ?? false,
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(records, { onConflict: "student_id,session_id" });

    if (error) {
      toast.error("保存出勤记录失败");
      setSaving(false);
      return;
    }

    toast.success("出勤记录已保存");
    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  async function deleteSession() {
    if (!session) return;

    // Delete attendance records first
    await supabase.from("attendance").delete().eq("session_id", session.id);

    const { error } = await supabase
      .from("class_sessions")
      .delete()
      .eq("id", session.id);

    if (error) {
      toast.error("删除训练课失败");
      return;
    }

    toast.success("训练课已删除");
    onDeleted();
    onOpenChange(false);
  }

  // Format the dialog title
  const dateObj = parseISO(sessionDate);
  const dayOfWeek = DAYS_OF_WEEK[getDay(dateObj)];
  const titleText = `${sessionDate}（${dayOfWeek}）`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle className="text-base">{titleText}</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive h-8 px-2"
            onClick={deleteSession}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            删除课程
          </Button>
        </DialogHeader>

        {loadingAttendance ? (
          <div className="py-8 text-center text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Select all */}
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
              <span className="text-sm font-medium">全选</span>
            </div>

            {/* Student groups */}
            <TooltipProvider>
              {groupedStudents.map(([className, group]) => (
                <div key={className} className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1 border-b">
                    {className}（{group.length}人）
                  </div>
                  {group.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-3 px-1 py-1.5 rounded hover:bg-accent"
                    >
                      <Checkbox
                        checked={attendance[student.id] ?? false}
                        onCheckedChange={(checked) =>
                          setAttendance({
                            ...attendance,
                            [student.id]: checked === true,
                          })
                        }
                      />
                      <span className="flex-1 text-sm font-medium">
                        {student.name}
                      </span>
                      {student.health_notes && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p className="text-sm">{student.health_notes}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {attendance[student.id] && (
                        <Button
                          variant={feeExempt[student.id] ? "default" : "outline"}
                          size="sm"
                          className="h-6 px-2 text-xs shrink-0"
                          onClick={() =>
                            setFeeExempt({
                              ...feeExempt,
                              [student.id]: !feeExempt[student.id],
                            })
                          }
                          title={feeExempt[student.id] ? "已豁免费用" : "豁免此次费用"}
                        >
                          免
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </TooltipProvider>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={saveAttendance} disabled={saving || loadingAttendance}>
            {saving ? "保存中..." : `保存 (${presentCount}/${activeStudents.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
