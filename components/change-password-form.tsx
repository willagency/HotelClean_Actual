"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ChangePasswordForm({ email }: { email: string }) {
  const supabase = createClient();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 8) {
      setErrorMessage("新しいパスワードは8文字以上で設定してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("新しいパスワード(確認)が一致しません。");
      return;
    }

    setIsSubmitting(true);

    // セッションが残っていれば本来updateUserだけでも変更できてしまうが、
    // 「離席中に他人がパスワードを変更できてしまう」ことを防ぐため、
    // 現在のパスワードを明示的に検証してから更新する。
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyError) {
      setErrorMessage("現在のパスワードが正しくありません。");
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsSubmitting(false);

    if (updateError) {
      setErrorMessage(updateError.message);
      return;
    }

    setSuccessMessage("パスワードを変更しました。");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {errorMessage && <Alert variant="destructive">{errorMessage}</Alert>}
      {successMessage && <Alert>{successMessage}</Alert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="current_password">現在のパスワード</Label>
        <Input
          id="current_password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new_password">新しいパスワード</Label>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="8文字以上"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm_password">新しいパスワード(確認)</Label>
        <Input
          id="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "変更中..." : "パスワードを変更する"}
        </Button>
      </div>
    </form>
  );
}
