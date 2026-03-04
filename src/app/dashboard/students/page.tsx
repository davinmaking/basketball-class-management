"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Plus, Upload, Search, Pencil, Eye, Link2 } from "lucide-react";
import { AddStudentDialog } from "./add-student-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { EditStudentDialog } from "./edit-student-dialog";
import { toast } from "sonner";

type Student = Tables<"students">;

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

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

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.school_class?.toLowerCase().includes(search.toLowerCase()) ||
      s.parent_name?.toLowerCase().includes(search.toLowerCase())
  );

  function copyViewLink(token: string | null) {
    if (!token) return;
    const url = `${window.location.origin}/view/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("家长链接已复制");
  }

  return (
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索姓名、班级或家长..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
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
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.school_class ?? "-"}</TableCell>
                  <TableCell>{student.parent_name ?? "-"}</TableCell>
                  <TableCell>{student.phone ?? "-"}</TableCell>
                  <TableCell>
                    {student.fee_exempt && (
                      <Badge variant="secondary">免费</Badge>
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
                        title="Edit"
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
  );
}
