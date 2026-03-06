import { createClient } from "@/lib/supabase/server";
import { Dribbble } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";
import { StudentDirectory } from "./student-search";

export default async function DirectoryPage() {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, name, school_class, view_token")
    .eq("active", true)
    .not("view_token", "is", null)
    .order("name");

  return (
    <div className="min-h-[100dvh] bg-muted/30 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
            <Dribbble className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {APP_CONFIG.className}
          </h1>
          <p className="text-sm text-muted-foreground">
            学生名册 / Senarai Pelajar
          </p>
        </div>

        <StudentDirectory students={students ?? []} />
      </div>
    </div>
  );
}
