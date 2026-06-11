// Constantes de domínio compartilhadas.
// IMPORTANTE: os valores DEVEM corresponder exatamente aos dados do banco —
// o enum `momento_missa` e os valores da coluna `missas.tempo` do seed
// (supabase/migrations/001_create_tables.sql). Manter centralizado aqui evita
// divergências entre telas (ex.: 'Páscoa' no front x 'Tempo Pascal' no banco).

// Ordem canônica dos momentos da missa (também usada para ordenar/agrupar).
export const MOMENTOS_MISSA = [
  "Entrada",
  "Ato Penitencial",
  "Glória",
  "Salmo",
  "Aclamação",
  "Ofertório",
  "Santo",
  "Cordeiro",
  "Comunhão",
  "Ação de Graças",
  "Final",
];

// Alias semântico: a ordem dos momentos é a própria ordem do array acima.
export const ORDEM_MOMENTOS = MOMENTOS_MISSA;

// Tempos litúrgicos — valores idênticos aos da coluna `missas.tempo`.
export const TEMPOS_LITURGICOS = [
  "Advento",
  "Tempo do Natal",
  "Tempo Comum",
  "Quaresma",
  "Tempo Pascal",
];
