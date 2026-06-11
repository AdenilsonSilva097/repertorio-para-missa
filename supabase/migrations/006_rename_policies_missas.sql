-- ============================================================
-- Migration 006: Renomear policies da tabela missas
-- Executar no SQL Editor do Supabase APÓS as migrações 001-005.
-- ============================================================
--
-- A 003 renomeou datas_liturgicas → missas. As policies (criadas na 002)
-- continuaram funcionando por OID, mas mantiveram os nomes antigos
-- ("...datas litúrgicas"). Esta migração apenas alinha os nomes ao domínio
-- atual — não altera o comportamento das policies.
--
-- Idempotente: só renomeia se a policy com o nome antigo ainda existir.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'missas'
      AND policyname = 'Leitura autenticada de datas litúrgicas'
  ) THEN
    ALTER POLICY "Leitura autenticada de datas litúrgicas"
      ON public.missas RENAME TO "Leitura autenticada de missas";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'missas'
      AND policyname = 'Editor/Admin insere datas litúrgicas'
  ) THEN
    ALTER POLICY "Editor/Admin insere datas litúrgicas"
      ON public.missas RENAME TO "Editor/Admin insere missas";
  END IF;
END $$;
