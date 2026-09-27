import { brl } from "@/lib/products";

/** Abre o WhatsApp com uma mensagem pronta. Se houver telefone, abre a conversa direta. */
export function openWhatsApp(texto: string, telefone?: string) {
  const digits = (telefone ?? "").replace(/\D/g, "");
  const phone = digits ? (digits.length <= 11 ? `55${digits}` : digits) : "";
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}

export interface ShareLinha {
  codigo: string;
  descricao: string;
  qty?: number;
  unitPrice: number;
}

export function resumoTexto(opts: {
  tipo: "Pedido" | "Proposta comercial";
  numero?: number | null;
  cliente: string;
  prazo?: string;
  vencimento?: string;
  itens: ShareLinha[];
  total?: number | null;
  vendedor?: string;
}): string {
  const num = opts.numero ? ` nº ${String(opts.numero).padStart(6, "0")}` : "";
  const linhas = opts.itens.map(
    (i) =>
      `• ${i.descricao}${i.qty ? ` — ${i.qty} un` : ""} — ${brl(i.unitPrice)}${
        i.qty ? ` (${brl(i.qty * i.unitPrice)})` : ""
      }`,
  );
  const partes = [
    `*Rioquímica — ${opts.tipo}${num}*`,
    `Cliente: ${opts.cliente || "—"}`,
    opts.prazo ? `Prazo: ${opts.prazo}` : "",
    opts.vencimento ? `Validade: ${opts.vencimento.split("-").reverse().join("/")}` : "",
    "",
    ...linhas,
    "",
    opts.total != null ? `*Total: ${brl(opts.total)}*` : "",
    opts.vendedor ? `\nAtenciosamente, ${opts.vendedor}` : "",
  ];
  return partes.filter((p) => p !== "").join("\n");
}
