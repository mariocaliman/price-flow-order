import seedData from "@/data/products.json";

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

const CACHE_KEY = "products_catalog_v1";

/** Seed bundled with the app — used as fallback when offline and no cache exists. */
export const seedProducts = seedData as Product[];

export function getCachedProducts(): Product[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { products: Product[] };
    return parsed.products ?? null;
  } catch {
    return null;
  }
}

export function setCachedProducts(products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ products, savedAt: Date.now() }));
  } catch {
    /* ignore quota errors */
  }
}

export function roundToBox(qty: number, box: number, mode: "auto" | "suggest" | "off"): number {
  if (!box || box <= 1 || mode === "off") return Math.max(0, Math.round(qty));
  if (qty <= 0) return 0;
  const mult = Math.ceil(qty / box);
  return mult * box;
}

export function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function calcItemTaxes(unitPrice: number, qty: number, p: Product) {
  const base = (unitPrice || 0) * (qty || 0);
  const imp = (p?.impostos ?? {}) as Partial<Impostos>;
  const ipi = base * (imp.ipi || 0);
  const icms = base * (imp.icms || 0);
  const pis = base * (imp.pis || 0);
  const cofins = base * (imp.cofins || 0);
  const stBase = (base + ipi) * (1 + (imp.ivaSt || 0));
  const stTotal = stBase * (imp.icms || 0);
  const st = Math.max(0, stTotal - icms);
  return { base, ipi, icms, pis, cofins, st, stBase };
}
