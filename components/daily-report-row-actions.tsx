"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function DailyReportRowActions({
  reportId,
  canDelete,
  onDelete,
}: {
  reportId: string;
  canDelete: boolean;
  onDelete: (reportId: string) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("この日報を削除しますか?この操作は取り消せません。")) return;

    setIsDeleting(true);
    const result = await onDelete(reportId);
    setIsDeleting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}
      <div className="flex justify-end gap-2">
        <Link
          href={`/reports/daily/${reportId}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          編集
        </Link>
        {canDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            削除
          </Button>
        )}
      </div>
    </div>
  );
}
