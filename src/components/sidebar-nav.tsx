"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  ClipboardCheck,
  Wallet,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  BarChart3,
  Dribbble,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { APP_CONFIG } from "@/lib/config";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/dashboard/students", label: "学生", icon: Users },
  { href: "/dashboard/attendance", label: "出勤", icon: ClipboardCheck },
  { href: "/dashboard/finance", label: "财务", icon: Wallet },
  { href: "/dashboard/coaches", label: "教练", icon: UserCog },
  { href: "/dashboard/reports", label: "报表", icon: BarChart3 },
];

const STORAGE_KEY = "sidebar-collapsed";

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <TooltipProvider>
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-background sticky top-0 z-50">
        <h1 className="font-bold text-lg">{APP_CONFIG.appName}</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 top-14 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-14 bottom-0 left-0 z-40 w-64 bg-background border-r flex flex-col transition-transform duration-200",
          "md:sticky md:top-0 md:h-screen md:translate-x-0 md:z-auto md:transition-[width] md:duration-200 md:shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "border-b hidden md:flex items-center",
            collapsed ? "justify-center p-4" : "p-6"
          )}
        >
          {collapsed ? (
            <Dribbble className="h-5 w-5" />
          ) : (
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">{APP_CONFIG.appName}</h1>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav
          className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-4")}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            const linkContent = (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center rounded-lg text-sm transition-colors",
                  collapsed
                    ? "justify-center p-2.5"
                    : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "border-t space-y-1",
            collapsed ? "p-2" : "p-4"
          )}
        >
          {/* Collapse toggle - desktop only */}
          <div className="hidden md:block">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full"
                    aria-label="展开侧栏"
                    onClick={toggleCollapsed}
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">展开侧栏</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground"
                onClick={toggleCollapsed}
              >
                <PanelLeftClose className="h-4 w-4" />
                收起侧栏
              </Button>
            )}
          </div>

          {/* Logout */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full text-muted-foreground"
                  aria-label="退出登录"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">退出登录</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
