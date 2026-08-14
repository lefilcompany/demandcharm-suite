# Personalizar a tela "Fazer login com o Google" (remover "Lovable")

Sim, dá para trocar. Hoje o login com Google usa as credenciais OAuth gerenciadas da plataforma, por isso a tela do Google diz "Prosseguir para Lovable". Para exibir "SoMA" (nome + logo), o projeto precisa usar um cliente OAuth próprio, criado na conta Google do LeFil.

Isso é uma configuração no Google Cloud + nas configurações de autenticação do backend — não é alteração de código do app.

## Passos

1. **Criar o app OAuth no Google Cloud** (console da LeFil)
   - Tela de consentimento (OAuth consent screen): tipo Externo (ou Interno, se todos forem @lefil.com.br).
   - Nome do app: `SoMA` (ou `SoMA+`), e-mail de suporte, logo do SoMA (PNG quadrado, até 1 MB), link da home (`https://pla.soma.lefil.com.br`), Política de Privacidade e Termos (as páginas já existem no app).
   - Domínios autorizados: `lefil.com.br` e `lovable.app`.
   - Escopos: `openid`, `userinfo.email`, `userinfo.profile`.

2. **Criar as credenciais** — Credentials > Create OAuth Client ID > Web application.
   - Authorized redirect URI: a URL de callback exibida na seção Google das Configurações de Autenticação do backend (Cloud > Users > Auth Settings > Google).
   - Isso gera Client ID e Client Secret.

3. **Aplicar no backend** — colar Client ID e Client Secret na seção Google das Configurações de Autenticação (isso desliga as credenciais gerenciadas e passa a usar as do SoMA).

4. **Verificação do app no Google** (só se for tipo Externo e público) — enquanto não verificado, o Google mostra aviso de "app não verificado" para contas fora da organização. Com Interno (Workspace LeFil) não há esse aviso.

5. **Testar** — login com Google no preview e em `https://pla.soma.lefil.com.br`, confirmando que a tela mostra "Prosseguir para SoMA" com o logo.

## Observação técnica

O código do app não muda: `lovable.auth.signInWithOAuth("google", ...)` continua igual; apenas o provedor passa a usar o client próprio. A tela de consentimento do MCP (`/.lovable/oauth/consent`) já é do SoMA e não é afetada.

Posso não executar os passos 1, 2 e 4 por você (são no console do Google e exigem sua conta); consigo orientar em detalhe e validar o resultado depois que o Client ID/Secret forem cadastrados.
