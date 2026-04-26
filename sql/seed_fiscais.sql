INSERT INTO app_users (id, email, nome, tipo_acesso, matricula, ativo) VALUES
('au-marconi-sifau', 'marconi@sifau.gov.br', 'Marconi', 'gerente', 'GER-001', true),
('au-marie-sifau', 'marie@sifau.gov.br', 'Marie', 'fiscal', 'FSC-001', true),
('au-balbino-sifau', 'balbino@sifau.gov.br', 'Balbino', 'fiscal', 'FSC-002', true),
('au-demetrius-sifau', 'demetrius@sifau.gov.br', 'Demétrius', 'fiscal', 'FSC-003', true),
('au-kamila-sifau', 'kamila@sifau.gov.br', 'Kamila Queiroz', 'fiscal', 'FSC-004', true),
('au-evanisio-sifau', 'evanisio@sifau.gov.br', 'Evanisio Lopes', 'fiscal', 'FSC-005', true),
('au-iris-sifau', 'iris@sifau.gov.br', 'Iris', 'fiscal', 'FSC-006', true),
('au-paulo-sifau', 'paulo@sifau.gov.br', 'Paulo Karas', 'fiscal', 'FSC-007', true),
('au-adriana-sifau', 'adriana@sifau.gov.br', 'Adriana Gondim', 'fiscal', 'FSC-008', true),
('au-andre-sifau', 'andre@sifau.gov.br', 'André', 'fiscal', 'FSC-009', true),
('au-rebeca-sifau', 'rebeca@sifau.gov.br', 'Rebeca Cavalcanti', 'fiscal', 'FSC-010', true),
('au-gissieri-sifau', 'gissieri@sifau.gov.br', 'Gissieri', 'fiscal', 'FSC-011', true),
('au-edson-sifau', 'edson@sifau.gov.br', 'Edson', 'fiscal', 'FSC-012', true)
ON CONFLICT (id) DO NOTHING;
