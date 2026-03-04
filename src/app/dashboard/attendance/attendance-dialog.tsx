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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseISO, getDay } from "date-fns";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/constants";
import { groupStudentsByClass } from "@/lib/student-groups";

type Session = Tables<"class_sessions"> & {
  coach?: { name: string } | null;
};
type Student = Tables<"students">;

interface AttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
  sessionDate: string; // "yyyy-MM-dd"
  students: Student[];
  coachName?: string | null;
  onSaved: () => void;
  onDeleted: () => void;
}

export function AttendanceDialog({
  open,
  onOpenChange,
  session,
  sessionDate,
  students,
  coachName,
  onSaved,
  onDeleted,
}: AttendanceDialogProps) {
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [feeExempt, setFeeExempt] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const supabase = createClient();

  const activeStudents = useMemo(
    () => students.filter((s) => s.active !== false),
    [students]
  );

  // Group students by school_class using shared utility
  const groupedStudents = useMemo(
    () => groupStudentsByClass(activeStudents),
    [activeStudents]
  );

  // Load existing attendance when dialog opens
  useEffect(() => {
    if (!open || !session) {
      if (!open) {
        setAttendance({});
        setFeeExempt({});
        setDeleteBlocked(false);
      }
      return;
    }

    async function loadAttendance() {
      setLoadingAttendance(true);
      const map: Record<string, boolean> = {};
      const exemptMap: Record<string, boolean> = {};
      activeStudents.forEach((s) => {
        map[s.id] = false;
        // Use students.fee_exempt as default (#5)
        exemptMap[s.id] = s.fee_exempt ?? false;
      });

      const { data } = await supabase
        .from("attendance")
        .select("student_id, present, fee_exempt")
        .eq("session_id", session!.id);

      if (data && data.length > 0) {
        data.forEach((a) => {
          map[a.student_id] = a.present ?? false;
          exemptMap[a.student_id] = a.fee_exempt ?? false;
        });
      }

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

  async function handleDeleteClick() {
    if (!session) return;

    // Guard: check if this session's month has any payments (#3)
    const sessionDate = parseISO(session.session_date);
    const month = sessionDate.getMonth() + 1;
    const year = sessionDate.getFullYear();

    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("month", month)
      .eq("year", year)
      .eq("voided", false);

    if (count && count > 0) {
      setDeleteBlocked(true);
      return;
    }

    setConfirmDelete(true);
  }

  async function deleteSession() {
    if (!session) return;
    setConfirmDelete(false);

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
  const titleText = `${sessionDate}（${dayOfWeek}）${coachName ? ` · ${coachName}` : ""}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle className="text-base">{titleText}</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8 px-2"
              onClick={handleDeleteClick}
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

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除训练课</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 {sessionDate} 的训练课吗？相关出勤记录也会被删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteSession}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete blocked warning */}
      <AlertDialog open={deleteBlocked} onOpenChange={setDeleteBlocked}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>无法删除</AlertDialogTitle>
            <AlertDialogDescription>
              该月份已有付款记录，删除训练课可能影响费用计算。请先处理相关付款记录后再删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>知道了</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
