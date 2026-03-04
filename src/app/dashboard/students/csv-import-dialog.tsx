"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const FIELD_OPTIONS = [
  { value: "skip", label: "-- Langkau --" },
  { value: "name", label: "Nama Pelajar" },
  { value: "school_class", label: "Kelas" },
  { value: "parent_name", label: "Nama Ibu Bapa" },
  { value: "phone", label: "No. Telefon" },
  { value: "health_notes", label: "Nota Kesihatan" },
];

type FieldKey = "name" | "school_class" | "parent_name" | "phone" | "health_notes";

export function CsvImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setLoading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (result) => {
        const data = result.data as string[][];
        if (data.length < 2) {
          toast.error("CSV tiada data");
          return;
        }
        setHeaders(data[0]);
        setCsvData(data.slice(1).filter((row) => row.some((cell) => cell.trim())));

        // Auto-map columns based on header names
        const autoMapping: Record<number, string> = {};
        data[0].forEach((header, idx) => {
          const h = header.toLowerCase().trim();
          if (h.includes("nama") && h.includes("pelajar") || h === "name" || h === "student name" || h.includes("student")) {
            autoMapping[idx] = "name";
          } else if (h.includes("kelas") || h === "class" || h.includes("school")) {
            autoMapping[idx] = "school_class";
          } else if (h.includes("ibu") || h.includes("bapa") || h.includes("parent") || h.includes("guardian") || h.includes("penjaga")) {
            autoMapping[idx] = "parent_name";
          } else if (h.includes("telefon") || h.includes("phone") || h.includes("tel") || h.includes("contact")) {
            autoMapping[idx] = "phone";
          } else if (h.includes("kesihatan") || h.includes("health") || h.includes("medical")) {
            autoMapping[idx] = "health_notes";
          }
        });
        setMapping(autoMapping);
        setStep("mapping");
      },
      error: () => {
        toast.error("Gagal membaca fail CSV");
      },
    });
  }

  function hasNameMapping() {
    return Object.values(mapping).includes("name");
  }

  function getMappedData() {
    return csvData
      .map((row) => {
        const student: Record<string, string> = {};
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (field !== "skip") {
            student[field] = row[Number(colIdx)]?.trim() ?? "";
          }
        });
        return student;
      })
      .filter((s) => s.name);
  }

  async function handleImport() {
    const students = getMappedData();
    if (students.length === 0) {
      toast.error("Tiada data untuk diimport");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const insertData = students.map((s) => ({
      name: s.name,
      school_class: s.school_class || null,
      parent_name: s.parent_name || null,
      phone: s.phone || null,
      health_notes: s.health_notes || null,
    }));

    const { error } = await supabase.from("students").insert(insertData);

    if (error) {
      toast.error("Gagal mengimport pelajar");
      setLoading(false);
      return;
    }

    toast.success(`${students.length} pelajar berjaya diimport`);
    reset();
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Muat naik fail CSV dari Google Forms untuk menambah pelajar secara pukal.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-muted-foreground mb-4">
                Pilih fail CSV yang dieksport dari Google Sheets
              </p>
              <Button onClick={() => fileRef.current?.click()}>
                Pilih Fail CSV
              </Button>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Padankan lajur CSV dengan medan pelajar. Lajur yang tidak diperlukan boleh dilangkau.
            </p>

            <div className="space-y-3">
              {headers.map((header, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm font-medium min-w-[150px] truncate">
                    {header}
                  </span>
                  <Select
                    value={mapping[idx] ?? "skip"}
                    onValueChange={(value) =>
                      setMapping({ ...mapping, [idx]: value })
                    }
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!hasNameMapping() && (
              <p className="text-sm text-destructive">
                Sila padankan sekurang-kurangnya satu lajur ke &quot;Nama Pelajar&quot;
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Kembali
              </Button>
              <Button
                disabled={!hasNameMapping()}
                onClick={() => setStep("preview")}
              >
                Pratonton ({getMappedData().length} pelajar)
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pratonton {getMappedData().length} pelajar yang akan diimport:
            </p>

            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Ibu Bapa</TableHead>
                    <TableHead>Telefon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedData().map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.school_class ?? "-"}</TableCell>
                      <TableCell>{s.parent_name ?? "-"}</TableCell>
                      <TableCell>{s.phone ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Kembali
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? "Mengimport..." : `Import ${getMappedData().length} Pelajar`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
