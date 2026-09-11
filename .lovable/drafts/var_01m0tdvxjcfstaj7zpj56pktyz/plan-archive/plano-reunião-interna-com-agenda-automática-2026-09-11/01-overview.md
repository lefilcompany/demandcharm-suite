# Plano — Reunião Interna com agenda automática

## Objetivo

Ao selecionar um serviço configurado como **Reunião Interna**, o formulário exibirá os dados da reunião já usados no projeto de calendário: horário, duração e criação opcional do Google Meet.

A lista de convidados não será escolhida manualmente. Ela será formada automaticamente por:

- solicitante/criador da demanda, que será o organizador;
- responsável principal;
- todos os acompanhantes, representados pelos demais responsáveis vinculados à demanda.

O solicitante precisará conectar o próprio Google Calendar antes de concluir a criação. Sem conexão, o sistema bloqueará o envio e mostrará uma ação clara para conectar.

## Fluxos cobertos

- criação completa de demanda por equipe interna;
- criação rápida;
- solicitação criada por solicitante e posteriormente aprovada;
- visualização e edição da reunião na página da demanda.

## Comportamento esperado

1. O serviço é identificado por comportamento de reunião, e não apenas pelo texto do nome.
2. A seleção abre os campos da reunião automaticamente.
3. O sistema valida conexão, data, horário e duração antes de criar.
4. Depois da demanda e dos responsáveis serem salvos, o compromisso é criado uma única vez no calendário do solicitante.
5. Google envia o convite ao responsável e aos acompanhantes; usuários conectados também terão a cópia confirmada na própria agenda.
6. Alterações de data, horário, duração, título ou participantes atualizam o mesmo evento; remoções deixam de participar sem criar eventos duplicados.

## Segurança e consistência

- A agenda usada será sempre a do usuário autenticado que criou a demanda; nenhum usuário poderá escolher credenciais de terceiros.
- Participantes serão recalculados no servidor a partir da demanda, ignorando listas enviadas manualmente pela tela.
- O bloqueio absoluto e o rollout já existentes continuarão sendo respeitados.
- O identificador estável do evento e o registro único por demanda evitarão duplicidade.
- A solicitação guardará apenas os dados da reunião até ser aprovada; o evento real será criado somente quando existir uma demanda.

## Entrega e validação

- Adicionar a estrutura de reuniões e o comportamento de serviço como alteração preparada, aplicada quando este draft for aceito.
- Portar as rotinas de criação, atualização, cancelamento e confirmação dos convidados.
- Marcar os serviços de catálogo `gestao/reuniao-interna` com o comportamento de reunião.
- Validar criação bloqueada sem conexão, criação com todos os participantes, atualização sem duplicar e exibição do link Calendar/Meet.

## Observação de publicação

As novas estruturas só entram no backend quando o draft for aceito. A publicação das rotinas de agenda afeta o backend compartilhado e será feita junto da aceitação, evitando que o preview altere o aplicativo publicado antes da hora.
