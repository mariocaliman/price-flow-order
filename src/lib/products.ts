import data from "@/data/products.json";

export type PriceTable = "Tabela" | "RQE Especialista" | "RQS Estrategico" | "Venda Direta";

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
}

export const products: Product[] = data as Product[];

export const priceTables: PriceTable[] = [
  "Tabela",
  "RQE Especialista",
  "RQS Estrategico",
  "Venda Direta",
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
