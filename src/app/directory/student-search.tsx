"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ChevronRight, Users } from "lucide-react";
import { groupStudentsByClass } from "@/lib/student-groups";

type DirectoryStudent = {
  id: string;
  name: string;
  school_class: string | null;
  view_token: string | null;
};

export function StudentDirectory({
  students,
}: {
  students: DirectoryStudent[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, search]);

  const grouped = useMemo(() => groupStudentsByClass(filtered), [filtered]);

  return (
    <>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="搜索学生姓名 / Cari nama pelajar"
          placeholder="搜索学生姓名 / Cari nama pelajar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        共 {filtered.length} 名学生 / {filtered.length} pelajar
        {search &&
          filtered.length !== students.length &&
          `（从 ${students.length} 名中筛选）`}
      </p>

      {/* Grouped student list */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="rounded-full bg-muted p-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">
              {search
                ? "未找到学生 / Pelajar tidak dijumpai"
                : "暂无学生 / Tiada pelajar"}
            </p>
            {search && (
              <p className="text-xs text-muted-foreground mt-0.5">
                试试其他关键词 / Cuba kata kunci lain
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([className, classStudents]) => (
            <Card key={className}>
              <div className="px-4 pt-3 pb-2 border-b border-l-2 border-l-primary/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {className}（{classStudents.length}人）
                </p>
              </div>
              <CardContent className="p-0">
                <div className="divide-y">
                  {classStudents.map((student) => (
                    <Link
                      key={student.id}
                      href={`/view/${student.view_token}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors"
                    >
                      <span className="font-medium text-sm">
                        {student.name}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
