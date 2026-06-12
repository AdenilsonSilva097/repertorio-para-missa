-- ============================================================
-- Repertório para Missa — formato (cifra/partitura) por música
-- Executar no SQL Editor do Supabase APÓS as migrações 001-007.
-- ============================================================
--
-- Motivação: o tipo de exportação (cifra/partitura) era único por repertório
-- (coluna `repertorios.tipo_exportacao`) e valia para TODAS as músicas. Esta
-- migração permite escolher o formato POR MÚSICA: adiciona a coluna
-- `tipo_exportacao` à tabela de junção `repertorio_musicas` e atualiza a RPC
-- `salvar_repertorio` para gravar o tipo de cada música.
--
-- `repertorios.tipo_exportacao` permanece como o PADRÃO a nível de repertório
-- (usado como fallback e exibido como rótulo na lista de repertórios salvos).

-- 1. Coluna de formato por música na tabela de junção.
ALTER TABLE public.repertorio_musicas
  ADD COLUMN tipo_exportacao TEXT NOT NULL DEFAULT 'cifra'
  CHECK (tipo_exportacao IN ('cifra', 'partitura'));

-- 2. Backfill: linhas existentes herdam o tipo do repertório pai.
UPDATE public.repertorio_musicas rm
  SET tipo_exportacao = r.tipo_exportacao
  FROM public.repertorios r
  WHERE rm.repertorio_id = r.id
    AND r.tipo_exportacao IN ('cifra', 'partitura');

-- 3. Nova assinatura da RPC: recebe as músicas com seu formato via JSONB.
--    A assinatura antiga (…, UUID[]) precisa ser removida explicitamente,
--    pois mudar o tipo do último parâmetro cria uma sobrecarga (overload).
DROP FUNCTION IF EXISTS public.salvar_repertorio(UUID, TEXT, UUID, TEXT, UUID[]);

CREATE OR REPLACE FUNCTION public.salvar_repertorio(
  p_repertorio_id   UUID,        -- NULL = criar novo; preenchido = atualizar
  p_nome            TEXT,
  p_missa_id        UUID,        -- usado apenas na criação
  p_tipo_exportacao TEXT,        -- padrão a nível de repertório (fallback)
  p_musicas         JSONB        -- [{ "id": uuid, "tipo": "cifra"|"partitura" }]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_repertorio_id IS NULL THEN
    -- Criação
    INSERT INTO public.repertorios (nome, missa_id, tipo_exportacao)
    VALUES (p_nome, p_missa_id, p_tipo_exportacao)
    RETURNING id INTO v_id;
  ELSE
    -- Atualização do existente
    UPDATE public.repertorios
    SET nome = p_nome,
        tipo_exportacao = p_tipo_exportacao,
        updated_at = now()
    WHERE id = p_repertorio_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Repertório não encontrado ou sem permissão: %', p_repertorio_id;
    END IF;

    -- Substitui o conjunto de músicas
    DELETE FROM public.repertorio_musicas WHERE repertorio_id = v_id;
  END IF;

  -- Insere as músicas selecionadas com seu formato (se houver).
  -- COALESCE garante o fallback ao padrão do repertório quando "tipo" vier nulo.
  IF p_musicas IS NOT NULL AND jsonb_array_length(p_musicas) > 0 THEN
    INSERT INTO public.repertorio_musicas (repertorio_id, musica_id, tipo_exportacao)
    SELECT v_id,
           (e->>'id')::UUID,
           COALESCE(e->>'tipo', p_tipo_exportacao)
    FROM jsonb_array_elements(p_musicas) AS e;
  END IF;

  RETURN v_id;
END;
$$;

-- Permite que usuários autenticados executem a nova assinatura da função.
GRANT EXECUTE ON FUNCTION public.salvar_repertorio(UUID, TEXT, UUID, TEXT, JSONB) TO authenticated;
