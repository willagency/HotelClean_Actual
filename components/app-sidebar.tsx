"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  Target,
  Users,
  UsersRound,
  X,
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
    href: "/shifts/staffing",
    label: "当日シフト状況",
    icon: UsersRound,
    roles: ["super_admin", "manager"],
  },
  {
    href: "/reports/daily",
    label: "日報入力",
    icon: ClipboardList,
    roles: ["super_admin", "manager", "checker"],
  },
  {
    href: "/attendance",
    label: "出勤状況確認",
    icon: CheckSquare,
    roles: ["super_admin", "manager"],
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
  const [isOpen, setIsOpen] = useState(false);
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // 画面遷移(パス変化)時にモバイルのドロワーを自動的に閉じる
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* モバイル専用の上部バー(lg以上では非表示)。position: stickyで
          コンテンツを押し下げるため、本文側で余白調整は不要。 */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="メニューを開く"
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold">清掃管理システム</p>
        <div className="h-10 w-10" />
      </div>

      {/* モバイルでドロワーを開いた時の背景オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* サイドバー本体。lg未満は左からスライドインするドロワー、
          lg以上は常時表示の固定カラムになる。 */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] shrink-0 flex-col border-r border-slate-100 bg-white transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold leading-tight">清掃管理システム</p>
            <p className="mt-1 text-xs text-slate-500">{userName}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="メニューを閉じる"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form action={signOutAction} className="border-t border-slate-100 p-3">
          <Button type="submit" variant="ghost" size="lg" className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" />
            ログアウト
          </Button>
        </form>
      </aside>
    </>
  );
}
