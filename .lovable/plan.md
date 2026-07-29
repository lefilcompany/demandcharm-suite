## Objetivo

Dar à conta `vinicius.souza.ext@lefil.com.br` (conta de desenvolvedor) acesso de **Administrador** aos 45 quadros existentes. Hoje ela participa de 13 quadros e de 1 das 12 equipes.

## O que será feito

1. **Entrada nas equipes faltantes** — o acesso a um quadro só funciona se a conta também pertencer à equipe dona dele. Serão criados vínculos nas 11 equipes restantes com o cargo de equipe "membro" (não "dono"), para não alterar a propriedade das equipes dos clientes.
2. **Entrada em todos os quadros** — serão criados registros de participação nos quadros em que a conta ainda não está, com cargo **Administrador**.
3. **Promoção nos quadros já existentes** — nos 13 quadros em que a conta já participa, o cargo será elevado para Administrador caso ainda não seja.
4. **Ação única** — nada será automatizado para quadros futuros, conforme escolhido.

## Detalhes técnicos

- Inserções em `public.team_members` (role `member`) e `public.board_members` (role `admin`), com `ON CONFLICT DO NOTHING`, mais um `UPDATE` de cargo nos vínculos de quadro já existentes.
- Escrita feita pela ferramenta de dados (não é mudança de schema), então gatilhos continuam ativos:
  - `add_member_to_default_board` pode criar vínculos automáticos ao entrar numa equipe — o passo 3 normaliza o cargo depois.
  - `enforce_team_member_limit` pode barrar equipes que já estejam no limite do plano; se ocorrer, reporto quais equipes ficaram de fora em vez de alterar limites por conta própria.
- Verificação final: consulta confirmando 45 vínculos de quadro com cargo `admin` para o usuário.

## Observação

Isso dá visibilidade total das demandas de todos os clientes a essa conta. Se preferir algo reversível/mais discreto no futuro, dá para trocar depois por um papel de sistema (admin global) em vez de participação real nos quadros.
