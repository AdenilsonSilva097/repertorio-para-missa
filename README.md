# 🎵 Repertório para Missa

PWA para gerenciar repertórios musicais de missas católicas. Permite cadastrar músicas, montar repertórios por missa e gerar PDFs unificados com cifras e partituras.

## Funcionalidades

- **Montagem de repertório** — selecione uma missa e escolha músicas momento a momento (Entrada, Ofertório, Comunhão, etc.) com interface de accordion guiado
- **Cadastro de músicas** — com upload de cifra e partitura (PDF), link do YouTube, autor da letra/melodia
- **Sistema de abrangência** — músicas podem ser universais ("todas as missas"), por tempo litúrgico (Quaresma, Advento, etc.) ou vinculadas a uma missa específica
- **Geração de PDF** — mescla cifras e partituras selecionadas em um PDF único com páginas normalizadas em A4
- **Salvar repertórios** — salve e consulte repertórios montados anteriormente
- **Autenticação** — login com Google OAuth via Supabase
- **Controle de acesso** — 3 roles: `leitor` (visualiza e gera PDFs), `editor` (CRUD de músicas), `admin` (gerencia usuários)
- **Painel de administração** — gerenciar usuários, ativar/desativar contas, alterar roles
- **Responsivo** — navbar com dropdowns no desktop e drawer no mobile

## Stack

| Tecnologia | Uso |
|---|---|
| [Next.js 15](https://nextjs.org) (App Router) | Framework React com SSR |
| [Tailwind CSS v4](https://tailwindcss.com) | Estilização utility-first |
| [Shadcn/ui](https://ui.shadcn.com) | Componentes (Button, Input, Select, Checkbox, Label) |
| [Supabase](https://supabase.com) | Auth, banco de dados (PostgreSQL), storage (PDFs) |
| [@supabase/ssr](https://github.com/supabase/ssr) | Auth com cookies no App Router |
| [pdf-lib](https://pdf-lib.js.org) | Merge e normalização de PDFs em A4 |
| [Lucide React](https://lucide.dev) | Ícones |
| [nextjs-toploader](https://github.com/TheSGJ/nextjs-toploader) | Barra de progresso na navegação |

## Pré-requisitos

- Node.js >= 20
- Conta no [Supabase](https://supabase.com) com projeto criado

## Instalação

```bash
# Clone o repositório
git clone https://github.com/AdenilsonSilva097/repertorio-para-missa.git
cd repertorio-para-missa

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com as credenciais do seu projeto Supabase
```

## Configuração do Supabase

1. Crie um projeto no [Supabase](https://app.supabase.com)
2. Execute as migrações SQL **na ordem** no SQL Editor do Supabase:
   - `supabase/migrations/001_create_tables.sql` — schema inicial (missas, músicas, repertórios)
   - `supabase/migrations/002_auth_perfis.sql` — tabela de perfis, trigger, RLS por role
   - `supabase/migrations/003_rename_missas_abrangencia.sql` — sistema de abrangência
3. Configure o provedor de autenticação Google OAuth nas configurações de Auth do Supabase
4. Crie os buckets de storage `cifras` e `partituras` com acesso público para leitura

## Desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Estrutura do projeto

```
src/
├── app/
│   ├── admin/usuarios/    # Painel admin (gerenciar usuários)
│   ├── api/merge-pdfs/    # API Route para merge de PDFs
│   ├── auth/callback/     # Callback do OAuth
│   ├── cadastro/musica/   # Cadastro de músicas
│   ├── login/             # Página de login
│   ├── musicas/           # Edição/exclusão de músicas
│   ├── repertorios/       # Repertórios salvos
│   ├── loading.tsx        # Loading global (Suspense)
│   ├── layout.tsx         # Layout raiz
│   └── page.tsx           # Página principal (montar repertório)
├── components/
│   ├── ui/                # Componentes Shadcn/ui
│   ├── auth-provider.tsx  # Context de autenticação
│   └── navbar.tsx         # Navegação responsiva
├── lib/
│   ├── supabase-browser.ts # Cliente Supabase (browser)
│   ├── supabase-server.ts  # Cliente Supabase (server)
│   └── utils.ts            # Utilitários (cn)
└── middleware.ts           # Proteção de rotas
```

## Deploy

A forma mais simples é usar a [Vercel](https://vercel.com):

1. Conecte o repositório GitHub
2. Configure as variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Deploy automático a cada push

## Licença

Projeto pessoal — uso privado.
