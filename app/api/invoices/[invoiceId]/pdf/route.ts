import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createClient } from "@/lib/supabase/server";

// pdf-lib はNode.jsのAPI(fs等)に依存するため、Edge Runtimeではなく
// Node.js Runtimeで実行する必要がある。
export const runtime = "nodejs";

interface InvoiceRow {
  id: string;
  hotel_id: string;
  year_month: string;
  total_rooms: number;
  gross_sales: number;
  labor_cost: number;
  adjustment_total: number;
  net_sales: number;
  generated_at: string | null;
  created_at: string;
  hotel: {
    name: string;
    parent_company_name: string | null;
    address: string | null;
    phone: string | null;
    client_contact_name: string | null;
  } | null;
}

interface LineItemRow {
  room_count: number;
  unit_price: number;
  subtotal: number;
  room_type: { name: string } | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const supabase = createClient();

  // RLS(invoices_select_admin / _select_manager)により、
  // 権限がない場合はここでnullになる
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "*, hotel:hotels(name, parent_company_name, address, phone, client_contact_name)"
    )
    .eq("id", params.invoiceId)
    .maybeSingle();

  const typedInvoice = invoice as InvoiceRow | null;

  if (!typedInvoice) {
    return NextResponse.json(
      { error: "請求明細が見つからないか、閲覧権限がありません。" },
      { status: 404 }
    );
  }

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("room_count, unit_price, subtotal, room_type:room_types(name)")
    .eq("invoice_id", params.invoiceId);

  const fontPath = path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf");
  if (!fs.existsSync(fontPath)) {
    return NextResponse.json(
      {
        error:
          "日本語フォントファイルが見つかりません。README.mdの手順に従い public/fonts/NotoSansJP-Regular.ttf を配置してください。",
      },
      { status: 500 }
    );
  }
  const fontBytes = fs.readFileSync(fontPath);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  let y = page.getSize().height - 60;

  const textColor = rgb(0.12, 0.14, 0.2);
  const mutedColor = rgb(0.45, 0.47, 0.5);

  function drawText(text: string, x: number, size = 11, color = textColor) {
    page.drawText(text, { x, y, size, font, color });
  }

  function newLine(gap = 18) {
    y -= gap;
  }

  drawText("月次請求明細", 40, 22);
  newLine(30);

  drawText(`対象年月: ${typedInvoice.year_month}`, 40, 11);
  newLine();
  drawText(`ホテル名: ${typedInvoice.hotel?.name ?? "-"}`, 40, 11);
  newLine();

  if (typedInvoice.hotel?.parent_company_name) {
    drawText(`親会社: ${typedInvoice.hotel.parent_company_name}`, 40, 10, mutedColor);
    newLine(16);
  }
  if (typedInvoice.hotel?.client_contact_name) {
    drawText(`ご担当者: ${typedInvoice.hotel.client_contact_name} 様`, 40, 10, mutedColor);
    newLine(16);
  }
  if (typedInvoice.hotel?.address) {
    drawText(`住所: ${typedInvoice.hotel.address}`, 40, 10, mutedColor);
    newLine(16);
  }
  if (typedInvoice.hotel?.phone) {
    drawText(`電話番号: ${typedInvoice.hotel.phone}`, 40, 10, mutedColor);
    newLine(16);
  }

  newLine(10);
  drawText("客室タイプ別 清掃実績", 40, 13);
  newLine(22);

  drawText("客室タイプ", 40, 10, mutedColor);
  drawText("室数", 260, 10, mutedColor);
  drawText("単価(円)", 340, 10, mutedColor);
  drawText("小計(円)", 440, 10, mutedColor);
  newLine(6);

  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 0.5,
    color: rgb(0.75, 0.76, 0.78),
  });
  newLine(18);

  for (const item of (lineItems ?? []) as unknown as LineItemRow[]) {
    drawText(item.room_type?.name ?? "-", 40, 10);
    drawText(`${item.room_count}`, 260, 10);
    drawText(Number(item.unit_price).toLocaleString(), 340, 10);
    drawText(Number(item.subtotal).toLocaleString(), 440, 10);
    newLine(18);
  }

  newLine(8);
  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 0.5,
    color: rgb(0.75, 0.76, 0.78),
  });
  newLine(26);

  function summaryLine(label: string, value: string, bold = false) {
    drawText(label, 320, bold ? 13 : 11);
    drawText(value, 440, bold ? 13 : 11);
    newLine(bold ? 24 : 18);
  }

  summaryLine("清掃売上合計", `${Number(typedInvoice.gross_sales).toLocaleString()}円`);
  summaryLine("人件費", `-${Number(typedInvoice.labor_cost).toLocaleString()}円`);
  summaryLine(
    "調整金",
    `${Number(typedInvoice.adjustment_total) >= 0 ? "+" : ""}${Number(
      typedInvoice.adjustment_total
    ).toLocaleString()}円`
  );
  summaryLine("ご請求金額", `${Number(typedInvoice.net_sales).toLocaleString()}円`, true);

  newLine(20);
  const issuedAt = typedInvoice.generated_at ?? typedInvoice.created_at;
  drawText(
    `発行日: ${new Date(issuedAt).toLocaleDateString("ja-JP")}`,
    40,
    9,
    mutedColor
  );

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice_${typedInvoice.year_month}.pdf"`,
    },
  });
}
