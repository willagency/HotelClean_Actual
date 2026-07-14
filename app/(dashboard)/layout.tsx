import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  // middlewareで未ログインは弾いているが、profile未作成(異常系)にも念のため対応
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar role={profile.role} userName={profile.name} />
      <main className="flex-1 overflow-y-auto bg-background p-8">{children}</main>
    </div>
  );
}
