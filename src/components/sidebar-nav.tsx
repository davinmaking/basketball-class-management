"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  ClipboardCheck,
  DollarSign,
  Receipt,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "Pelajar", icon: Users },
  { href: "/dashboard/sessions", label: "Sesi Latihan", icon: Calendar },
  { href: "/dashboard/attendance", label: "Kehadiran", icon: ClipboardCheck },
  { href: "/dashboard/fees", label: "Yuran", icon: DollarSign },
  { href: "/dashboard/receipts", label: "Resit", icon: Receipt },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-background sticky top-0 z-50">
        <h1 className="font-bold text-lg">Basketball Manager</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 bg-background border-r flex flex-col transition-transform duration-200 md:translate-x-0 md:static md:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b hidden md:block">
          <h1 className="font-bold text-lg">Basketball Manager</h1>
          <p className="text-sm text-muted-foreground">Pengurusan Kelas Latihan</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Log Keluar
          </Button>
        </div>
      </aside>
    </>
  );
}
