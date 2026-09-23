# Corrigir filtros do Assistente do Quadro

## Objetivo
Permitir perguntas como “me mostre quais demandas estão atrasadas” sem exigir parâmetros que não foram informados e sem exibir raciocínio técnico ao usuário.

## Alterações
- Tornar opcionais os filtros complementares de `list_demands`, mantendo os padrões atuais quando forem omitidos.
- Aplicar o mesmo comportamento seguro às demais ferramentas do assistente que aceitam filtros opcionais.
- Desativar o envio do raciocínio interno do Gemini para o chat, exibindo apenas a resposta final e os resultados das ferramentas.
- Remover do Assistente do Quadro os cabeçalhos e o adaptador remanescentes do antigo gateway de IA.

## Validação
- Publicar novamente a função do Assistente do Quadro.
- Testar a pergunta sobre demandas atrasadas no quadro selecionado.
- Confirmar que a lista aparece sem erro de parâmetros e sem texto interno em inglês.
