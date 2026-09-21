# Plano: landing page SoMA+ e solicitações de demonstração

## O que será entregue
- Criar uma landing page pública inspirada no projeto **LP-SOMA+**, com texto mais comercial e dados atuais do sistema.
- Remover preços da área de vendas e substituir por um formulário de solicitação de demonstração.
- Ao enviar o formulário, salvar a solicitação e enviar e-mail via Resend para os destinatários informados.
- Criar uma área no admin para visualizar e gerenciar as solicitações recebidas.

## Caminho proposto
1. Consultar o projeto de referência para reaproveitar estrutura, tom visual e seções principais.
2. Criar uma rota pública para a landing page sem quebrar o acesso atual ao sistema.
3. Criar a tabela de solicitações de demonstração com permissões seguras.
4. Criar uma função de envio com validação dos campos e Resend.
5. Adicionar item no admin e página de gestão com lista, status e observações internas.
6. Verificar o envio, a navegação e possíveis erros de build.

## Detalhes técnicos
- A landing ficará em uma rota pública dedicada para evitar impactar o fluxo atual do app.
- O formulário terá validação de nome, e-mail, empresa, telefone e mensagem.
- O e-mail será enviado para: socorro@lefil.com.br, lefil@lefil.com.br, samuel.muniz@lefil.com.br, emanuel.rodrigues@lefil.com.br, vinicius.souza.ext@lefil.com.br.
- A gestão no admin usará a estrutura visual já existente do painel administrativo.
