"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  id?: string;
  name?: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}

// 実際の送信値はネイティブcheckboxで持たせつつ、見た目をiOS風トグルにする。
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ id, name, defaultChecked, label, description }, ref) => {
    const [checked, setChecked] = React.useState(defaultChecked ?? false);

    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-100 bg-white px-4 py-3"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          {description && <span className="text-xs text-slate-500">{description}</span>}
        </span>

        <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
          <input
            ref={ref}
            id={id}
            name={name}
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "h-7 w-12 rounded-full transition-colors",
              checked ? "bg-emerald-500" : "bg-slate-200"
            )}
          />
          <span
            className={cn(
              "absolute left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
              checked && "translate-x-5"
            )}
          />
        </span>
      </label>
    );
  }
);
Switch.displayName = "Switch";
