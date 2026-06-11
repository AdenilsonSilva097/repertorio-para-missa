-- ============================================================
-- Repertório para Missa — Buckets e Policies de Storage
-- Executar no SQL Editor do Supabase APÓS as migrações 001-004.
-- ============================================================
--
-- Versiona o que antes era criado manualmente no dashboard (estava apenas
-- comentado na migração 001). Define os buckets "cifras" e "partituras" e as
-- policies de acesso a storage.objects, alinhadas ao mesmo modelo de papéis
-- das demais tabelas (user_role()/user_ativo()).
--
-- Inclui a policy de DELETE — necessária para a limpeza de PDFs órfãos
-- implementada no app (ver removeStorageFileByUrl). Sem ela, a remoção falha
-- silenciosamente e os arquivos antigos permanecem no bucket.
--
-- Idempotente: pode ser reexecutada com segurança.

-- 1. Buckets públicos (PDFs servidos por URL pública)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cifras', 'cifras', true),
       ('partituras', 'partituras', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2. Policies em storage.objects (restritas aos dois buckets do projeto)

-- 2a. Remove as policies manuais antigas (criadas pelo dashboard). As de
--     INSERT estavam aplicadas ao papel "public" — qualquer um com a anon key
--     podia fazer upload. São substituídas pelas policies baseadas em papel
--     abaixo.
DROP POLICY IF EXISTS "Upload público de cifras" ON storage.objects;
DROP POLICY IF EXISTS "Upload público de partituras" ON storage.objects;
DROP POLICY IF EXISTS "Leitura pública de cifras" ON storage.objects;
DROP POLICY IF EXISTS "Leitura pública de partituras" ON storage.objects;

-- Leitura: pública (os buckets são públicos).
DROP POLICY IF EXISTS "Leitura pública de PDFs (cifras/partituras)" ON storage.objects;
CREATE POLICY "Leitura pública de PDFs (cifras/partituras)"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('cifras', 'partituras'));

-- Upload: apenas editor/admin ativos.
DROP POLICY IF EXISTS "Editor/Admin envia PDFs (cifras/partituras)" ON storage.objects;
CREATE POLICY "Editor/Admin envia PDFs (cifras/partituras)"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('cifras', 'partituras')
    AND public.user_role() IN ('admin', 'editor')
    AND public.user_ativo()
  );

-- Atualização: apenas editor/admin ativos.
DROP POLICY IF EXISTS "Editor/Admin atualiza PDFs (cifras/partituras)" ON storage.objects;
CREATE POLICY "Editor/Admin atualiza PDFs (cifras/partituras)"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('cifras', 'partituras')
    AND public.user_role() IN ('admin', 'editor')
    AND public.user_ativo()
  )
  WITH CHECK (
    bucket_id IN ('cifras', 'partituras')
    AND public.user_role() IN ('admin', 'editor')
    AND public.user_ativo()
  );

-- Exclusão: apenas editor/admin ativos (necessária para limpar PDFs órfãos).
DROP POLICY IF EXISTS "Editor/Admin exclui PDFs (cifras/partituras)" ON storage.objects;
CREATE POLICY "Editor/Admin exclui PDFs (cifras/partituras)"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('cifras', 'partituras')
    AND public.user_role() IN ('admin', 'editor')
    AND public.user_ativo()
  );
