-- ============================================================
-- Migration 007: Saneamento de dados — 'Páscoa' → 'Tempo Pascal'
-- Executar no SQL Editor do Supabase APÓS as migrações 001-006.
-- ============================================================
--
-- O front oferecia 'Páscoa' como tempo litúrgico, enquanto o seed do banco
-- usa 'Tempo Pascal' (ver missas.tempo). Músicas com abrangência por tempo
-- cadastradas como 'Páscoa' nunca casavam com as missas do Tempo Pascal na
-- geração de repertório. O código já foi corrigido (lib/constants.ts); esta
-- migração corrige os dados legados já gravados.
--
-- Confira antes o impacto, se quiser:
--   SELECT count(*) FROM public.musicas WHERE tempo_liturgico = 'Páscoa';

UPDATE public.musicas
SET tempo_liturgico = 'Tempo Pascal'
WHERE tempo_liturgico = 'Páscoa';
