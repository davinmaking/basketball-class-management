"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Upload, Search, Pencil, Link2, Users, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AddStudentDialog } from "./add-student-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { EditStudentDialog } from "./edit-student-dialog";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/phone";
import { groupStudentsByClass } from "@/lib/student-groups";

type Student = Tables<"students">;

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const supabase = createClient();

  const fetchStudents = useCallback(async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("name");
    if (error) {
      toast.error("加载学生列表失败");
      return;
    }
    setStudents(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = students
    .filter((s) => showInactive || s.active !== false)
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.school_class?.toLowerCase().includes(search.toLowerCase()) ||
        s.parent_name?.toLowerCase().includes(search.toLowerCase())
    );

  // Group filtered students by school_class using shared utility
  const groupedFiltered = useMemo(
    () =>
      groupStudentsByClass(filtered).map(([className, studs]) => ({
        className,
        students: studs,
      })),
    [filtered]
  );

  // Build sibling groups by phone number
  const siblingGroups = useMemo(() => {
    const phoneToStudents = new Map<string, Student[]>();
    students.forEach((student) => {
      const phone = normalizePhone(student.phone);
      if (!phone) return;
      const existing = phoneToStudents.get(phone) || [];
      existing.push(student);
      phoneToStudents.set(phone, existing);
    });

    const siblingMap = new Map<string, Student[]>();
    phoneToStudents.forEach((group) => {
      if (group.length < 2) return;
      group.forEach((student) => {
        siblingMap.set(
          student.id,
          group.filter((s) => s.id !== student.id)
        );
      });
    });
    return siblingMap;
  }, [students]);

  const inactiveCount = students.filter((s) => s.active === false).length;

  function copyViewLink(token: string | null) {
    if (!token) {
      toast.error("该学生没有查看链接，请编辑学生信息生成链接");
      return;
    }
    const url = `${window.location.origin}/view/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("家长链接已复制");
  }

  async function handleDelete() {
    if (!deletingStudent) return;

    const [attendance, payments, refunds] = await Promise.all([
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("student_id", deletingStudent.id),
      supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("student_id", deletingStudent.id),
      supabase
        .from("refunds")
        .select("id", { count: "exact", head: true })
        .eq("student_id", deletingStudent.id),
    ]);

    const linkedCount =
      (attendance.count ?? 0) + (payments.count ?? 0) + (refunds.count ?? 0);

    if (linkedCount > 0) {
      toast.error(
        `无法删除，该学生有 ${linkedCount} 条关联记录（出勤/缴费/退费）。请改用停用功能。`
      );
      setDeletingStudent(null);
      return;
    }

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", deletingStudent.id);
    if (error) {
      toast.error("删除学生失败");
      setDeletingStudent(null);
      return;
    }
    toast.success("学生已删除");
    setDeletingStudent(null);
    fetchStudents();
  }

  return (
    <TooltipProvider>
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold tracking-tight">学生</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowCsv(true)} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              导入CSV
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              添加学生
            </Button>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索姓名、班级或家长..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {inactiveCount > 0 && (
            <Button
              variant={showInactive ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? "隐藏非活跃" : `显示非活跃 (${inactiveCount})`}
            </Button>
          )}
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>班级</TableHead>
                <TableHead>家长</TableHead>
                <TableHead>电话</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-12 mx-auto rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="rounded-full bg-muted p-3">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{search ? "未找到学生" : "还没有学生"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {search ? "试试其他关键词" : "添加第一个学生来开始管理"}
                        </p>
                      </div>
                      {!search && (
                        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
                          <Plus className="h-4 w-4 mr-1" />
                          添加学生
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groupedFiltered.map((group) => (
                  <GroupedStudentRows
                    key={group.className}
                    group={group}
                    siblingGroups={siblingGroups}
                    onCopyLink={copyViewLink}
                    onEdit={setEditingStudent}
                    onDelete={setDeletingStudent}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-2 text-sm text-muted-foreground">
          {filtered.length} 名学生 {search && `（从 ${students.length} 名中筛选）`}
        </div>

        <AddStudentDialog
          open={showAdd}
          onOpenChange={setShowAdd}
          onSuccess={fetchStudents}
        />

        <CsvImportDialog
          open={showCsv}
          onOpenChange={setShowCsv}
          onSuccess={fetchStudents}
        />

        {editingStudent && (
          <EditStudentDialog
            student={editingStudent}
            open={!!editingStudent}
            onOpenChange={(open) => !open && setEditingStudent(null)}
            onSuccess={fetchStudents}
          />
        )}

        <AlertDialog
          open={!!deletingStudent}
          onOpenChange={(open) => !open && setDeletingStudent(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除学生「{deletingStudent?.name}」吗？此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

// ── Grouped student rows ─────────────────────────────────

function GroupedStudentRows({
  group,
  siblingGroups,
  onCopyLink,
  onEdit,
  onDelete,
}: {
  group: { className: string; students: Student[] };
  siblingGroups: Map<string, Student[]>;
  onCopyLink: (token: string | null) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}) {
  return (
    <>
      {/* Group header */}
      <TableRow className="bg-muted/40">
        <TableCell colSpan={6} className="py-1.5 border-l-2 border-l-primary/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {group.className}（{group.students.length}人）
          </span>
        </TableCell>
      </TableRow>

      {/* Student rows */}
      {group.students.map((student) => (
        <TableRow key={student.id} className={student.active === false ? "opacity-60" : ""}>
          <TableCell className="font-medium">
            {student.name}
            {siblingGroups.has(student.id) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 ml-2 text-blue-600 cursor-default">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      兄弟姐妹({siblingGroups.get(student.id)!.length})
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm font-medium">兄弟姐妹:</p>
                  {siblingGroups.get(student.id)!.map((sibling) => (
                    <p key={sibling.id} className="text-sm">
                      {sibling.name}
                      {sibling.school_class && ` (${sibling.school_class})`}
                    </p>
                  ))}
                </TooltipContent>
              </Tooltip>
            )}
          </TableCell>
          <TableCell>{student.school_class ?? "-"}</TableCell>
          <TableCell>
            {student.parent_name ?? "-"}
            {student.relationship && (
              <span className="text-muted-foreground ml-1">
                ({student.relationship})
              </span>
            )}
          </TableCell>
          <TableCell>{student.phone ?? "-"}</TableCell>
          <TableCell className="text-center">
            {student.active === false && (
              <Badge variant="destructive" className="mr-1">非活跃</Badge>
            )}
            {student.health_notes && (
              <Badge variant="outline" className="ml-1">
                健康备注
              </Badge>
            )}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="复制家长链接"
                onClick={() => onCopyLink(student.view_token)}
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="编辑"
                onClick={() => onEdit(student)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="删除"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(student)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
