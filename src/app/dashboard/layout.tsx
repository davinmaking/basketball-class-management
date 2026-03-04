import { SidebarNav } from "@/components/sidebar-nav";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <SidebarNav />
      <main className="flex-1 min-w-0 p-4 md:p-8 overflow-auto">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
