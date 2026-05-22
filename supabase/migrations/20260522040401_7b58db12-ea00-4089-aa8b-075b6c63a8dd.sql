
-- Numeração sequencial e total
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero BIGSERIAL,
  ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_numero_unique ON public.pedidos(numero);

-- Bucket privado para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedidos-pdf', 'pedidos-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket: usuário vê apenas seus PDFs (pasta nomeada pelo seu user_id); admin vê tudo
DROP POLICY IF EXISTS "pedidos_pdf_select_own_or_admin" ON storage.objects;
CREATE POLICY "pedidos_pdf_select_own_or_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pedidos-pdf'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "pedidos_pdf_insert_own" ON storage.objects;
CREATE POLICY "pedidos_pdf_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pedidos-pdf'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "pedidos_pdf_update_own_or_admin" ON storage.objects;
CREATE POLICY "pedidos_pdf_update_own_or_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pedidos-pdf'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "pedidos_pdf_delete_own_or_admin" ON storage.objects;
CREATE POLICY "pedidos_pdf_delete_own_or_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pedidos-pdf'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);
