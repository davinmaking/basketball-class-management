"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  student: Tables<"students">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditStudentDialog({ student, open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: student.name,
    school_class: student.school_class ?? "",
    parent_name: student.parent_name ?? "",
    phone: student.phone ?? "",
    health_notes: student.health_notes ?? "",
    fee_exempt: student.fee_exempt ?? false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama pelajar diperlukan");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("students")
      .update({
        name: form.name.trim(),
        school_class: form.school_class.trim() || null,
        parent_name: form.parent_name.trim() || null,
        phone: form.phone.trim() || null,
        health_notes: form.health_notes.trim() || null,
        fee_exempt: form.fee_exempt,
      })
      .eq("id", student.id);

    if (error) {
      toast.error("Gagal mengemaskini pelajar");
      setLoading(false);
      return;
    }

    toast.success("Maklumat pelajar dikemaskini");
    setLoading(false);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Pelajar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nama Pelajar *</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-school_class">Kelas</Label>
            <Input
              id="edit-school_class"
              value={form.school_class}
              onChange={(e) => setForm({ ...form, school_class: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-parent_name">Nama Ibu Bapa / Penjaga</Label>
            <Input
              id="edit-parent_name"
              value={form.parent_name}
              onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">No. Telefon</Label>
            <Input
              id="edit-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-health_notes">Nota Kesihatan</Label>
            <Textarea
              id="edit-health_notes"
              value={form.health_notes}
              onChange={(e) => setForm({ ...form, health_notes: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="edit-fee_exempt"
              checked={form.fee_exempt}
              onCheckedChange={(checked) =>
                setForm({ ...form, fee_exempt: checked === true })
              }
            />
            <Label htmlFor="edit-fee_exempt">Dikecualikan yuran</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Mengemaskini..." : "Kemaskini"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
