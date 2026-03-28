# Plano de evolução visual e interna do SIFAU

Data: 21/03/2026

## Objetivo
Deixar o app mais bonito, diferenciado e profissional, mantendo a ideia central:
- uso cidadão simples,
- operação técnica para fiscais/gerentes,
- foco em denúncia e acompanhamento.

---

## 1) Melhorias visuais (alto impacto de percepção)

## 1.1 Identidade visual consistente por perfil
Hoje cada módulo já tem seu estilo, mas ainda com variações muito manuais.

**Proposta**
- Definir paleta por contexto:
  - Cidadão: azul + verde (confiança + ação cívica)
  - Fiscal: azul + âmbar (campo/atenção)
  - Gerente: índigo + roxo (decisão/visão executiva)
- Padronizar sombras, bordas e raio de cantos com tokens (`--radius-md`, `--shadow-md`, etc.).

**Ganho**
- App parece “produto único” e não telas isoladas.

## 1.2 Hierarquia visual com cards premium
As telas já usam cards e gradientes; próximo passo é elevar refinamento.

**Proposta**
- Cartões com:
  - cabeçalho leve,
  - métrica principal maior,
  - microtendência (↑/↓).
- Criar componente único de `KpiCard` reutilizado em Fiscal/Gerente.

**Ganho**
- Dashboard mais executivo e legível em 3 segundos.

## 1.3 Navegação mobile mais moderna
Os fluxos estão bons, mas há espaço para UX “app nativo premium”.

**Proposta**
- Bottom bar com destaque de ação principal (FAB) para “Nova denúncia”.
- Estados vazios ilustrados (sem denúncias, sem mensagens, sem fotos).
- Skeleton loading em listas e cards para reduzir sensação de travamento.

**Ganho**
- Mais fluidez e menor abandono nos primeiros usos.

## 1.4 Tipografia e espaçamento

**Proposta**
- Escala tipográfica fixa (12/14/16/20/24/32).
- Espaçamento com grid 4/8/12/16/24/32.
- Reduzir excesso de texto corrido em blocos longos, usando bullets e ícones.

**Ganho**
- Leitura mais rápida e visual “enterprise-grade”.

---

## 2) Diferenciais de produto (para ficar marcante)

## 2.1 Linha do tempo da denúncia

**Proposta**
- Exibir “timeline” da denúncia com eventos:
  - recebida,
  - designada,
  - vistoria,
  - aprovação,
  - concluída.
- Mostrar estimativa de SLA em barra visual.

**Ganho**
- Cidadão entende progresso sem suporte humano.

## 2.2 Mapa operacional

**Proposta**
- Visão mapa com camadas:
  - denúncias por status,
  - calor por tipo,
  - filtros por período.

**Ganho**
- Valor estratégico para gerência e comunicação pública.

## 2.3 “Centro de comando” do gerente

**Proposta**
- Alertas prioritários (SLA crítico, denúncias repetidas por área).
- Ranking de produtividade com contexto (qualidade + prazo, não só pontos).

**Ganho**
- Plataforma mais gerencial e menos apenas operacional.

---

## 3) Melhorias internas (arquitetura e manutenção)

## 3.1 Quebrar `AppContext` em domínios

**Proposta**
Separar em contextos/hooks:
- `useAuthState`
- `useDenunciasState`
- `useMensagensState`
- `useSyncState`

**Ganho**
- Menor acoplamento, mais testabilidade e menos regressão.

## 3.2 Camada única de dados (repo)

**Proposta**
- Criar uma camada de repositório para Supabase/Storage:
  - `accountsRepo`
  - `denunciasRepo`
  - `profilesRepo`
- UI não chama Supabase direto; chama serviços tipados.

**Ganho**
- Facilidade para trocar backend, adicionar cache e testar.

## 3.3 Estratégia offline-first formal

**Proposta**
- Fila de sincronização com status por item:
  - pendente,
  - sincronizando,
  - erro,
  - sincronizado.
- Política de conflito (última escrita x merge por campo).

**Ganho**
- Evita inconsistências e melhora confiança em campo.

## 3.4 Segurança e autenticação

**Proposta**
- Migrar autenticação progressivamente para Supabase Auth completo.
- Eliminar senha em texto puro da tabela de contas legadas.
- Políticas RLS por perfil (cidadão/fiscal/gerente).

**Ganho**
- Mais segurança jurídica/técnica para produção real.

---

## 4) Melhorias técnicas rápidas (Quick Wins)

1. Criar biblioteca de componentes base (`Button`, `Card`, `Badge`, `Input`, `Modal`).
2. Criar `useToast` padrão e remover mensagens duplicadas.
3. Adicionar `eslint + prettier + scripts` e testes de fluxos críticos.
4. Instrumentar logs de erro e funil (entrada, denúncia criada, denúncia concluída).

---

## 5) Roadmap sugerido (sem reescrever tudo)

### Fase 1 — 7 dias
- Sistema de design (tokens + componentes base).
- Ajuste visual de Home/Auth/Cidadão.

### Fase 2 — 14 dias
- Timeline da denúncia + skeletons + estados vazios.
- Melhorias no dashboard Gerente/Fiscal.

### Fase 3 — 21 dias
- Refactor de contexto em domínios.
- Repositórios de dados e sync mais robusto.

### Fase 4 — 30 dias
- Hardening de autenticação e segurança.
- Observabilidade e indicadores de qualidade.

---

## 6) Resumo executivo
Com essas mudanças, o SIFAU passa de “app funcional” para “produto profissional” com:
- identidade visual consistente,
- experiência mais fluida no mobile,
- operação técnica mais confiável,
- base sólida para escala municipal/estadual.
