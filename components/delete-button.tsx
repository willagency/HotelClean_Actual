"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function DeleteButton({
  id,
  confirmMessage,
  onDelete,
}: {
  id: string;
  confirmMessage: string;
  onDelete: (id: string) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(confirmMessage)) return;

    setErrorMessage(null);
    setIsDeleting(true);
    const result = await onDelete(id);
    setIsDeleting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {errorMessage && (
        <Alert variant="destructive" className="max-w-xs text-left text-xs">
          {errorMessage}
        </Alert>
      )}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isDeleting}
        onClick={handleDelete}
      >
        {isDeleting ? "削除中..." : "削除"}
      </Button>
    </div>
  );
}
