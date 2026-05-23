import * as XLSX from "xlsx";
import type { PedidoExportRow, ItemExportRow } from "./export.functions";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(";"));
  return "\ufeff" + lines.join("\r\n");
}

export function downloadCsv(
  pedidos: PedidoExportRow[],
  itens: ItemExportRow[],
  stamp: string,
) {
  download(
    new Blob([toCsv(pedidos as unknown as Record<string, unknown>[])], {
      type: "text/csv;charset=utf-8",
    }),
    `pedidos_${stamp}.csv`,
  );
  download(
    new Blob([toCsv(itens as unknown as Record<string, unknown>[])], {
      type: "text/csv;charset=utf-8",
    }),
    `itens_${stamp}.csv`,
  );
}

export function downloadXlsx(
  pedidos: PedidoExportRow[],
  itens: ItemExportRow[],
  stamp: string,
) {
  const wb = XLSX.utils.book_new();
  const wsPedidos = XLSX.utils.json_to_sheet(pedidos);
  const wsItens = XLSX.utils.json_to_sheet(itens);
  XLSX.utils.book_append_sheet(wb, wsPedidos, "Pedidos");
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `pedidos_${stamp}.xlsx`,
  );
}
