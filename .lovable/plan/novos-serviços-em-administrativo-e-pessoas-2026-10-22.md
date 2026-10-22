# Novos serviços em "Administrativo e Pessoas"

## O que muda para quem usa
- A área "Administrativo e Pessoas" passa a ter só 7 serviços:
  1. Gestão Financeira e Orçamentária
  2. Gestão de Pessoas e Departamento Pessoal
  3. Gestão Administrativa e Contratual
  4. Gestão Financeira e Administrativa de Projetos
  5. Apoio Comercial e Relacionamento com Clientes
  6. Comunicação Interna, Eventos e Cultura Organizacional
  7. Gestão de Processos, Compliance e Apoio à Diretoria
- Cada serviço mostra, como descrição, a lista de atividades que ele engloba (os tópicos do documento), na página de Serviços e ao escolher o serviço na criação de demanda.
- Os 18 serviços antigos da área saem das opções de seleção, mas demandas já criadas continuam mostrando o serviço que tinham.
- Vale para todas as equipes, e equipes novas já nascem com a lista nova.
- O nome da área continua "Administrativo e Pessoas" (o documento sugere "Gestão Administrativa e Operacional" — troco se preferir).
- Faixa de horas: o documento não traz; os novos serviços ficam sem faixa de horas de referência até você informar.

## Detalhes técnicos
- Migração: em `services`, para cada equipe, inserir os 7 itens na pasta da área (idempotente por `catalog_key`), com `description` = atividades em lista, `is_catalog = true`, `sort_order` 1–7; marcar os antigos da área como `is_active = false`.
- Atualizar a função de seed do catálogo (trigger em `teams`) para usar os 7 novos itens.
- Exibição: `ServicesManagement.tsx` e `ServiceSelector.tsx` renderizam a descrição preservando quebras de linha (`whitespace-pre-line`); sem faixa de horas, omitir o rótulo em vez de mostrar "0h".
- Verificar na página de Serviços e no seletor da criação de demanda.
