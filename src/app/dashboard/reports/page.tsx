"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentReport } from "./student-report";
import { MonthlyReport } from "./monthly-report";
import { AnnualReport } from "./annual-report";

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">报表</h1>
      <Tabs defaultValue="student">
        <TabsList variant="line" className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="student">学生报表</TabsTrigger>
          <TabsTrigger value="monthly">月度报表</TabsTrigger>
          <TabsTrigger value="annual">年度报表</TabsTrigger>
        </TabsList>
        <TabsContent value="student">
          <StudentReport />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyReport />
        </TabsContent>
        <TabsContent value="annual">
          <AnnualReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
