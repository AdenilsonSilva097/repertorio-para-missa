-- ============================================================
-- Repertório para Missa — RPC transacional para salvar repertório
-- Executar no SQL Editor do Supabase APÓS as migrações 001-003.
-- ============================================================
--
-- Motivação: o salvamento de repertório era feito no cliente em vários
-- passos separados (update/delete/insert), sem transação. Uma falha parcial
-- (ex.: delete OK, insert falha) deixava o repertório sem músicas. Esta
-- função executa tudo em uma única transação atômica: se qualquer passo
-- falhar, nada é persistido.
--
-- SECURITY INVOKER (padrão): as policies RLS continuam valendo — quem chama
-- precisa ter permissão de escrita nas tabelas (autenticado e ativo).

CREATE OR REPLACE FUNCTION public.salvar_repertorio(
  p_repertorio_id   UUID,        -- NULL = criar novo; preenchido = atualizar
  p_nome            TEXT,
  p_missa_id        UUID,        -- usado apenas na criação
  p_tipo_exportacao TEXT,
  p_musica_ids      UUID[]
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

  -- Insere as músicas selecionadas (se houver)
  IF p_musica_ids IS NOT NULL AND array_length(p_musica_ids, 1) IS NOT NULL THEN
    INSERT INTO public.repertorio_musicas (repertorio_id, musica_id)
    SELECT v_id, m_id
    FROM unnest(p_musica_ids) AS m_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Permite que usuários autenticados executem a função.
GRANT EXECUTE ON FUNCTION public.salvar_repertorio(UUID, TEXT, UUID, TEXT, UUID[]) TO authenticated;
