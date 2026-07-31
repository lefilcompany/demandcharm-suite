# Corrigir erro ao criar pasta de serviços

## Erro encontrado nos logs

```
Error: Horas estimadas deve ser pelo menos 1
  at validateData (src/lib/validations.ts:112)
  at useServices.ts:125 (criação de serviço)
```

## Causa

Uma "pasta" de serviços é criada como um serviço-categoria e envia `estimated_hours: 0`
(`src/pages/ServicesManagement.tsx`, fluxo de criação de pasta). A validação de criação de
serviço (`ServiceCreateSchema`) exige no mínimo 1 hora, então a operação é bloqueada antes
de chegar ao banco.

## Correção

- Em `src/lib/validations.ts`: permitir `estimated_hours` a partir de 0 em
  `ServiceCreateSchema` e `ServiceUpdateSchema` (pastas não têm horas), mantendo o limite
  máximo e a exigência de número inteiro.
- Manter o formulário de serviço normal com valor padrão 24h e mínimo 1 na interface, de modo
  que apenas pastas usem 0.

## Verificação

Criar uma pasta em `/teams/:id/services` e confirmar o toast "Pasta criada!" e a pasta na lista;
criar um serviço normal e confirmar que continua funcionando.
