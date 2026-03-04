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
import { Plus, Upload, Search, Pencil, Link2, Users } from "lucide-react";
import { AddStudentDialog } from "./add-student-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { EditStudentDialog } from "./edit-student-dialog";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/phone";

type Student = Tables<"students">;

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
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
    if (!token) return;
    const url = `${window.location.origin}/view/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("家长链接已复制");
  }

  return (
    <TooltipProvider>
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">学生</h1>
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

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>班级</TableHead>
                <TableHead>家长</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {search ? "未找到学生" : "还没有学生。添加第一个学生吧！"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((student) => (
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
                    <TableCell>
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
                          onClick={() => copyViewLink(student.view_token)}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="编辑"
                          onClick={() => setEditingStudent(student)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
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
      </div>
    </TooltipProvider>
  );
}
