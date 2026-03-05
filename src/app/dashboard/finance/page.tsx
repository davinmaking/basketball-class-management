"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentFees } from "./student-fees";
import { Receipts } from "./receipts";
import { CoachPayments } from "./coach-payments";

export default function FinancePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">财务</h1>
      <Tabs defaultValue="fees">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="fees">学费收支</TabsTrigger>
          <TabsTrigger value="receipts">收据/退款单</TabsTrigger>
          <TabsTrigger value="coach-pay">教练薪酬</TabsTrigger>
        </TabsList>
        <TabsContent value="fees">
          <StudentFees />
        </TabsContent>
        <TabsContent value="receipts">
          <Receipts />
        </TabsContent>
        <TabsContent value="coach-pay">
          <CoachPayments />
        </TabsContent>
      </Tabs>
    </div>
  );
}
