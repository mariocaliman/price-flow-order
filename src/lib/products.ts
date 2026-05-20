import data from "@/data/products.json";

export type PriceTable =
  | "Tabela"
  | "RQE Especialista"
  | "RQS Estrategico"
  | "Venda Direta"
  | "PSV"
  | "Benef. FOB SP"
  | "Benef. FOB RJ/MG/RS/SC/PR"
  | "Benef. FOB Restante Brasil"
  | "Preço de Escolha";

export interface Impostos {
  ivaSt: number;
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
}

export interface Product {
  codigo: string;
  descricao: string;
  apresentacao: string;
  ncm: string;
  classificacao: string;
  principioAtivo: string;
  validade: string;
  qtdPorEmbalagem: number;
  linha: string;
  categoria: string;
  divisao: string;
  precos: Record<PriceTable, number | null>;
  impostos: Impostos;
}

export const products: Product[] = data as Product[];

export const priceTables: PriceTable[] = [
  "Tabela",
  "RQE Especialista",
  "RQS Estrategico",
  "Venda Direta",
  "PSV",
  "Benef. FOB SP",
  "Benef. FOB RJ/MG/RS/SC/PR",
  "Benef. FOB Restante Brasil",
  "Preço de Escolha",
];

export const categorias = Array.from(new Set(products.map((p) => p.categoria))).filter(Boolean).sort();
export const divisoes = Array.from(new Set(products.map((p) => p.divisao))).filter(Boolean).sort();

export function roundToBox(qty: number, box: number, mode: "auto" | "suggest" | "off"): number {
  if (!box || box <= 1 || mode === "off") return Math.max(0, Math.round(qty));
  if (qty <= 0) return 0;
  const mult = Math.ceil(qty / box);
  return mult * box;
}

export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Calculate per-item tax breakdown given unit price, quantity and product taxes. */
export function calcItemTaxes(unitPrice: number, qty: number, p: Product) {
  const base = unitPrice * qty;
  const ipi = base * (p.impostos.ipi || 0);
  const icms = base * (p.impostos.icms || 0);
  const pis = base * (p.impostos.pis || 0);
  const cofins = base * (p.impostos.cofins || 0);
  // ICMS-ST (Substituição Tributária) base inclui IPI e MVA (IVA-ST)
  const stBase = (base + ipi) * (1 + (p.impostos.ivaSt || 0));
  const stTotal = stBase * (p.impostos.icms || 0);
  const st = Math.max(0, stTotal - icms);
  return { base, ipi, icms, pis, cofins, st, stBase };
}
