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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Coach = Tables<"coaches">;

export default function CoachesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [deletingCoach, setDeletingCoach] = useState<Coach | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchCoaches = useCallback(async () => {
    const { data, error } = await supabase
      .from("coaches")
      .select("*")
      .order("name");
    if (error) {
      toast.error("加载教练列表失败");
      return;
    }
    setCoaches(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  function openAdd() {
    setEditingCoach(null);
    setFormName("");
    setFormPhone("");
    setShowDialog(true);
  }

  function openEdit(coach: Coach) {
    setEditingCoach(coach);
    setFormName(coach.name);
    setFormPhone(coach.phone ?? "");
    setShowDialog(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("请输入教练姓名");
      return;
    }
    setSaving(true);

    if (editingCoach) {
      const { error } = await supabase
        .from("coaches")
        .update({ name: formName.trim(), phone: formPhone.trim() || null })
        .eq("id", editingCoach.id);
      if (error) {
        toast.error("更新教练失败");
        setSaving(false);
        return;
      }
      toast.success("教练已更新");
    } else {
      const { error } = await supabase
        .from("coaches")
        .insert({ name: formName.trim(), phone: formPhone.trim() || null });
      if (error) {
        toast.error("添加教练失败");
        setSaving(false);
        return;
      }
      toast.success("教练已添加");
    }

    setSaving(false);
    setShowDialog(false);
    fetchCoaches();
  }

  async function toggleActive(coach: Coach) {
    const { error } = await supabase
      .from("coaches")
      .update({ active: !coach.active })
      .eq("id", coach.id);
    if (error) {
      toast.error("更新状态失败");
      return;
    }
    toast.success(coach.active ? "教练已停用" : "教练已启用");
    fetchCoaches();
  }

  async function handleDelete() {
    if (!deletingCoach) return;

    // Check if coach has linked records
    const [sessions, payments, refunds] = await Promise.all([
      supabase
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", deletingCoach.id),
      supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", deletingCoach.id),
      supabase
        .from("refunds")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", deletingCoach.id),
    ]);

    const linkedCount =
      (sessions.count ?? 0) + (payments.count ?? 0) + (refunds.count ?? 0);

    if (linkedCount > 0) {
      toast.error(`无法删除，该教练有 ${linkedCount} 条关联记录。请改用停用功能。`);
      setDeletingCoach(null);
      return;
    }

    const { error } = await supabase
      .from("coaches")
      .delete()
      .eq("id", deletingCoach.id);
    if (error) {
      toast.error("删除教练失败");
      setDeletingCoach(null);
      return;
    }
    toast.success("教练已删除");
    setDeletingCoach(null);
    fetchCoaches();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">教练</h1>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          添加教练
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>电话</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : coaches.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  还没有教练。添加第一位教练吧！
                </TableCell>
              </TableRow>
            ) : (
              coaches.map((coach) => (
                <TableRow
                  key={coach.id}
                  className={!coach.active ? "opacity-60" : ""}
                >
                  <TableCell className="font-medium">{coach.name}</TableCell>
                  <TableCell>{coach.phone ?? "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={coach.active ? "default" : "destructive"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(coach)}
                    >
                      {coach.active ? "活跃" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="编辑"
                        onClick={() => openEdit(coach)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="删除"
                        onClick={() => setDeletingCoach(coach)}
                      >
                        <Trash2 className="h-4 w-4" />
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
        {coaches.length} 位教练
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCoach ? "编辑教练" : "添加教练"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="教练姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>电话</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="电话号码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingCoach}
        onOpenChange={(open) => !open && setDeletingCoach(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除教练「{deletingCoach?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
