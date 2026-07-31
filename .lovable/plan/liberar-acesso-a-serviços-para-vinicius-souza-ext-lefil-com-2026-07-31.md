# Liberar acesso a Serviços para vinicius.souza.ext@lefil.com.br

## Diagnóstico confirmado

- A conta está na equipe **LeFil Company** com papel **executor** em `team_members`.
- O menu "Serviços" na barra lateral e a tela `/teams/:id/services` são exibidos apenas para o papel **admin** (mapeado como "owner" na interface).
- Por isso o acesso não aparece: é permissão de papel, não bug de código.

## O que será feito

Promover a conta a **admin** da equipe LeFil Company (alteração de dados apenas, sem mudança de código):

- Atualizar o papel do membro `vinicius.souza.ext@lefil.com.br` na equipe LeFil Company de `executor` para `admin`.
- Nenhuma outra equipe ou usuário é afetado.

## Efeitos

- Passa a ver e usar **Serviços** e **Solicitações** no menu da equipe.
- Ganha permissões administrativas da equipe (gerenciar membros, quadros, configurações).
- Existe um gatilho no banco que sincroniza administradores da equipe com todos os quadros; a conta poderá ser adicionada como administradora nos quadros da LeFil Company.

## Verificação

Após a alteração, recarregar a página e confirmar que "Serviços" aparece no menu da equipe e que a tela permite criar/editar serviços.
