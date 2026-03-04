"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ms } from "date-fns/locale";
import { toast } from "sonner";
import { Save } from "lucide-react";

type Session = Tables<"class_sessions">;
type Student = Tables<"students">;

const MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

export default function AttendancePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState("take");

  // Summary state
  const [summaryData, setSummaryData] = useState<
    { student: Student; attended: number; total: number }[]
  >([]);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const monthStr = String(selectedMonth + 1).padStart(2, "0");
    const startDate = `${selectedYear}-${monthStr}-01`;
    const endMonth = selectedMonth === 11 ? 1 : selectedMonth + 2;
    const endYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const [sessionsRes, studentsRes] = await Promise.all([
      supabase
        .from("class_sessions")
        .select("*")
        .gte("session_date", startDate)
        .lt("session_date", endDate)
        .order("session_date"),
      supabase.from("students").select("*").order("name"),
    ]);

    setSessions(sessionsRes.data ?? []);
    setStudents(studentsRes.data ?? []);
    setLoading(false);
  }, [supabase, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load attendance for selected session
  useEffect(() => {
    if (!selectedSession) return;

    async function loadAttendance() {
      const { data } = await supabase
        .from("attendance")
        .select("student_id, present")
        .eq("session_id", selectedSession);

      const map: Record<string, boolean> = {};
      students.forEach((s) => (map[s.id] = false));
      data?.forEach((a) => (map[a.student_id] = a.present ?? false));
      setAttendance(map);
    }

    loadAttendance();
  }, [selectedSession, students, supabase]);

  // Load summary data
  useEffect(() => {
    if (tab !== "summary" || sessions.length === 0 || students.length === 0) return;

    async function loadSummary() {
      const sessionIds = sessions.map((s) => s.id);
      const { data } = await supabase
        .from("attendance")
        .select("student_id, present")
        .in("session_id", sessionIds)
        .eq("present", true);

      const counts: Record<string, number> = {};
      data?.forEach((a) => {
        counts[a.student_id] = (counts[a.student_id] ?? 0) + 1;
      });

      setSummaryData(
        students.map((s) => ({
          student: s,
          attended: counts[s.id] ?? 0,
          total: sessions.length,
        }))
      );
    }

    loadSummary();
  }, [tab, sessions, students, supabase]);

  async function saveAttendance() {
    if (!selectedSession) return;
    setSaving(true);

    const records = Object.entries(attendance).map(([studentId, present]) => ({
      student_id: studentId,
      session_id: selectedSession,
      present,
    }));

    // Upsert all attendance records
    const { error } = await supabase
      .from("attendance")
      .upsert(records, { onConflict: "student_id,session_id" });

    if (error) {
      toast.error("Gagal menyimpan kehadiran");
      setSaving(false);
      return;
    }

    toast.success("Kehadiran berjaya disimpan");
    setSaving(false);
  }

  function toggleAll(checked: boolean) {
    const updated: Record<string, boolean> = {};
    students.forEach((s) => (updated[s.id] = checked));
    setAttendance(updated);
  }

  const presentCount = Object.values(attendance).filter(Boolean).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Kehadiran</h1>

      <div className="flex gap-3 mb-6">
        <Select
          value={String(selectedMonth)}
          onValueChange={(v) => {
            setSelectedMonth(Number(v));
            setSelectedSession("");
          }}
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
          onValueChange={(v) => {
            setSelectedYear(Number(v));
            setSelectedSession("");
          }}
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="take">Ambil Kehadiran</TabsTrigger>
          <TabsTrigger value="summary">Ringkasan Bulanan</TabsTrigger>
        </TabsList>

        <TabsContent value="take" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Memuatkan...</p>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Tiada sesi latihan untuk bulan ini. Tambah sesi dahulu.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-4">
                <Label className="text-sm font-medium mb-2 block">
                  Pilih Sesi Latihan
                </Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Pilih tarikh..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {format(parseISO(session.session_date), "d MMMM yyyy (EEEE)", {
                          locale: ms,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSession && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">
                      Hadir: {presentCount} / {students.length}
                    </CardTitle>
                    <Button onClick={saveAttendance} disabled={saving} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAll(true)}
                      >
                        Pilih Semua
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAll(false)}
                      >
                        Nyahpilih Semua
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {students.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-accent"
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
                          <span className="font-medium">{student.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {student.school_class}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Ringkasan {MONTHS[selectedMonth]} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryData.length === 0 ? (
                <p className="text-muted-foreground">Tiada data kehadiran</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pelajar</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-center">Hadir</TableHead>
                      <TableHead className="text-center">Jumlah Sesi</TableHead>
                      <TableHead className="text-center">Kadar (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaryData.map(({ student, attended, total }) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.name}
                        </TableCell>
                        <TableCell>{student.school_class ?? "-"}</TableCell>
                        <TableCell className="text-center">{attended}</TableCell>
                        <TableCell className="text-center">{total}</TableCell>
                        <TableCell className="text-center">
                          {total > 0
                            ? `${Math.round((attended / total) * 100)}%`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { className?: string }) {
  return <label className={className} {...props} />;
}
