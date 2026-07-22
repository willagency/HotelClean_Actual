"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShiftTemplate } from "@/lib/types/database.types";

export interface ShiftTemplateDraft {
  id: string | null;
  label: string;
  start_time: string;
  end_time: string;
  target_headcount: number;
}

const MAX_TEMPLATES = 5;

function toDraft(template: ShiftTemplate): ShiftTemplateDraft {
  return {
    id: template.id,
    label: template.label,
    start_time: template.start_time.slice(0, 5),
    end_time: template.end_time.slice(0, 5),
    target_headcount: template.target_headcount,
  };
}

export function ShiftTemplateEditor({
  initialTemplates,
}: {
  initialTemplates: ShiftTemplate[];
}) {
  const [templates, setTemplates] = useState<ShiftTemplateDraft[]>(
    initialTemplates.length > 0
      ? initialTemplates.map(toDraft)
      : [{ id: null, label: "", start_time: "", end_time: "", target_headcount: 1 }]
  );

  function updateTemplate(index: number, patch: Partial<ShiftTemplateDraft>) {
    setTemplates((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTemplate() {
    if (templates.length >= MAX_TEMPLATES) return;
    setTemplates((prev) => [
      ...prev,
      { id: null, label: "", start_time: "", end_time: "", target_headcount: 1 },
    ]);
  }

  function removeTemplate(index: number) {
    setTemplates((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="hidden"
        name="shift_templates_json"
        value={JSON.stringify(
          templates
            .filter((t) => t.label.trim() && t.start_time && t.end_time)
            .map((t, i) => ({ ...t, sort_order: i }))
        )}
      />

      {templates.map((template, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-5 sm:items-end"
        >
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>時間帯名</Label>
            <Input
              value={template.label}
              onChange={(e) => updateTemplate(index, { label: e.target.value })}
              placeholder="例: 早番"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>開始</Label>
            <Input
              type="time"
              value={template.start_time}
              onChange={(e) => updateTemplate(index, { start_time: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>終了</Label>
            <Input
              type="time"
              value={template.end_time}
              onChange={(e) => updateTemplate(index, { end_time: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>デフォルト目標人数</Label>
              <Input
                type="number"
                min={0}
                value={template.target_headcount}
                onChange={(e) =>
                  updateTemplate(index, { target_headcount: Number(e.target.value) })
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeTemplate(index)}
              aria-label="この時間帯を削除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {templates.length < MAX_TEMPLATES && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTemplate}
          className="flex w-fit items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          時間帯を追加({templates.length}/{MAX_TEMPLATES})
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        ここで登録した時間帯を、スタッフがシフト申請時に選択します。時間帯名・開始・終了を
        すべて入力した行のみ保存されます。最大{MAX_TEMPLATES}つまで登録できます。
        「デフォルト目標人数」は日ごとの個別設定がない場合に使われる基準値です。
        チェックアウト状況等で日によって必要人数が変わる場合は、「当日シフト状況」画面から
        日付ごとに個別設定できます。
      </p>
    </div>
  );
}
