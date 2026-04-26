-- ============================================
-- SIFAU — SEED INICIAL
-- ============================================

INSERT INTO tenants (nome, municipio, estado, subdominio, cor_primaria)
VALUES ('Prefeitura Municipal', 'Recife', 'PE', 'recife', '#185FA5');

INSERT INTO tipos_infracao (codigo, nome, secretaria, multa_min, multa_max, prazo_resolucao, icone) VALUES
  ('BURACO',     'Buraco na via pública',         'Infraestrutura',   500,   2000,  72,  '🕳️'),
  ('ILUM',       'Iluminação pública',            'Serviços Urbanos', 300,   1000,  48,  '💡'),
  ('LIXO',       'Descarte irregular de lixo',    'Limpeza Urbana',   200,   5000,  24,  '🗑️'),
  ('ENTULHO',    'Entulho em via pública',        'Limpeza Urbana',   300,   3000,  48,  '🏗️'),
  ('ANIMAL',     'Animal solto/abandonado',       'Saúde Animal',     100,   500,   24,  '🐕'),
  ('ESGOTO',     'Esgoto a céu aberto',           'Saneamento',       1000,  10000, 24,  '🚰'),
  ('POLUICAO',   'Poluição sonora / atmosférica', 'Meio Ambiente',    500,   5000,  48,  '🔊'),
  ('CALCADA',    'Calçada irregular / obstruída', 'Infraestrutura',   200,   2000,  72,  '🚶'),
  ('ARVORE',     'Árvore com risco de queda',     'Meio Ambiente',    0,     0,     24,  '🌳'),
  ('TRANSITO',   'Infração de trânsito',           'Transporte',       130,   1000,  48,  '🚦'),
  ('CONSTRUCAO', 'Obra irregular / sem alvará',   'Urbanismo',        2000,  50000, 72,  '🏚️'),
  ('OUTRO',      'Outro / Não classificado',      'Geral',            0,     0,     72,  '📋');

SELECT 'Seed concluído! SIFAU pronto para uso.' AS status;
