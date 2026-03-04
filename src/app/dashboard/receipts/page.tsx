"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Printer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { MONTHS } from "@/lib/constants";

interface ReceiptRow {
  id: string;
  receipt_number: string;
  issued_at: string;
  amount: number;
  payment_date: string;
  month: number;
  year: number;
  student_name: string;
  notes: string | null;
  voided: boolean;
  payment_voided: boolean;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchReceipts = useCallback(async () => {
    const { data, error } = await supabase
      .from("receipts")
      .select(
        `
        id,
        receipt_number,
        issued_at,
        voided,
        payment:payments!inner(
          amount,
          payment_date,
          month,
          year,
          notes,
          voided,
          student:students!inner(name)
        )
      `
      )
      .order("issued_at", { ascending: false });

    if (error) {
      toast.error("加载收据失败");
      setLoading(false);
      return;
    }

    const rows: ReceiptRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      receipt_number: r.receipt_number,
      issued_at: r.issued_at,
      amount: r.payment.amount,
      payment_date: r.payment.payment_date,
      month: r.payment.month,
      year: r.payment.year,
      student_name: r.payment.student.name,
      notes: r.payment.notes,
      voided: r.voided ?? false,
      payment_voided: r.payment.voided ?? false,
    }));

    setReceipts(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const filtered = receipts.filter(
    (r) =>
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.receipt_number.toLowerCase().includes(search.toLowerCase())
  );

  function printReceipt(receipt: ReceiptRow) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>收据 ${receipt.receipt_number}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { font-size: 20px; margin: 0; }
          .header p { color: #666; font-size: 14px; }
          .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
          .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
          .row .label { color: #666; }
          .total { font-size: 18px; font-weight: bold; margin: 15px 0; text-align: center; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>付款收据</h1>
          <p>篮球训练班</p>
        </div>
        <div class="divider"></div>
        <div class="row"><span class="label">收据号:</span><span>${receipt.receipt_number}</span></div>
        <div class="row"><span class="label">日期:</span><span>${format(parseISO(receipt.issued_at), "dd/MM/yyyy")}</span></div>
        <div class="row"><span class="label">学生:</span><span>${receipt.student_name}</span></div>
        <div class="row"><span class="label">期间:</span><span>${MONTHS[receipt.month - 1]} ${receipt.year}</span></div>
        ${receipt.notes ? `<div class="row"><span class="label">备注:</span><span>${receipt.notes}</span></div>` : ""}
        <div class="divider"></div>
        <div class="total">RM ${Number(receipt.amount).toFixed(2)}</div>
        <div class="divider"></div>
        <div class="footer">
          <p>感谢您的付款。</p>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">收据</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索收据号或学生姓名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>收据号</TableHead>
                <TableHead>学生</TableHead>
                <TableHead>期间</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>日期</TableHead>
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
                    {search ? "未找到收据" : "暂无收据"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((receipt) => {
                  const isVoided = receipt.voided || receipt.payment_voided;
                  return (
                    <TableRow key={receipt.id} className={isVoided ? "opacity-50" : ""}>
                      <TableCell className={`font-mono text-sm ${isVoided ? "line-through" : ""}`}>
                        {receipt.receipt_number}
                        {isVoided && (
                          <Badge variant="destructive" className="ml-2 text-xs">已撤回</Badge>
                        )}
                      </TableCell>
                      <TableCell className={isVoided ? "line-through" : ""}>{receipt.student_name}</TableCell>
                      <TableCell className={isVoided ? "line-through" : ""}>
                        {MONTHS[receipt.month - 1]} {receipt.year}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isVoided ? "line-through" : ""}`}>
                        RM {Number(receipt.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className={isVoided ? "line-through" : ""}>
                        {format(parseISO(receipt.issued_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isVoided && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printReceipt(receipt)}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            打印
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground mt-2">
        {filtered.length} 张收据
      </p>
    </div>
  );
}
