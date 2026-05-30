# Recomendação de Domingos por Missa (Gradual Simples)

## Contexto

No Gradual Simples, tempos litúrgicos como o Tempo Comum possuem múltiplas missas (ex: Missa I a VIII). As músicas de cada missa podem ser usadas durante todo o tempo litúrgico, mas há uma **faixa de domingos recomendada** para cada uma.

Exemplo — Tempo Comum:
- Missa I → recomendada entre o 2º e 5º domingo
- Missa II → recomendada entre o 6º e 9º domingo
- ...até Missa VIII

## Proposta: Campos na tabela `missas`

Adicionar `domingo_inicio` e `domingo_fim` (INTEGER, nullable) na tabela `missas`.

### Migration SQL

```sql
ALTER TABLE missas
  ADD COLUMN domingo_inicio INTEGER NULL,
  ADD COLUMN domingo_fim INTEGER NULL;

ALTER TABLE missas ADD CONSTRAINT chk_domingos CHECK (
  (domingo_inicio IS NULL AND domingo_fim IS NULL) OR
  (domingo_inicio IS NOT NULL AND domingo_fim IS NOT NULL AND domingo_inicio <= domingo_fim)
);
```

Missas sem essa lógica (Natal, festas) ficam com ambos NULL.

## Opções de UI

### Opção A — Informativa (simples)
- Fluxo continua igual (selecionar tempo → missa)
- No select de Missa, mostrar a faixa: "Missa I (domingos 2–5)"
- Usuário escolhe sabendo qual é a recomendada

### Opção B — Smart Select (elaborada)
- Após selecionar o tempo litúrgico, campo extra: "Qual domingo?"
- Sistema pré-seleciona a Missa recomendada para aquele domingo
- Usuário pode sobrescrever

### Possível combinar A + B

## Vantagens
- Zero impacto nas músicas (não altera cadastro de música)
- Dados no lugar certo (recomendação é da Missa, não da música)
- Simples de popular (um UPDATE por Missa)
- Flexível (funciona para qualquer tempo litúrgico)

## Status
- [ ] Decisão: Opção A, B ou ambas
- [ ] Criar migration SQL (004)
- [ ] Popular dados (UPDATE nas missas existentes)
- [ ] Implementar UI
