"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddStudentDialog({ open, onOpenChange, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    school_class: "",
    parent_name: "",
    phone: "",
    health_notes: "",
    fee_exempt: false,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nama pelajar diperlukan");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("students").insert({
      name: form.name.trim(),
      school_class: form.school_class.trim() || null,
      parent_name: form.parent_name.trim() || null,
      phone: form.phone.trim() || null,
      health_notes: form.health_notes.trim() || null,
      fee_exempt: form.fee_exempt,
    });

    if (error) {
      toast.error("Gagal menambah pelajar");
      setLoading(false);
      return;
    }

    toast.success(`${form.name} berjaya ditambah`);
    setForm({
      name: "",
      school_class: "",
      parent_name: "",
      phone: "",
      health_notes: "",
      fee_exempt: false,
    });
    setLoading(false);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Pelajar Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Pelajar *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school_class">Kelas</Label>
            <Input
              id="school_class"
              placeholder="cth: 4A"
              value={form.school_class}
              onChange={(e) => setForm({ ...form, school_class: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent_name">Nama Ibu Bapa / Penjaga</Label>
            <Input
              id="parent_name"
              value={form.parent_name}
              onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">No. Telefon</Label>
            <Input
              id="phone"
              placeholder="cth: 012-3456789"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="health_notes">Nota Kesihatan</Label>
            <Textarea
              id="health_notes"
              placeholder="Sebarang keadaan kesihatan yang perlu diketahui"
              value={form.health_notes}
              onChange={(e) => setForm({ ...form, health_notes: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="fee_exempt"
              checked={form.fee_exempt}
              onCheckedChange={(checked) =>
                setForm({ ...form, fee_exempt: checked === true })
              }
            />
            <Label htmlFor="fee_exempt">Dikecualikan yuran</Label>
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
              {loading ? "Menambah..." : "Tambah"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
