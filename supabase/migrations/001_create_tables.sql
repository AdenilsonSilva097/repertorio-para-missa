-- ============================================================
-- Repertório para Missa — Schema inicial
-- Supabase / PostgreSQL
-- ============================================================

-- 1. Tipo ENUM para os momentos da missa
CREATE TYPE momento_missa AS ENUM (
  'Entrada',
  'Ato Penitencial',
  'Glória',
  'Salmo',
  'Aclamação',
  'Ofertório',
  'Santo',
  'Cordeiro',
  'Comunhão',
  'Ação de Graças',
  'Final'
);

-- 2. Tabela: datas_liturgicas
CREATE TABLE datas_liturgicas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL UNIQUE,         -- ex: '1º Domingo do Tempo Comum'
  tempo       TEXT NOT NULL,                -- ex: 'Tempo Comum'
  ordem       INTEGER NOT NULL DEFAULT 0,   -- ordem cronológica no ano litúrgico
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabela: musicas
CREATE TABLE musicas (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_liturgica_id  UUID NOT NULL REFERENCES datas_liturgicas (id) ON DELETE CASCADE,
  titulo             TEXT NOT NULL,
  autor_letra        TEXT,
  autor_melodia      TEXT,
  momento            momento_missa NOT NULL,
  youtube_url        TEXT,
  cifra_pdf_url      TEXT,
  partitura_pdf_url  TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_musicas_data_liturgica ON musicas (data_liturgica_id);
CREATE INDEX idx_musicas_momento        ON musicas (momento);

-- 4. Row Level Security (padrão Supabase)
ALTER TABLE datas_liturgicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE musicas          ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para leitura pública
CREATE POLICY "Leitura pública de datas litúrgicas"
  ON datas_liturgicas FOR SELECT
  USING (true);

CREATE POLICY "Leitura pública de músicas"
  ON musicas FOR SELECT
  USING (true);

-- Políticas permissivas para inserção pública
CREATE POLICY "Inserção pública de datas litúrgicas"
  ON datas_liturgicas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Inserção pública de músicas"
  ON musicas FOR INSERT
  WITH CHECK (true);

-- Políticas permissivas para atualização e exclusão pública
CREATE POLICY "Atualização pública de músicas"
  ON musicas FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Exclusão pública de músicas"
  ON musicas FOR DELETE
  USING (true);

-- 4b. Tabelas de repertórios salvos
CREATE TABLE repertorios (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome               TEXT NOT NULL,
  data_liturgica_id  UUID NOT NULL REFERENCES datas_liturgicas (id) ON DELETE CASCADE,
  tipo_exportacao    TEXT NOT NULL DEFAULT 'cifra',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE repertorio_musicas (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  repertorio_id   UUID NOT NULL REFERENCES repertorios (id) ON DELETE CASCADE,
  musica_id       UUID NOT NULL REFERENCES musicas (id) ON DELETE CASCADE,
  UNIQUE (repertorio_id, musica_id)
);

CREATE INDEX idx_repertorios_data_liturgica ON repertorios (data_liturgica_id);
CREATE INDEX idx_repertorio_musicas_repertorio ON repertorio_musicas (repertorio_id);

ALTER TABLE repertorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE repertorio_musicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de repertórios"
  ON repertorios FOR SELECT USING (true);
CREATE POLICY "Inserção pública de repertórios"
  ON repertorios FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de repertórios"
  ON repertorios FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Exclusão pública de repertórios"
  ON repertorios FOR DELETE USING (true);

CREATE POLICY "Leitura pública de repertório_músicas"
  ON repertorio_musicas FOR SELECT USING (true);
CREATE POLICY "Inserção pública de repertório_músicas"
  ON repertorio_musicas FOR INSERT WITH CHECK (true);
CREATE POLICY "Exclusão pública de repertório_músicas"
  ON repertorio_musicas FOR DELETE USING (true);

-- 5. Policies de Storage (executar após criar os buckets "cifras" e "partituras")
-- CREATE POLICY "Upload público de cifras"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'cifras');
--
-- CREATE POLICY "Upload público de partituras"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'partituras');

-- ============================================================
-- 6. Datas Litúrgicas — Ano Litúrgico 2026 (Ano C)
--    Páscoa: 5 de abril de 2026
-- ============================================================

INSERT INTO datas_liturgicas (nome, tempo, ordem) VALUES

  -- TEMPO DO NATAL
  ('Maria, Mãe de Deus (Solenidade)',       'Tempo do Natal',  1),
  ('Epifania do Senhor',                     'Tempo do Natal',  2),
  ('Batismo do Senhor',                      'Tempo do Natal',  3),

  -- TEMPO COMUM — 1ª parte
  ('2º Domingo do Tempo Comum',              'Tempo Comum',     4),
  ('3º Domingo do Tempo Comum',              'Tempo Comum',     5),
  ('4º Domingo do Tempo Comum',              'Tempo Comum',     6),
  ('5º Domingo do Tempo Comum',              'Tempo Comum',     7),
  ('6º Domingo do Tempo Comum',              'Tempo Comum',     8),

  -- QUARESMA
  ('Quarta-feira de Cinzas',                  'Quaresma',        9),
  ('1º Domingo da Quaresma',                  'Quaresma',       10),
  ('2º Domingo da Quaresma',                  'Quaresma',       11),
  ('3º Domingo da Quaresma',                  'Quaresma',       12),
  ('4º Domingo da Quaresma',                  'Quaresma',       13),
  ('5º Domingo da Quaresma',                  'Quaresma',       14),
  ('Domingo de Ramos',                        'Quaresma',       15),

  -- TRÍDUO PASCAL
  ('Quinta-feira Santa (Ceia do Senhor)',      'Tríduo Pascal',  16),
  ('Sexta-feira Santa (Paixão do Senhor)',     'Tríduo Pascal',  17),
  ('Vigília Pascal',                           'Tríduo Pascal',  18),

  -- TEMPO PASCAL
  ('Domingo de Páscoa',                       'Tempo Pascal',   19),
  ('2º Domingo da Páscoa',                    'Tempo Pascal',   20),
  ('3º Domingo da Páscoa',                    'Tempo Pascal',   21),
  ('4º Domingo da Páscoa',                    'Tempo Pascal',   22),
  ('5º Domingo da Páscoa',                    'Tempo Pascal',   23),
  ('6º Domingo da Páscoa',                    'Tempo Pascal',   24),
  ('Ascensão do Senhor',                      'Tempo Pascal',   25),
  ('7º Domingo da Páscoa',                    'Tempo Pascal',   26),
  ('Pentecostes',                              'Tempo Pascal',   27),

  -- SOLENIDADES PÓS-PENTECOSTES
  ('Santíssima Trindade',                     'Tempo Comum',    28),
  ('Corpus Christi',                           'Tempo Comum',    29),

  -- TEMPO COMUM — 2ª parte
  ('10º Domingo do Tempo Comum',              'Tempo Comum',    30),
  ('11º Domingo do Tempo Comum',              'Tempo Comum',    31),
  ('12º Domingo do Tempo Comum',              'Tempo Comum',    32),
  ('13º Domingo do Tempo Comum',              'Tempo Comum',    33),
  ('14º Domingo do Tempo Comum',              'Tempo Comum',    34),
  ('15º Domingo do Tempo Comum',              'Tempo Comum',    35),
  ('16º Domingo do Tempo Comum',              'Tempo Comum',    36),
  ('17º Domingo do Tempo Comum',              'Tempo Comum',    37),
  ('18º Domingo do Tempo Comum',              'Tempo Comum',    38),
  ('19º Domingo do Tempo Comum',              'Tempo Comum',    39),
  ('Assunção de Nossa Senhora',               'Tempo Comum',    40),
  ('20º Domingo do Tempo Comum',              'Tempo Comum',    41),
  ('21º Domingo do Tempo Comum',              'Tempo Comum',    42),
  ('22º Domingo do Tempo Comum',              'Tempo Comum',    43),
  ('23º Domingo do Tempo Comum',              'Tempo Comum',    44),
  ('24º Domingo do Tempo Comum',              'Tempo Comum',    45),
  ('25º Domingo do Tempo Comum',              'Tempo Comum',    46),
  ('26º Domingo do Tempo Comum',              'Tempo Comum',    47),
  ('27º Domingo do Tempo Comum',              'Tempo Comum',    48),
  ('28º Domingo do Tempo Comum',              'Tempo Comum',    49),
  ('29º Domingo do Tempo Comum',              'Tempo Comum',    50),
  ('30º Domingo do Tempo Comum',              'Tempo Comum',    51),
  ('Todos os Santos (Solenidade)',            'Tempo Comum',    52),
  ('Finados',                                  'Tempo Comum',    53),
  ('32º Domingo do Tempo Comum',              'Tempo Comum',    54),
  ('33º Domingo do Tempo Comum',              'Tempo Comum',    55),
  ('Cristo Rei do Universo',                   'Tempo Comum',    56),

  -- ADVENTO
  ('1º Domingo do Advento',                   'Advento',        57),
  ('2º Domingo do Advento',                   'Advento',        58),
  ('3º Domingo do Advento',                   'Advento',        59),
  ('4º Domingo do Advento',                   'Advento',        60),

  -- NATAL
  ('Natal do Senhor',                          'Tempo do Natal', 61),
  ('Sagrada Família',                          'Tempo do Natal', 62);
