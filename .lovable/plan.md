## Objetivo
Ao trocar entre "Entrar" e "Cadastrar", o topo do painel (logo, pill de abas, título/subtítulo, botão do Google e divisor) deve permanecer exatamente na mesma posição. Apenas o formulário abaixo do divisor deve mudar, e o scroll (quando houver) fica restrito a essa área.

## Causa atual
Em `src/pages/Auth.tsx`, cada `TabsContent` (login e signup) contém sua própria cópia de título, botão do Google e divisor. O `TabsContent` de signup ainda inclui um banner extra ("Após cadastrar, enviaremos um link de confirmação…"), o que empurra o botão do Google e o divisor para cima quando a aba muda.

## Mudanças (somente `src/pages/Auth.tsx`, bloco ~646–975)

Reorganizar o painel direito para esta estrutura:

```text
[FIXO]
Logo SoMA+
Pill Entrar / Cadastrar
Título + subtítulo         (texto condicional por aba, mesma altura)
Botão Google               (label condicional: "Continuar com Google" | "Cadastrar com Google")
Divisor                    (texto condicional: "ou entre com seu e-mail" | "ou crie sua conta com e-mail")

[TROCA]
Tabs > TabsContent
  login  -> formulário e-mail/senha (fluxo loginStep atual)
  signup -> banner "Após cadastrar…" + (signupSuccessEmail ? tela de confirmação : formulário completo)
           scroll interno em telas grandes quando necessário
```

Detalhes de implementação:
- Mover título/subtítulo, botão Google e divisor para fora dos dois `TabsContent`, renderizados uma única vez com texto condicional baseado em `activeTab`. Manter as classes atuais (`text-[26px]`, `text-[13px]`, altura do botão `h-11`, etc.) para preservar altura idêntica entre as abas.
- Remover as cópias duplicadas desses blocos dentro de `TabsContent value="login"` e `TabsContent value="signup"`.
- No `TabsContent value="signup"`, manter o banner de aviso (Info) como primeiro elemento da área que troca, seguido pelo formulário ou pela tela de sucesso (`signupSuccessEmail`).
- Mover o `lg:max-h-[calc(...)] lg:overflow-y-auto` que hoje está no `<form>` do signup para o wrapper da área que troca (ou um `div` interno do `TabsContent` do signup), recalculando o `calc` para refletir a nova altura fixa acima.
- Nenhuma mudança em handlers, estado, chamadas de auth, textos existentes ou estilos semânticos — apenas reorganização de JSX e ajustes de classes de layout/scroll.

## Resultado esperado
- Alternar Entrar/Cadastrar não move logo, pill, título, botão Google nem divisor.
- Somente o conteúdo do formulário abaixo do divisor muda.
- O scroll do Cadastrar (quando o formulário excede a viewport) fica isolado a essa área, sem scroll externo.
