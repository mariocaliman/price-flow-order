import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brl } from "@/lib/products";
import logo from "@/assets/rioquimica-logo.jpeg";

export interface PropostaItem {
  codigo: string;
  descricao: string;
  apresentacao: string;
  tabela: string;
  qty: number;
  unitPrice: number;
}

export interface PropostaData {
  numero?: number | null;
  dataCriacao: string;
  cliente: string;
  prazo: string;
  vencimento: string;
  apresentacao: string;
  obs: string;
  assinaturaNome: string;
  assinaturaCargo: string;
  assinaturaInfo: string;
  assinaturaCliente: boolean;
  items: PropostaItem[];
}

export const DEFAULT_APRESENTACAO =
  "Prezado cliente,\n\nApresentamos nossa proposta comercial, elaborada especialmente para atender às suas necessidades, contemplando os produtos e as condições comerciais descritos abaixo.\n\nAgradecemos a oportunidade e permanecemos à disposição para quaisquer esclarecimentos.";

export function propostaTotal(items: PropostaItem[]) {
  return items.reduce((s, i) => s + (i.qty || 0) * (i.unitPrice || 0), 0);
}

export function fmtNumero(n?: number | null) {
  return n ? String(n).padStart(6, "0") : "—";
}

function fmtDate(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch(logo)).blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onloadend = () => res(r.result as string);
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildPropostaPdf(d: PropostaData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;
  const RED: [number, number, number] = [200, 30, 40];
  const logoData = await loadLogo();

  // Header
  if (logoData) { try { doc.addImage(logoData, "JPEG", M, 10, 24, 20); } catch { /* ignore */ } }
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...RED);
  doc.text("RIOQUIMICA S.A", M + 28, 16);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(60);
  doc.text("AV. TARRAF, Nr. 2590/2600 · TEL: 55-17-4009-4288", M + 28, 21);
  doc.text("CNPJ: 55.643.555/0001-43", M + 28, 25);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...RED);
  doc.text("PROPOSTA COMERCIAL", W - M, 16, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0);
  doc.text(`Nº ${fmtNumero(d.numero)}`, W - M, 22, { align: "right" });
  doc.text(`Emissão: ${fmtDate(d.dataCriacao)}`, W - M, 27, { align: "right" });
  doc.setDrawColor(...RED).setLineWidth(0.5).line(M, 33, W - M, 33);

  // Info box
  doc.setFillColor(248, 245, 245).rect(M, 37, W - 2 * M, 18, "F");
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text("CLIENTE:", M + 3, 43);
  doc.text("PRAZO DE PAGAMENTO:", M + 3, 50);
  doc.text("VÁLIDA ATÉ:", W / 2 + 15, 50);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(d.cliente || "-", W - 2 * M - 25)[0], M + 20, 43);
  doc.text(d.prazo || "-", M + 42, 50);
  doc.text(fmtDate(d.vencimento), W / 2 + 37, 50);

  // Presentation
  let y = 63;
  doc.setFontSize(9.5).setTextColor(30);
  const pres = doc.splitTextToSize(d.apresentacao || "", W - 2 * M);
  doc.text(pres, M, y);
  y += pres.length * 4.3 + 4;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 18 },
    head: [["Código", "Descrição do produto", "Quantidade", "Valor unitário", "Valor total"]],
    body: d.items.map((it) => [
      it.codigo,
      `${it.descricao} ${it.apresentacao}`.trim(),
      it.qty.toLocaleString("pt-BR"),
      brl(it.unitPrice),
      brl(it.qty * it.unitPrice),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: [210, 210, 210], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: RED, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 248, 248] },
    columnStyles: {
      0: { cellWidth: 24 },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });
  // @ts-expect-error lastAutoTable
  y = doc.lastAutoTable.finalY + 6;

  const ensure = (h: number) => { if (y + h > H - 20) { doc.addPage(); y = 20; } };

  ensure(12);
  doc.setFillColor(...RED).rect(W - M - 95, y - 5, 95, 10, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255);
  doc.text(`VALOR TOTAL DA PROPOSTA: ${brl(propostaTotal(d.items))}`, W - M - 3, y + 1.5, { align: "right" });
  doc.setTextColor(0);
  y += 14;

  ensure(20);
  doc.setFontSize(10).setTextColor(...RED).text("CONDIÇÕES COMERCIAIS", M, y);
  doc.setTextColor(0).setFont("helvetica", "normal").setFontSize(9);
  y += 5;
  doc.text(`Prazo / condição de pagamento: ${d.prazo || "-"}`, M, y); y += 5;
  doc.text(`Vencimento da proposta: ${fmtDate(d.vencimento)}`, M, y); y += 7;

  if (d.obs.trim()) {
    const lines = doc.splitTextToSize(d.obs, W - 2 * M);
    ensure(10);
    doc.setFont("helvetica", "bold").text("Observações:", M, y); y += 5;
    doc.setFont("helvetica", "normal");
    for (const l of lines) { ensure(5); doc.text(l, M, y); y += 4.3; }
    y += 4;
  }

  ensure(40);
  y += 14;
  const colW = (W - 2 * M - 20) / 2;
  doc.setDrawColor(80).setLineWidth(0.3).line(M, y, M + colW, y);
  doc.setFont("helvetica", "bold").setFontSize(9).text(d.assinaturaNome || "Responsável comercial", M, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  let sy = y + 9;
  if (d.assinaturaCargo) { doc.text(d.assinaturaCargo, M, sy); sy += 4; }
  if (d.assinaturaInfo) doc.text(doc.splitTextToSize(d.assinaturaInfo, colW), M, sy);
  doc.text("Rioquímica S.A", M, sy + (d.assinaturaInfo ? doc.splitTextToSize(d.assinaturaInfo, colW).length * 4 : 0));
  if (d.assinaturaCliente) {
    const x = M + colW + 20;
    doc.line(x, y, x + colW, y);
    doc.setFont("helvetica", "bold").setFontSize(9).text("De acordo — Cliente", x, y + 5);
    doc.setFont("helvetica", "normal").setFontSize(8.5).text(d.cliente || "", x, y + 9);
    doc.text("Data: ____/____/______", x, y + 13);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...RED).setLineWidth(0.3).line(M, H - 13, W - M, H - 13);
    doc.setFontSize(7.5).setTextColor(110);
    doc.text("Rioquímica S.A · CNPJ 55.643.555/0001-43 · Tel 55-17-4009-4288", M, H - 8);
    doc.text(pages > 1 ? `Proposta Nº ${fmtNumero(d.numero)} · Página ${i} de ${pages}` : `Proposta Nº ${fmtNumero(d.numero)}`, W - M, H - 8, { align: "right" });
  }
  return doc;
}

export function propostaFilename(d: Pick<PropostaData, "cliente" | "numero">) {
  return `proposta_${fmtNumero(d.numero)}_${(d.cliente || "cliente").replace(/\s+/g, "_")}.pdf`;
}
