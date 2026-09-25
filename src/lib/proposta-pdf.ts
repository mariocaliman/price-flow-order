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
  cidade: string;
  cliente: string;
  contatoNome: string;
  contatoTratamento: string; // ex.: "À Sra.", "Ao Sr."
  prazo: string;
  vencimento: string;
  apresentacao: string;
  diferenciais: string;
  logistica: string;
  compromisso: string;
  obs: string;
  assinaturaNome: string;
  assinaturaCargo: string;
  assinaturaInfo: string;
  assinaturaCliente: boolean;
  items: PropostaItem[];
}

export const DEFAULT_APRESENTACAO =
  "A Rioquímica, empresa com ampla experiência no desenvolvimento e fabricação de soluções para higiene, antissepsia, desinfecção e assistência à saúde, apresenta esta proposta comercial, reafirmando nosso compromisso com qualidade, segurança, desempenho e confiabilidade dos produtos destinados ao ambiente hospitalar.\n\nNossa linha de produtos é desenvolvida seguindo rigorosos padrões de qualidade e Boas Práticas de Fabricação, com controles de processo e matérias-primas que asseguram a padronização e a segurança dos produtos.\n\nUm dos diferenciais do nosso processo produtivo está no rigoroso controle da água utilizada na fabricação, incluindo o emprego de água submetida ao processo de osmose reversa, contribuindo para a obtenção de produtos com elevado padrão de qualidade e controle microbiológico.\n\nOutro importante diferencial da Rioquímica é o investimento contínuo em pesquisa, desenvolvimento e validação de eficácia microbiológica. Dispomos de laudos e estudos de eficácia frente a cepas microbiológicas mais recentes e de relevância para o ambiente hospitalar, proporcionando maior segurança na utilização dos produtos e suporte técnico às instituições de saúde.";

export const DEFAULT_DIFERENCIAIS =
  "Qualidade e segurança: produtos desenvolvidos para atender às necessidades dos serviços de saúde, com rigoroso controle de qualidade.\n\nBoas Práticas de Fabricação: processos produtivos submetidos a controles que buscam garantir padronização, rastreabilidade e segurança dos produtos.\n\nControle da água de processo: utilização de água tratada por osmose reversa, dentro dos controles estabelecidos para o processo produtivo.\n\nEficácia microbiológica: disponibilidade de laudos técnicos de eficácia contra cepas microbiológicas recentes e relevantes, proporcionando maior respaldo técnico para utilização em ambientes hospitalares.\n\nSuporte técnico: a Rioquímica oferece suporte comercial e técnico aos seus parceiros, contribuindo para a correta utilização dos produtos e para a implementação de boas práticas de higiene, antissepsia e desinfecção.";

export const DEFAULT_LOGISTICA =
  "Com o objetivo de proporcionar agilidade, disponibilidade e eficiência no atendimento, a operação logística dos produtos é realizada por distribuidores parceiros da Rioquímica, responsáveis pelo suporte à operação de distribuição, incluindo recebimento, armazenagem e entrega dos produtos, de acordo com os pedidos e necessidades estabelecidas pelo cliente.\n\nEssa estrutura permite maior proximidade no atendimento, contribuindo para a regularidade do abastecimento, agilidade nas entregas e disponibilidade dos produtos, mantendo a Rioquímica como responsável pelo fornecimento e suporte técnico da linha apresentada.";

export const DEFAULT_COMPROMISSO =
  "A Rioquímica coloca-se à disposição para apresentar tecnicamente os produtos, disponibilizar os respectivos documentos e laudos de eficácia, bem como apoiar a equipe na avaliação e validação das soluções propostas.\n\nNosso objetivo é estabelecer uma parceria baseada em qualidade, segurança, eficiência, disponibilidade e custo-benefício, contribuindo para o aprimoramento contínuo dos processos de higiene, antissepsia e desinfecção da instituição.\n\nPermanecemos à disposição para quaisquer esclarecimentos e para uma apresentação técnica dos produtos.";

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

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function fmtDateExtenso(d: string) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${Number(day)} de ${MESES[Number(m) - 1]} de ${y}`;
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
  const M = 20;
  const RED: [number, number, number] = [200, 30, 40];
  const logoData = await loadLogo();
  let y = 0;

  const header = () => {
    if (logoData) { try { doc.addImage(logoData, "JPEG", M, 12, 22, 18); } catch { /* ignore */ } }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...RED);
    doc.text("RIOQUIMICA S.A", M + 26, 18);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(60);
    doc.text("AV. TARRAF, Nr. 2590/2600 · TEL: 55-17-4009-4288", M + 26, 22.5);
    doc.text("CNPJ: 55.643.555/0001-43", M + 26, 26.5);
    doc.setDrawColor(...RED).setLineWidth(0.5).line(M, 33, W - M, 33);
    y = 42;
  };
  header();

  const ensure = (h: number) => { if (y + h > H - 22) { doc.addPage(); header(); } };

  const sectionTitle = (t: string) => {
    ensure(12);
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...RED);
    doc.text(t, M, y);
    y += 6;
  };

  const bodyText = (t: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9.5).setTextColor(30);
    for (const para of t.split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
      const lines = doc.splitTextToSize(para, W - 2 * M);
      for (const l of lines) { ensure(5); doc.text(l, M, y, { align: "justify", maxWidth: W - 2 * M }); y += 4.4; }
      y += 2;
    }
  };

  // Data por extenso
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0);
  const dataExt = `${d.cidade || "São José do Rio Preto"}, ${fmtDateExtenso(d.dataCriacao)}`;
  doc.text(dataExt, M, y);
  y += 10;

  // Título
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...RED);
  doc.text("PROPOSTA COMERCIAL", W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(80);
  doc.text(`Nº ${fmtNumero(d.numero)} · Válida até ${fmtDate(d.vencimento)}`, W / 2, y, { align: "center" });
  y += 9;

  // Cliente / destinatário
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(0);
  doc.text(d.cliente || "-", M, y);
  y += 6;
  if (d.contatoNome.trim()) {
    doc.setFontSize(10);
    doc.text(`${d.contatoTratamento || "À"} ${d.contatoNome} — ${d.cliente}`, M, y);
    y += 7;
  }
  if (d.contatoNome.trim()) {
    const trat = (d.contatoTratamento || "").replace(/^(À|Ao)\s*/i, "");
    doc.text(`Prezad${/sr/i.test(trat) ? "o" : "a"} ${d.contatoNome},`, M, y);
    y += 7;
  }

  // Apresentação
  bodyText(d.apresentacao || "");
  y += 2;

  // Produtos e condições comerciais
  sectionTitle("PRODUTOS E CONDIÇÕES COMERCIAIS");
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    head: [["Produto", "Quantidade", "Valor unitário", "Valor total"]],
    body: d.items.map((it) => [
      `${it.descricao}${it.apresentacao ? ` — ${it.apresentacao}` : ""}`,
      it.qty.toLocaleString("pt-BR"),
      brl(it.unitPrice),
      brl(it.qty * it.unitPrice),
    ]),
    styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      1: { cellWidth: 24, halign: "right" },
      2: { cellWidth: 28, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
    },
  });
  // @ts-expect-error lastAutoTable
  y = doc.lastAutoTable.finalY + 5;

  ensure(12);
  doc.setFillColor(...RED).rect(W - M - 90, y - 4.5, 90, 9, "F");
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(255);
  doc.text(`VALOR TOTAL: ${brl(propostaTotal(d.items))}`, W - M - 3, y + 1.5, { align: "right" });
  doc.setTextColor(0);
  y += 11;

  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(30);
  ensure(6);
  doc.text(`Condição de pagamento: ${d.prazo || "-"} · Proposta válida até ${fmtDate(d.vencimento)}.`, M, y);
  y += 8;

  if (d.diferenciais.trim()) { sectionTitle("DIFERENCIAIS RIOQUÍMICA"); bodyText(d.diferenciais); }
  if (d.logistica.trim()) { sectionTitle("OPERAÇÃO LOGÍSTICA"); bodyText(d.logistica); }
  sectionTitle(`COMPROMISSO COM ${(d.cliente || "O CLIENTE").toUpperCase()}`);
  bodyText(d.compromisso || DEFAULT_COMPROMISSO);

  if (d.obs.trim()) {
    sectionTitle("OBSERVAÇÕES");
    bodyText(d.obs);
  }

  // Assinatura
  ensure(42);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0);
  doc.text("Atenciosamente,", M, y);
  y += 12;
  doc.setDrawColor(80).setLineWidth(0.3).line(M, y, M + 80, y);
  doc.setFont("helvetica", "bold").setFontSize(9.5).text(d.assinaturaNome || "Responsável comercial", M, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  let sy = y + 9.5;
  if (d.assinaturaCargo) { doc.text(`${d.assinaturaCargo} — Rioquímica`, M, sy); sy += 4.2; }
  if (d.assinaturaInfo) {
    for (const l of doc.splitTextToSize(d.assinaturaInfo, 80)) { doc.text(l, M, sy); sy += 4; }
  }
  if (d.assinaturaCliente) {
    const x = W - M - 80;
    doc.setDrawColor(80).line(x, y, x + 80, y);
    doc.setFont("helvetica", "bold").setFontSize(9.5).text("De acordo — Cliente", x, y + 5);
    doc.setFont("helvetica", "normal").setFontSize(8.5).text(d.cliente || "", x, y + 9.5);
    doc.text("Data: ____/____/______", x, y + 13.7);
  }

  // Rodapé em todas as páginas
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
