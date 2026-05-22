
# Plano: Histórico aprimorado, Envio por WhatsApp/Email e Dashboard Admin

Vou implementar os 3 itens em paralelo, reaproveitando ao máximo o que já existe (a tela `/` já tem um histórico básico de pedidos e geração de PDF).

---

## 1) Histórico de pedidos aprimorado

Hoje já existe um botão "Histórico" em `src/routes/index.tsx` que lista e permite **reabrir** um pedido. Vou adicionar:

- **Duplicar pedido** → carrega o pedido no formulário porém limpa cliente/data/observações (mantém itens + tabela), pronto pra ser salvo como novo.
- **Reemitir PDF direto do histórico** → botão que reconstrói o PDF sem precisar reabrir.
- **Excluir pedido** (com confirmação) — admin ou dono.
- **Total do pedido** visível na linha do histórico (calculado a partir do payload).
- **Ordenação por data** e **paginação leve** (carregar mais).
- **Número sequencial** estável do pedido (campo `numero` autoincrementado no banco) exibido no histórico e no PDF — substitui o `#timestamp` atual.

### Mudança de banco
- Adicionar coluna `numero BIGSERIAL UNIQUE` em `pedidos` (preenchida automaticamente).
- Adicionar coluna `total NUMERIC(12,2)` em `pedidos` (gravada no `savePedido`).

---

## 2) Envio do pedido por WhatsApp e Email

A web não permite anexar arquivos via `wa.me`. Solução robusta:

1. **Storage de PDFs**: criar bucket `pedidos-pdf` (privado) no Lovable Cloud.
2. Ao clicar em **"Enviar"**:
   - Gerar o PDF (função já existe).
   - Fazer upload para `pedidos-pdf/{user_id}/{pedido_id}.pdf`.
   - Gerar **signed URL** válida por 30 dias.
3. Abrir modal de envio com 3 opções:
   - **WhatsApp** → abre `https://wa.me/?text=...` com mensagem pré-formatada contendo cliente, total e o link do PDF.
   - **Email** → abre `mailto:?subject=...&body=...` com mesma mensagem + link.
   - **Copiar link** → copia a URL pro clipboard.
4. Campo opcional de "telefone do cliente" no cabeçalho do pedido (salvo no `payload`) — se preenchido, vai pré-formatado no link do WhatsApp (`wa.me/55DDDNUMERO?text=...`).

> Observação: envio automatizado (sem clique do vendedor) exigiria integração WhatsApp Business API ou serviço de email — fica para iteração futura. Esta versão é **um clique → WhatsApp Web/Email do dispositivo** com PDF anexado via link.

### Mudança de banco
- Bucket de storage `pedidos-pdf` com policies: usuário só lê/escreve sob `auth.uid()/...`; admin lê tudo.
- Coluna opcional `cliente_telefone TEXT` no payload (não precisa de migration, fica no JSON).

---

## 3) Dashboard administrativo de métricas

Nova rota **`/admin/dashboard`** (apenas admin, mesmo padrão de proteção da rota `/admin`).

Métricas e gráficos (usando `recharts`, já comum em projetos shadcn):

- **Filtros**: período (últimos 7d / 30d / 90d / customizado) e vendedor (multi-select).
- **Cards de resumo**: nº de pedidos, faturamento total, ticket médio, nº de clientes únicos.
- **Gráfico de linha**: faturamento por dia.
- **Gráfico de barras**: pedidos por vendedor (Top 10).
- **Tabela**: Top 20 produtos mais vendidos (qtd e faturamento) — derivada do `payload.items`.
- **Tabela**: Top 10 clientes (por faturamento).
- **Distribuição por tabela de preço** (pizza/donut).

### Como buscar os dados
- Server function `getDashboardMetrics({ from, to, vendedorIds })` em `src/lib/dashboard.functions.ts` usando `requireSupabaseAuth` + checagem `isAdmin`.
- Lê `pedidos` (admin pode ver todos via RLS) + `profiles` para nome do vendedor.
- Agrega no servidor para não trafegar todos os payloads.

### Navegação
- Adicionar link "Dashboard" no header admin do app (visível só quando `auth.isAdmin`).

---

## Resumo técnico (para minha referência)

| Arquivo | Mudança |
|---|---|
| `supabase migration` | `numero BIGSERIAL UNIQUE`, `total NUMERIC` em `pedidos`; criar bucket `pedidos-pdf` + policies |
| `src/routes/index.tsx` | Botões Duplicar/Reemitir PDF/Excluir no histórico; coluna total; nº sequencial; campo telefone cliente; modal "Enviar" (WhatsApp/Email/Copiar) |
| `src/lib/pdf.ts` *(novo)* | Extrair `exportPDF` para reuso entre tela e histórico |
| `src/lib/dashboard.functions.ts` *(novo)* | Server fn `getDashboardMetrics` |
| `src/routes/admin.dashboard.tsx` *(novo)* | Página com filtros, cards, gráficos (recharts) |
| `src/routes/admin.tsx` | Link "Dashboard" |
| `bun add` | `recharts` (se não estiver) e `date-fns` para filtros de período |

Pronto para implementar — confirma para eu começar?
