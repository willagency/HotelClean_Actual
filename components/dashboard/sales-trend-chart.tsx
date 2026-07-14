"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { SalesTrendRow } from "@/lib/types/database.types";

export function SalesTrendChart({ data }: { data: SalesTrendRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="year_month" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => `${Math.round(v / 10000)}万`}
          width={50}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toLocaleString()}円`, "売上"]}
          labelFormatter={(label) => `${label}`}
        />
        <Line
          type="monotone"
          dataKey="net_sales"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#3b82f6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
