"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { detectLanguage } from "@/lib/language";

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
    relationship: "",
    phone: "",
    health_notes: "",
    active: true,
    preferred_language: "ms" as "zh" | "ms",
  });
  // Track if user has manually changed the language selector
  const manuallySetRef = useRef(false);

  function handleNameChange(name: string) {
    const updates: Partial<typeof form> = { name };
    // Auto-detect language only if user hasn't manually overridden
    if (!manuallySetRef.current) {
      updates.preferred_language = detectLanguage(name);
    }
    setForm({ ...form, ...updates });
  }

  function handleLanguageChange(lang: string) {
    manuallySetRef.current = true;
    setForm({ ...form, preferred_language: lang as "zh" | "ms" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("请输入学生姓名");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("students").insert({
      name: form.name.trim(),
      school_class: form.school_class.trim() || null,
      parent_name: form.parent_name.trim() || null,
      relationship: form.relationship.trim() || null,
      phone: form.phone.trim() || null,
      health_notes: form.health_notes.trim() || null,
      active: form.active,
      preferred_language: form.preferred_language,
      registered_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("添加学生失败");
      setLoading(false);
      return;
    }

    toast.success(`${form.name} 已添加`);
    setForm({
      name: "",
      school_class: "",
      parent_name: "",
      relationship: "",
      phone: "",
      health_notes: "",
      active: true,
      preferred_language: "ms",
    });
    manuallySetRef.current = false;
    setLoading(false);
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加新学生</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">学生姓名 *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school_class">班级</Label>
            <Input
              id="school_class"
              placeholder="例：4A"
              value={form.school_class}
              onChange={(e) => setForm({ ...form, school_class: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent_name">家长/监护人姓名</Label>
            <Input
              id="parent_name"
              value={form.parent_name}
              onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship">与学生的关系</Label>
            <Input
              id="relationship"
              placeholder="例：母亲, 父亲, 姑姑"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">电话号码</Label>
            <Input
              id="phone"
              placeholder="例：012-3456789"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_language">WhatsApp 语言</Label>
            <Select
              value={form.preferred_language}
              onValueChange={handleLanguageChange}
            >
              <SelectTrigger id="preferred_language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="ms">Bahasa Malaysia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="health_notes">健康备注</Label>
            <Textarea
              id="health_notes"
              placeholder="需要了解的健康状况"
              value={form.health_notes}
              onChange={(e) => setForm({ ...form, health_notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "添加中..." : "添加"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
