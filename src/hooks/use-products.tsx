import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listProducts } from "@/lib/products.functions";
import {
  getCachedProducts,
  seedProducts,
  setCachedProducts,
  type Product,
} from "@/lib/products";

export function useProducts() {
  const fetchProducts = useServerFn(listProducts);
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window === "undefined") return seedProducts;
    return getCachedProducts() ?? seedProducts;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchProducts()) as Product[];
      setProducts(data);
      setCachedProducts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { products, loading, error, refresh };
}
