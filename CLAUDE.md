# CLAUDE.md — Repertório para Missa

Documento de contexto para o Claude Code. Descreve a arquitetura, convenções e fluxos do projeto para que futuras alterações sejam feitas com segurança e consistência.

> **Idioma:** todo o código de domínio (variáveis, tabelas, mensagens, UI) está em **português**. Mantenha esse padrão em novas contribuições.

---

## 1. Visão Geral

PWA para gestão de **repertório musical litúrgico** de missas católicas. Permite cadastrar músicas (cifras/partituras em PDF, YouTube, autores) associadas aos momentos da missa e a datas/tempos litúrgicos, montar o repertório de uma celebração e **gerar um PDF unificado** (cifras ou partituras mescladas em A4) para impressão. Inclui autenticação OAuth, controle de papéis (admin/editor/leitor) e repertórios salvos.

Projeto **monolítico**: um único app Next.js 15 (App Router) com **Supabase** como backend completo (Auth + Postgres + Storage). Não há backend separado — as páginas client falam direto com o Supabase; existe apenas **uma** rota de API server-side (merge de PDFs).

---

## 2. Arquitetura

Padrão **client-heavy / BaaS (Backend-as-a-Service)**.

```
Navegador (PWA, React 19 Client Components)
  ├─ Páginas "use client" → falam DIRETO com o Supabase (supabase-js, chave anon)
  ├─ Service Worker (public/sw.js) — network-first p/ navegações, SWR p/ assets
  └─ POST /api/merge-pdfs → Route Handler (Node) baixa PDFs e mescla com pdf-lib
                │
                ▼
Supabase (BaaS)
  ├─ PostgreSQL + Row Level Security (segurança real vive aqui)
  ├─ Auth (Google / Facebook OAuth)
  └─ Storage (buckets "cifras" e "partituras", PDFs públicos)

Middleware (src/middleware.ts) — roda no Edge, valida sessão e protege rotas.
```

**Princípios arquiteturais (importante para alterações):**
- **Segurança = RLS no Postgres**, não a camada de aplicação. As checagens de `isEditor`/`isAdmin` no front controlam apenas a **exibição** da UI; quem realmente autoriza leitura/escrita são as policies em `supabase/migrations/002_auth_perfis.sql`. Ao adicionar uma nova operação de dados, **verifique/atualize as policies RLS** correspondentes.
- O acesso a dados (CRUD de missas, músicas, repertórios, perfis) é feito **no cliente** via SDK Supabase. Não existe (e não se espera) uma API REST própria para isso.
- A única lógica server-side de negócio é `/api/merge-pdfs` (exige sessão autenticada e só baixa PDFs do host do Supabase Storage — allowlist anti-SSRF).

---

## 3. Stack / Dependências

| Camada | Tecnologia |
|---|---|
| Framework | Next.js **15.5** (App Router) + React **19.2** |
| Linguagem | TypeScript **5** (strict, `target ES2017`) |
| Estilo | Tailwind CSS **v4** (`@tailwindcss/postcss`), `tw-animate-css`, `next-themes` (dark mode) |
| UI | Radix UI (`checkbox`, `label`, `select`, `slot`) no padrão **shadcn/ui**; `class-variance-authority`, `clsx`, `tailwind-merge`; ícones **lucide-react** |
| Backend/BaaS | **Supabase**: `@supabase/supabase-js`, `@supabase/ssr` (Auth, Postgres, Storage) |
| PDFs | **pdf-lib** (mescla server-side) |
| PWA | Web App Manifest (`src/app/manifest.ts`) + Service Worker manual (`public/sw.js`) |
| UX | `nextjs-toploader` (barra de progresso de navegação) |
| Lint | ESLint 9 + `eslint-config-next` |
| Gerenciador de pacotes | **Yarn** (há `yarn.lock`) |

**Dependências externas críticas:**
- **Supabase** — sem ele a aplicação não funciona. Config via `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Provedores OAuth** Google e Facebook (configurados no dashboard Supabase).
- YouTube e URLs de PDF: apenas links armazenados / baixados; sem integração de API.
- Não há filas, mensageria, cache distribuído ou outros serviços.

---

## 4. Estrutura de Pastas

```
src/
├── app/                          # App Router (rotas = pastas)
│   ├── page.tsx                  # HOME: monta repertório + gera PDF (fluxo central)
│   ├── layout.tsx                # Layout raiz: ThemeProvider, AuthProvider, Navbar, SW, TopLoader
│   ├── loading.tsx               # UI de loading global
│   ├── globals.css               # Tailwind v4 + variáveis CSS de tema
│   ├── manifest.ts               # Web App Manifest (PWA)
│   ├── login/page.tsx            # Login OAuth (Google/Facebook)
│   ├── auth/callback/route.ts    # Troca "code" OAuth → sessão (GET)
│   ├── api/merge-pdfs/route.ts   # ÚNICA API: mescla PDFs com pdf-lib (POST)
│   ├── cadastro/musica/page.tsx  # Cadastro de música (editor+)
│   ├── musicas/page.tsx          # Listar/editar/excluir músicas (editor+)
│   ├── repertorios/page.tsx      # Repertórios salvos + regerar PDF (leitor+)
│   └── admin/usuarios/page.tsx   # Gestão de usuários/papéis (admin)
├── components/
│   ├── auth-provider.tsx         # Context de auth: user, perfil, isAdmin, isEditor, signOut
│   ├── navbar.tsx                # Navegação responsiva, filtrada por papel
│   ├── sw-registrar.tsx          # Registra o service worker
│   └── ui/                       # Componentes shadcn/Radix (button, input, select, checkbox, label)
├── lib/
│   ├── supabase-browser.ts       # createSupabaseBrowser() — client p/ Client Components (SSR cookies)
│   ├── supabase-server.ts        # createSupabaseServer() — client p/ Server Components/Route Handlers
│   ├── supabase.ts               # client simples legado (evitar; ver Pontos de Atenção)
│   ├── constants.ts              # MOMENTOS_MISSA/ORDEM_MOMENTOS/TEMPOS_LITURGICOS (fonte única)
│   ├── storage.ts                # helpers de Storage (path da URL pública; remover arquivo)
│   └── utils.ts                  # cn() = twMerge(clsx(...))
└── middleware.ts                 # Gate de autenticação (redirect p/ /login)

supabase/migrations/              # Fonte da verdade do schema (SQL aplicado manualmente)
├── 001_create_tables.sql         # Tabelas, enums, RLS inicial, seed do ano litúrgico 2026 (Ano C)
├── 002_auth_perfis.sql           # perfis, trigger handle_new_user, RLS baseado em papel
├── 003_rename_missas_abrangencia.sql  # datas_liturgicas→missas; campo abrangencia
├── 004_rpc_salvar_repertorio.sql # RPC transacional p/ salvar repertório (atômico)
├── 005_storage_policies.sql      # buckets + policies de Storage (leitura pública; escrita editor/admin)
├── 006_rename_policies_missas.sql # renomeia policies de missas (cosmético)
└── 007_sanitize_tempo_pascal.sql # saneamento de dados: 'Páscoa' → 'Tempo Pascal'

public/                           # Ícones PWA, sw.js, favicons, SVGs
```

**Responsabilidades:** `app/` = rotas e UI; `components/` = UI reutilizável + estado de auth; `lib/` = clients Supabase e utilitários; `supabase/migrations/` = schema versionado.

---

## 5. Modelo de Dados (PostgreSQL / Supabase)

Tabelas (ver `supabase/migrations/`):

| Tabela | Descrição |
|---|---|
| `missas` (ex-`datas_liturgicas`) | Celebração/data litúrgica. Campos: `nome` (único), `tempo`, `ordem`. Seed: ano litúrgico **2026 (Ano C)**, 62 registros. |
| `musicas` | `titulo`, `autor_letra`, `autor_melodia`, `momento` (enum), `youtube_url`, `cifra_pdf_url`, `partitura_pdf_url`, `abrangencia` (enum), `tempo_liturgico`, `missa_id` (FK opcional). |
| `repertorios` | Repertório salvo p/ uma missa. Campos: `nome`, `missa_id`, `tipo_exportacao` ('cifra'\|'partitura'). |
| `repertorio_musicas` | Junção N:N repertório↔música (`UNIQUE(repertorio_id, musica_id)`). |
| `perfis` | Vinculado a `auth.users`. Campos: `nome`, `email`, `role` ('admin'\|'editor'\|'leitor'), `ativo`. |

**Enums:**
- `momento_missa`: `Entrada, Ato Penitencial, Glória, Salmo, Aclamação, Ofertório, Santo, Cordeiro, Comunhão, Ação de Graças, Final` (esta é a **ordem canônica** dos momentos).
- `abrangencia_musica`: `todas` | `tempo_liturgico` | `data_especifica`.

**Regra de negócio `abrangencia`** (CHECK constraint no banco):
- `data_especifica` → `missa_id` obrigatório.
- `tempo_liturgico` → `tempo_liturgico` obrigatório, `missa_id` nulo.
- `todas` → ambos opcionais.

**RLS / papéis:**
- Leitura: usuários autenticados e `ativo`.
- Insert/Update/Delete de `musicas` e `missas`: apenas `editor`/`admin` ativos.
- `repertorios`/`repertorio_musicas`: qualquer autenticado ativo.
- `perfis`: admin gerencia papéis; trigger `handle_new_user` cria perfil ao registrar — **o primeiro usuário vira `admin`**, os demais `leitor`.
- Funções SQL auxiliares: `user_role()`, `user_ativo()`.

**Storage:** buckets `cifras` e `partituras` (PDFs públicos). As policies de Storage estão **versionadas** em `005_storage_policies.sql`: leitura pública; `INSERT`/`UPDATE`/`DELETE` restritos a `editor`/`admin` ativos (mesmo modelo de papéis das tabelas).

---

## 6. Fluxos de Negócio

**A. Autenticação** — `/login` → OAuth Google/Facebook → redireciona p/ `/auth/callback` (`route.ts`) que troca `code` por sessão → `middleware.ts` protege todas as rotas exceto `/login` e `/auth/callback`. `AuthProvider` carrega `perfil` e expõe `isAdmin`/`isEditor`.

**B. Montar repertório + gerar PDF** (`src/app/page.tsx`, fluxo central):
1. Usuário escolhe Tempo Litúrgico → Missa.
2. `loadMusicas()` faz **3 queries paralelas**: músicas `data_especifica` da missa + `tempo_liturgico` do tempo + `todas`; resultado é deduplicado por `id` e ordenado por `ORDEM_MOMENTOS`.
3. Accordion guiado por momento, com avanço automático ao selecionar (uma música por momento).
4. "Gerar PDF" → se já existe repertório p/ a missa, abre **modal de duplicidade** (atualizar / criar novo / apenas gerar). Salva via RPC `salvar_repertorio` (transação atômica em `repertorios` + `repertorio_musicas`) e chama `POST /api/merge-pdfs` com as URLs de cifra **ou** partitura.
5. `/api/merge-pdfs` baixa cada PDF, normaliza para A4 (pdf-lib) e devolve o arquivo para download no navegador.

**C. Cadastro/edição de músicas** (`cadastro/musica`, `musicas`; editor+) — upload de PDFs para os buckets `cifras`/`partituras` via `supabase.storage`, captura da URL pública, e insert/update em `musicas`. Edição permite trocar/remover PDFs.

**D. Gestão de usuários** (`admin/usuarios`; admin) — alterar `role` e ativar/desativar usuários.

---

## 7. Convenções de Código

- **TypeScript strict**; tipos locais declarados no topo de cada arquivo (`type Missa`, `type Musica`, ...). Não há camada de tipos compartilhada — se um tipo for usado em 2+ lugares, considere centralizar.
- **Alias de import:** `@/*` → `./src/*` (ex.: `@/lib/supabase-browser`, `@/components/ui/button`).
- **Client vs Server:**
  - Páginas interativas começam com `"use client"` e usam `createSupabaseBrowser()`.
  - Server Components / Route Handlers usam `createSupabaseServer()` (de `lib/supabase-server.ts`).
  - **Não** usar `lib/supabase.ts` (client legado sem SSR) em código novo.
- **UI / Tailwind:**
  - Componentes shadcn/ui em `components/ui` (config em `components.json`: style `base-nova`, baseColor `neutral`, ícones `lucide`).
  - Compor classes com `cn()` de `@/lib/utils`.
  - Suporte a **dark mode** via `next-themes` (classe `dark:`). Sempre fornecer variante dark em cores de feedback.
  - Mobile-first; largura típica de página `max-w-lg`/`max-w-3xl` centralizada.
- **Padrão de mensagens de feedback:** estado `mensagem: { tipo: "sucesso" | "erro"; texto: string } | null`, renderizado com classes verde/vermelho (+ variantes dark). Reutilize esse padrão.
- **Constantes de domínio centralizadas:** `MOMENTOS_MISSA`/`ORDEM_MOMENTOS` e `TEMPOS_LITURGICOS` vivem em `@/lib/constants` (fonte única, importada por `page.tsx`, `cadastro/musica` e `musicas`). Os valores **devem casar exatamente** com o banco (enum `momento_missa` e a coluna `missas.tempo` — atenção a `'Tempo Pascal'`, não `'Páscoa'`). Ao adicionar/alterar tempos ou momentos, mexa **só** nesse arquivo.
- **Idioma:** nomes de domínio, comentários e textos de UI em **português**.
- **Permissões na UI:** páginas restritas checam `isEditor`/`isAdmin` do `useAuth()` e renderizam um aviso ou `router.replace("/")`. Sempre acompanhe com a policy RLS correspondente.

---

## 8. Comandos

**Execução / desenvolvimento:**
```powershell
yarn install        # instalar dependências (usa yarn.lock)
yarn dev            # dev server → http://localhost:3000
```

**Build / produção:**
```powershell
yarn build          # build de produção (next build)
yarn start          # servir o build (next start)
```

**Lint:**
```powershell
yarn lint           # eslint (eslint-config-next, core-web-vitals + typescript)
```

**Testes:** ⚠️ **Não há testes automatizados** nem framework de teste configurado no projeto. Não existe script `test`. Validação é manual via `yarn dev`.

**Setup inicial do Supabase (manual, fora do `yarn`):**
1. Criar projeto no Supabase; copiar URL e anon key para `.env.local` (ver `.env.local.example`).
2. Aplicar **todas** as migrações de `supabase/migrations/` em ordem (001→007) no SQL Editor.
3. Os buckets `cifras`/`partituras` e suas policies são criados pela migração `005` (não é mais necessário criar manualmente no dashboard).
4. Configurar provedores OAuth Google e Facebook no dashboard.
5. O primeiro usuário a logar recebe papel `admin` automaticamente.

**Variáveis de ambiente** (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 9. Padrões Utilizados

- **BaaS / client-direct data access** — UI fala direto com o Supabase; sem camada de serviço própria.
- **RLS-first security** — autorização no banco; UI só esconde/exibe.
- **App Router** com Server/Client Components, Route Handlers e Middleware (Next.js 15).
- **Context API** para estado de auth global (`AuthProvider` + `useAuth`).
- **shadcn/ui** (Radix + Tailwind + CVA) para componentes.
- **PWA** com manifest + service worker (network-first p/ navegações HTML; stale-while-revalidate p/ assets; bypass para `/api/`, `/auth/`, `supabase`).
- **Optimistic UI / re-fetch** — após mutações, re-busca a lista (ex.: `fetchMusicas()`), sem cache global de dados.

---

## 10. Pontos de Atenção (dívida técnica conhecida)

Considere ao mexer nestas áreas:

1. **`lib/supabase.ts` é legado** (sem SSR) — não usar em código novo; possível código morto.
2. **Sem testes automatizados** nem framework de teste; validação é manual via `yarn dev`.
3. **Limpeza de Storage é best-effort** — `removeStorageFileByUrl` (em `lib/storage.ts`) loga e segue se falhar; depende da policy de `DELETE` da migração `005` estar aplicada.
4. **Fluxos client-side multi-passo remanescentes** — o salvar-repertório já é atômico (RPC `salvar_repertorio`), mas o cadastro/edição de música ainda faz upload + insert/update sequenciais (não transacionais).

> **Resolvidos na auditoria (código + migrações 004–007):** SSRF/sem-auth em `/api/merge-pdfs` (auth + allowlist); divergência `'Páscoa'`×`'Tempo Pascal'` e constantes duplicadas (→ `lib/constants.ts`); salvar repertório sem transação (→ RPC `salvar_repertorio`); erros de leitura silenciados (agora surfaçados); PDFs órfãos no Storage (→ `lib/storage.ts`); policies de Storage não versionadas (→ `005`); Service Worker com cache fixo `v1` (agora network-first); nomes antigos das policies de `missas` (→ `006`); `favicon.ico` duplicado.

---

## 11. Melhorias Futuras (planejadas, ainda não implementadas)

### Auth inicial via SSR (eliminar o "flash" da navbar)
**Problema:** o estado de auth (usuário + `role`) é resolvido só no cliente, após a hidratação, via `fetchPerfil` (rede). Por isso a navbar — que depende do papel — só aparece depois desse round-trip em loads completos (F5), causando pop-in dos links por papel e layout shift.

**Mitigação atual (implementada):** a navbar não esconde mais a barra inteira durante `loading`; renderiza a casca (`h-14` reservada) com os links base (leitor) e um avatar placeholder, e os links de editor/admin preenchem quando o perfil carrega. Resolve o sumiço da barra e o layout shift; resta apenas os links por papel surgindo um instante depois, só no F5.

**Solução definitiva (opção 4, não implementada):** buscar sessão + perfil **no servidor** (o `layout.tsx` já é Server Component; `createSupabaseServer()` e os cookies SSR já existem) e injetar `initialUser`/`initialPerfil` como props no `AuthProvider`, que passa a iniciar com `loading=false`. A navbar sai correta (inclusive editor/admin) no primeiro HTML, sem gate, sem flash e com hidratação consistente. Arquivos afetados: `layout.tsx` (async + fetch), `auth-provider.tsx` (props iniciais + guard no `onAuthStateChange` para evitar refetch), `navbar.tsx` (remover o resíduo de `loading`). Trade-off: latência migra para o TTFB (cacheável por request) e exige cuidado com hydration mismatch. Vale a pena fazer junto com qualquer outra migração de auth para SSR.

---

_Ao concluir uma alteração: rode `yarn lint` e valide manualmente com `yarn dev`. Mudanças de schema vão para uma nova migração em `supabase/migrations/` (numeração sequencial) e exigem ajuste das policies RLS quando envolvem novas operações de dados._
