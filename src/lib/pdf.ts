import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calcItemTaxes, brl, type Product } from "@/lib/products";
import logo from "@/assets/rioquimica-logo.jpeg";

export interface OrderItem {
  product: Product;
  qtyTyped: number;
  qtyAdjusted: number;
  unitPrice: number;
}

export interface PdfData {
  numero?: number | null;
  cliente: string;
  codCliente: string;
  prazo: string;
  data: string;
  vencimento: string;
  vendedor: string;
  obs: string;
  items: OrderItem[];
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logo);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function computeTotals(items: OrderItem[]) {
  let totalGeral = 0, totalUnidades = 0, totalCaixas = 0;
  let baseIcms = 0, vIcms = 0, baseIpi = 0, vIpi = 0;
  let baseSt = 0, vSt = 0, vPis = 0, vCofins = 0;
  for (const it of items) {
    const t = calcItemTaxes(it.unitPrice, it.qtyAdjusted, it.product);
    totalGeral += t.base;
    totalUnidades += it.qtyAdjusted;
    totalCaixas += Math.ceil(it.qtyAdjusted / Math.max(1, it.product.qtdPorEmbalagem));
    baseIcms += t.base; vIcms += t.icms;
    baseIpi += t.base; vIpi += t.ipi;
    baseSt += t.stBase; vSt += t.st;
    vPis += t.pis; vCofins += t.cofins;
  }
  const valorTotalNota = totalGeral + vIpi + vSt;
  return { totalGeral, totalUnidades, totalCaixas, baseIcms, vIcms, baseIpi, vIpi, baseSt, vSt, vPis, vCofins, valorTotalNota };
}

export async function buildPedidoPdf(d: PdfData): Promise<jsPDF> {
  const { cliente, codCliente, prazo, data, vencimento, vendedor, obs, items, numero } = d;
  const totals = computeTotals(items);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pedidoNum = numero ? `#${String(numero).padStart(6, "0")}` : `#${Date.now().toString().slice(-6)}`;
  const RED: [number, number, number] = [200, 30, 40];

  const logoData = await loadLogoDataUrl();
  if (logoData) {
    try { doc.addImage(logoData, "JPEG", 10, 6, 22, 18); } catch { /* ignore */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...RED);
  doc.setFontSize(12);
  doc.text("RIOQUIMICA S.A", 34, 11);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("AV. TARRAF, Nr. 2590/2600", 34, 15);
  doc.text("TEL: 55-17-4009-4288", 34, 19);
  doc.text("CNPJ: 55.643.555/0001-43", 34, 23);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...RED);
  doc.setFontSize(11);
  doc.text("CONFIRMAÇÃO DO PEDIDO", W - 10, 11, { align: "right" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`EMISSÃO: ${new Date().toLocaleDateString("pt-BR")}`, W - 10, 15, { align: "right" });
  doc.text(`PEDIDO Nº ${pedidoNum}`, W - 10, 19, { align: "right" });

  doc.setDrawColor(...RED);
  doc.setLineWidth(0.4);
  doc.line(10, 26, W - 10, 26);
  doc.setLineWidth(0.2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`CLIENTE: ${codCliente || "-"}`, 10, 32);
  doc.setFont("helvetica", "normal");
  doc.text(cliente || "-", 10, 36);
  doc.text(`VENDEDOR: ${vendedor || "-"}`, 10, 40);
  doc.text(`COND. PGTO: ${prazo || "-"}`, 10, 44);
  doc.text(`DATA PEDIDO: ${new Date(data).toLocaleDateString("pt-BR")}`, W / 2 + 10, 32);
  if (vencimento) {
    doc.text(`VENCIMENTO PROPOSTA: ${new Date(vencimento).toLocaleDateString("pt-BR")}`, W / 2 + 70, 32);
  }
  doc.text(`Nº ITENS: ${items.length}`, W / 2 + 10, 36);
  doc.text(`Nº VOLUMES: ${totals.totalCaixas}`, W / 2 + 10, 40);
  doc.text(`UNIDADES: ${totals.totalUnidades}`, W / 2 + 10, 44);

  doc.line(10, 48, W - 10, 48);

  autoTable(doc, {
    startY: 52,
    head: [["IT", "Produto", "Descrição", "UM", "Qtd.Vendida", "Valor Unit.", "Total", "Vlr IPI", "Vlr ST"]],
    body: items.map((it, i) => {
      const t = calcItemTaxes(it.unitPrice, it.qtyAdjusted, it.product);
      return [
        String(i + 1).padStart(2, "0"),
        it.product.codigo,
        `${it.product.descricao} ${it.product.apresentacao}`.trim(),
        "UN",
        it.qtyAdjusted.toLocaleString("pt-BR", { minimumFractionDigits: 0 }),
        it.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        t.base.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        t.ipi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        t.st.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: [180, 180, 180], lineWidth: 0.1 },
    headStyles: { fillColor: RED, textColor: 255, fontStyle: "bold", lineColor: RED },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 25 },
      2: { cellWidth: "auto" as unknown as number },
      3: { cellWidth: 10, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 24, halign: "right" },
      7: { cellWidth: 20, halign: "right" },
      8: { cellWidth: 20, halign: "right" },
    },
  });

  // @ts-expect-error lastAutoTable
  let endY = doc.lastAutoTable.finalY + 2;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("T O T A I S", 12, endY + 4);
  doc.text(totals.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), W - 56, endY + 4, { align: "right" });
  doc.text(totals.vIpi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), W - 32, endY + 4, { align: "right" });
  doc.text(totals.vSt.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), W - 12, endY + 4, { align: "right" });

  endY += 8;

  autoTable(doc, {
    startY: endY,
    head: [["Base ICMS", "Valor ICMS", "Base IPI", "Valor IPI", "Base ST", "Valor ST", "Valor PIS", "Valor COFINS", "Valor Total"]],
    body: [[
      totals.baseIcms.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.vIcms.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.baseIpi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.vIpi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.baseSt.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.vSt.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.vPis.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.vCofins.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      totals.valorTotalNota.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
    ]],
    styles: { fontSize: 7.5, cellPadding: 1.2, halign: "right", lineColor: [120, 120, 120], lineWidth: 0.1 },
    headStyles: { fillColor: RED, textColor: 255, fontStyle: "bold", halign: "center" },
    margin: { left: 10, right: 10 },
  });

  // @ts-expect-error lastAutoTable
  endY = doc.lastAutoTable.finalY + 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...RED);
  doc.text(`VALOR TOTAL DO PEDIDO: ${brl(totals.valorTotalNota)}`, W - 10, endY, { align: "right" });
  doc.setTextColor(0);

  if (obs) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("MENSAGEM / OBSERVAÇÕES:", 10, endY + 6);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(obs, W - 20), 10, endY + 10);
  }

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 10, H - 6);
  doc.text(`Pedido ${pedidoNum}`, W - 10, H - 6, { align: "right" });

  return doc;
}

export function pdfFilename(d: Pick<PdfData, "cliente" | "data" | "numero">): string {
  const num = d.numero ? `_${String(d.numero).padStart(6, "0")}` : "";
  return `pedido${num}_${(d.cliente || "cliente").replace(/\s+/g, "_")}_${d.data}.pdf`;
}

export function pedidoTotal(items: OrderItem[]): number {
  return computeTotals(items).valorTotalNota;
}
