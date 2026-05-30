-- ============================================================
-- Repertório para Missa — Autenticação e Perfis
-- Executar no SQL Editor do Supabase APÓS configurar
-- os providers Google/Facebook no Dashboard
-- ============================================================

-- 1. Tabela de perfis (vinculada a auth.users)
CREATE TABLE perfis (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nome        TEXT,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'leitor' CHECK (role IN ('admin', 'editor', 'leitor')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler perfis
CREATE POLICY "Leitura de perfis autenticados"
  ON perfis FOR SELECT
  TO authenticated
  USING (true);

-- Usuário pode atualizar o próprio perfil (nome apenas)
CREATE POLICY "Atualização do próprio perfil"
  ON perfis FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Apenas admin pode inserir/deletar perfis
CREATE POLICY "Admin insere perfis"
  ON perfis FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM perfis) -- permite o primeiro perfil
  );

CREATE POLICY "Admin deleta perfis"
  ON perfis FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'));

-- 2. Trigger: cria perfil automaticamente ao criar conta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.perfis) THEN 'admin'
      ELSE 'leitor'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Função auxiliar para verificar role do usuário
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.perfis WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Função auxiliar para verificar se está ativo
CREATE OR REPLACE FUNCTION public.user_ativo()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT ativo FROM public.perfis WHERE id = auth.uid()), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 5. Atualizar RLS das tabelas existentes
--    Remover policies antigas e criar novas baseadas em role
-- ============================================================

-- === datas_liturgicas ===
DROP POLICY IF EXISTS "Leitura pública de datas litúrgicas" ON datas_liturgicas;
DROP POLICY IF EXISTS "Inserção pública de datas litúrgicas" ON datas_liturgicas;

CREATE POLICY "Leitura autenticada de datas litúrgicas"
  ON datas_liturgicas FOR SELECT
  TO authenticated
  USING (public.user_ativo());

CREATE POLICY "Editor/Admin insere datas litúrgicas"
  ON datas_liturgicas FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'editor') AND public.user_ativo());

-- === musicas ===
DROP POLICY IF EXISTS "Leitura pública de músicas" ON musicas;
DROP POLICY IF EXISTS "Inserção pública de músicas" ON musicas;
DROP POLICY IF EXISTS "Atualização pública de músicas" ON musicas;
DROP POLICY IF EXISTS "Exclusão pública de músicas" ON musicas;

CREATE POLICY "Leitura autenticada de músicas"
  ON musicas FOR SELECT
  TO authenticated
  USING (public.user_ativo());

CREATE POLICY "Editor/Admin insere músicas"
  ON musicas FOR INSERT
  TO authenticated
  WITH CHECK (public.user_role() IN ('admin', 'editor') AND public.user_ativo());

CREATE POLICY "Editor/Admin atualiza músicas"
  ON musicas FOR UPDATE
  TO authenticated
  USING (public.user_role() IN ('admin', 'editor') AND public.user_ativo())
  WITH CHECK (public.user_role() IN ('admin', 'editor') AND public.user_ativo());

CREATE POLICY "Editor/Admin exclui músicas"
  ON musicas FOR DELETE
  TO authenticated
  USING (public.user_role() IN ('admin', 'editor') AND public.user_ativo());

-- === repertorios ===
DROP POLICY IF EXISTS "Leitura pública de repertórios" ON repertorios;
DROP POLICY IF EXISTS "Inserção pública de repertórios" ON repertorios;
DROP POLICY IF EXISTS "Atualização pública de repertórios" ON repertorios;
DROP POLICY IF EXISTS "Exclusão pública de repertórios" ON repertorios;

CREATE POLICY "Leitura autenticada de repertórios"
  ON repertorios FOR SELECT
  TO authenticated
  USING (public.user_ativo());

CREATE POLICY "Autenticado insere repertórios"
  ON repertorios FOR INSERT
  TO authenticated
  WITH CHECK (public.user_ativo());

CREATE POLICY "Autenticado atualiza repertórios"
  ON repertorios FOR UPDATE
  TO authenticated
  USING (public.user_ativo())
  WITH CHECK (public.user_ativo());

CREATE POLICY "Autenticado exclui repertórios"
  ON repertorios FOR DELETE
  TO authenticated
  USING (public.user_ativo());

-- === repertorio_musicas ===
DROP POLICY IF EXISTS "Leitura pública de repertório_músicas" ON repertorio_musicas;
DROP POLICY IF EXISTS "Inserção pública de repertório_músicas" ON repertorio_musicas;
DROP POLICY IF EXISTS "Exclusão pública de repertório_músicas" ON repertorio_musicas;

CREATE POLICY "Leitura autenticada de repertório_músicas"
  ON repertorio_musicas FOR SELECT
  TO authenticated
  USING (public.user_ativo());

CREATE POLICY "Autenticado insere repertório_músicas"
  ON repertorio_musicas FOR INSERT
  TO authenticated
  WITH CHECK (public.user_ativo());

CREATE POLICY "Autenticado exclui repertório_músicas"
  ON repertorio_musicas FOR DELETE
  TO authenticated
  USING (public.user_ativo());

-- ============================================================
-- 6. Policy para admin atualizar role de outros perfis
-- ============================================================
CREATE POLICY "Admin atualiza qualquer perfil"
  ON perfis FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin'));
