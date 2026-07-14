import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HotelRankingRow } from "@/lib/types/database.types";

export function HotelRankingTable({
  rows,
  yearMonth,
}: {
  rows: HotelRankingRow[];
  yearMonth: string;
}) {
  const sorted = [...rows].sort((a, b) => b.net_sales - a.net_sales);

  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ホテル名</TableHead>
            <TableHead>清掃室数</TableHead>
            <TableHead>売上</TableHead>
            <TableHead>目標達成率(売上)</TableHead>
            <TableHead className="text-right">詳細</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
            const achievementRate =
              row.target_sales > 0 ? (row.net_sales / row.target_sales) * 100 : null;

            return (
              <TableRow key={row.hotel_id}>
                <TableCell className="font-medium">{row.hotel_name}</TableCell>
                <TableCell>{row.total_rooms.toLocaleString()}室</TableCell>
                <TableCell>{row.net_sales.toLocaleString()}円</TableCell>
                <TableCell>
                  {achievementRate === null ? "目標未設定" : `${achievementRate.toFixed(1)}%`}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/dashboard/hotels/${row.hotel_id}?month=${yearMonth}`}
                    className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    詳細を見る
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}

          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                データがありません。
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
