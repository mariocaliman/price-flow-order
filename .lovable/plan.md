## Objetivo
Criar uma seção exclusiva em `/admin/products` onde o admin pode cadastrar, editar (todas as tabelas de preço e impostos), e excluir produtos. Hoje o catálogo vive em `src/data/products.json` (estático, embutido no bundle). Para permitir edição persistente, vamos migrá-lo para o banco.

## Mudanças

### 1. Banco de dados
Criar tabela `public.products`:
- `codigo` (text, PK)
- `descricao`, `apresentacao`, `ncm`, `classificacao`, `principio_ativo`, `validade`, `linha`, `categoria`, `divisao` (text)
- `qtd_por_embalagem` (int)
- `precos` (jsonb) — todas as 9 tabelas
- `impostos` (jsonb) — ivaSt, icms, ipi, pis, cofins
- `created_at`, `updated_at`

RLS:
- SELECT: qualquer autenticado
- INSERT/UPDATE/DELETE: apenas admins (via `has_role`)

Seed: importar os ~N produtos do `src/data/products.json` atual.

### 2. Server functions (`src/lib/products.functions.ts`)
- `listProducts()` — autenticado, retorna catálogo completo
- `upsertProduct(data)` — admin only
- `deleteProduct(codigo)` — admin only

### 3. Catálogo runtime (`src/lib/products.ts`)
- Manter os tipos (`Product`, `PriceTable`, `Impostos`) e helpers (`brl`, `roundToBox`, `calcItemTaxes`)
- Remover o `export const products` estático
- Adicionar `useProducts()` hook: carrega via server fn na 1ª chamada, cacheia em memória + `localStorage` (para suporte offline — mantém o catálogo disponível sem internet)
- `priceTables` permanece estático

### 4. UI — `/` (vendedor)
- `src/routes/index.tsx` passa a usar `useProducts()` em vez do import estático
- `categorias` recalculadas dinamicamente do catálogo carregado
- Estado de loading enquanto busca; usa cache do `localStorage` quando offline

### 5. UI — `/admin/products` (novo)
Rota nova `src/routes/admin.products.tsx` com:
- Tabela com busca por código/descrição, paginada
- Botão "Novo produto" → dialog com formulário completo (todos os campos + 9 preços + 5 impostos)
- Editar (mesmo dialog pré-preenchido)
- Excluir (com confirmação)
- Link no header do `/admin` ao lado de "Dashboard"

### 6. PDF (`src/lib/pdf.ts`)
Não muda — continua recebendo `Product` por parâmetro.

## Detalhes técnicos
- Migração SQL com seed via `INSERT ... ON CONFLICT DO NOTHING` lendo do JSON (gerado programaticamente).
- Cache `localStorage` key: `products_catalog_v1` com timestamp; revalida quando online.
- Form de admin usa zod para validar números ≥ 0, percentuais 0–1, código único.

## Fora de escopo
- Histórico de alterações de preço
- Importação em massa via CSV (pode ser próximo passo)
- Edição de impostos por região/estado
