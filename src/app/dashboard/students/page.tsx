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
      toast.error("Gagal memuatkan senarai pelajar");
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
    toast.success("Pautan ibu bapa telah disalin");
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Pelajar</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowCsv(true)} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setShowAdd(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Pelajar
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, kelas, atau ibu bapa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Ibu Bapa</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Memuatkan...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {search ? "Tiada pelajar ditemui" : "Belum ada pelajar. Tambah pelajar pertama!"}
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
                      <Badge variant="secondary">Dikecualikan Yuran</Badge>
                    )}
                    {student.health_notes && (
                      <Badge variant="outline" className="ml-1">
                        Nota Kesihatan
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Salin pautan ibu bapa"
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
        {filtered.length} pelajar {search && `(ditapis dari ${students.length})`}
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
