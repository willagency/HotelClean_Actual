"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Send,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/types/database.types";
import { signOutAction } from "@/app/(dashboard)/actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "ダッシュボード",
    icon: LayoutDashboard,
    roles: ["super_admin", "manager", "checker", "staff"],
  },
  {
    href: "/admin/hotels",
    label: "ホテル管理",
    icon: Building2,
    roles: ["super_admin"],
  },
  {
    href: "/admin/staff",
    label: "スタッフ管理",
    icon: Users,
    roles: ["super_admin", "manager"],
  },
  {
    href: "/shifts/request",
    label: "シフト申請",
    icon: Send,
    roles: ["staff"],
  },
  {
    href: "/shifts/calendar",
    label: "シフト確認",
    icon: CalendarDays,
    roles: ["super_admin", "manager", "checker"],
  },
  {
    href: "/reports/daily",
    label: "日報入力",
    icon: ClipboardList,
    roles: ["super_admin", "manager", "checker"],
  },
  {
    href: "/targets",
    label: "目標管理",
    icon: Target,
    roles: ["super_admin", "manager"],
  },
  {
    href: "/billing",
    label: "請求明細",
    icon: FileText,
    roles: ["super_admin", "manager"],
  },
  {
    href: "/account/password",
    label: "パスワード変更",
    icon: KeyRound,
    roles: ["super_admin", "manager", "checker", "staff"],
  },
];

export function AppSidebar({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold leading-tight">清掃管理システム</p>
        <p className="mt-1 text-xs text-muted-foreground">{userName}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-secondary"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={signOutAction} className="border-t border-border p-3">
        <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" />
          ログアウト
        </Button>
      </form>
    </aside>
  );
}
