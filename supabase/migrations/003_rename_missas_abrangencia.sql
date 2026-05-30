-- ============================================================
-- Migration 003: Renomear datas_liturgicas → missas
--                Adicionar campo abrangência nas músicas
-- ============================================================

-- 1. Renomear tabela datas_liturgicas → missas
ALTER TABLE datas_liturgicas RENAME TO missas;

-- 2. Renomear coluna nas tabelas relacionadas
ALTER TABLE musicas RENAME COLUMN data_liturgica_id TO missa_id;
ALTER TABLE repertorios RENAME COLUMN data_liturgica_id TO missa_id;

-- 3. Renomear índices (drop e recria com novo nome)
DROP INDEX IF EXISTS idx_musicas_data_liturgica;
DROP INDEX IF EXISTS idx_repertorios_data_liturgica;
CREATE INDEX idx_musicas_missa ON musicas (missa_id);
CREATE INDEX idx_repertorios_missa ON repertorios (missa_id);

-- 4. Criar enum de abrangência
CREATE TYPE abrangencia_musica AS ENUM ('todas', 'tempo_liturgico', 'data_especifica');

-- 5. Adicionar campos de abrangência na tabela musicas
ALTER TABLE musicas
  ADD COLUMN abrangencia abrangencia_musica NOT NULL DEFAULT 'data_especifica',
  ADD COLUMN tempo_liturgico TEXT NULL;

-- 6. Tornar missa_id opcional (para músicas com abrangência 'todas' ou 'tempo_liturgico')
ALTER TABLE musicas ALTER COLUMN missa_id DROP NOT NULL;

-- 7. Constraint: garantir consistência entre abrangência e campos
--    - data_especifica: missa_id obrigatório
--    - tempo_liturgico: tempo_liturgico obrigatório, missa_id opcional
--    - todas: ambos opcionais
ALTER TABLE musicas ADD CONSTRAINT chk_abrangencia_musica CHECK (
  (abrangencia = 'data_especifica' AND missa_id IS NOT NULL) OR
  (abrangencia = 'tempo_liturgico' AND tempo_liturgico IS NOT NULL) OR
  (abrangencia = 'todas')
);

-- 8. Índice para busca por tempo litúrgico
CREATE INDEX idx_musicas_tempo_liturgico ON musicas (tempo_liturgico) WHERE tempo_liturgico IS NOT NULL;

-- 9. Índice para busca por abrangência
CREATE INDEX idx_musicas_abrangencia ON musicas (abrangencia);

-- 10. Atualizar RLS policies que referenciam o nome antigo (se necessário)
--     As policies existentes continuam funcionando porque referenciam
--     a tabela pelo OID, não pelo nome. Mas caso haja erro, recrie:

-- Policies da tabela missas (antigo datas_liturgicas)
-- As policies existentes devem funcionar automaticamente após o RENAME.
-- Se não funcionarem, execute:
-- DROP POLICY IF EXISTS "Leitura autenticada de datas litúrgicas" ON missas;
-- CREATE POLICY "Leitura autenticada de missas"
--   ON missas FOR SELECT TO authenticated
--   USING (public.user_ativo());
-- DROP POLICY IF EXISTS "Editor/Admin insere datas litúrgicas" ON missas;
-- CREATE POLICY "Editor/Admin insere missas"
--   ON missas FOR INSERT TO authenticated
--   WITH CHECK (public.user_role() IN ('admin', 'editor') AND public.user_ativo());
