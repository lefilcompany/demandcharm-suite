## Objetivo
Ajustar o aviso de confirmação por e-mail na aba "Cadastrar" da tela de autenticação para:
1. Reduzir a largura (width) da mensagem.
2. Posicioná-la imediatamente acima do botão "Criar conta com e-mail".

## Estado atual
- O aviso está localizado em `src/pages/Auth.tsx`, linhas 826-831.
- Ele ocupa a largura total do container (`w-full` implícito) e está posicionado acima de todo o formulário de cadastro.
- O botão "Criar conta com e-mail" está no final do formulário, linhas 945-947.

## Mudanças propostas
1. **Diminuir a largura do aviso:**
   - Aplicar `max-w-sm` (ou `max-w-md`, conforme teste visual) na `<div>` do alerta.
   - Centralizar com `mx-auto`.
   - Manter o estilo visual atual (fundo primary/5, borda primary/25, ícone Info).

2. **Reposicionar o aviso acima do botão:**
   - Mover o bloco do alerta de fora do formulário para dentro do `<form>`.
   - Colocá-lo logo acima do `<Button type="submit">` (linha 945).
   - Manter o espaçamento consistente com `space-y-3` do formulário.

3. **Preservar comportamentos existentes:**
   - Manter o scroll interno do formulário.
   - Não alterar o conteúdo do texto.
   - Garantir que o aviso continue aparecendo apenas na aba de cadastro e não na tela de sucesso pós-cadastro.

## Arquivo a ser editado
- `src/pages/Auth.tsx`

## Validação
- Verificar visualmente no preview que o aviso ficou mais estreito e centralizado.
- Confirmar que o aviso aparece diretamente acima do botão "Criar conta com e-mail".
- Testar a alternância entre as abas "Entrar" e "Cadastrar" para garantir que não houve regressão no layout fixo do cabeçalho.