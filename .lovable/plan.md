
# Por que ainda aparece configuração no Agent integrations

O painel lê o **manifest publicado**, não o código local. Como a última publicação ainda continha os 68/97 tools, ele mostra isso — mesmo com o working tree já 100% limpo. A própria UI avisa: *"New changes aren't live yet — Publish changes before ChatGPT or Claude can use them"*.

## O que fazer

Publicar o app agora. Como não há mais `mcpPlugin()` no Vite, nenhum manifest será gerado no build → o painel Agent integrations vai passar para o estado "sem MCP configurado", como se fosse a primeira vez.

Não há mais nada para eu apagar no código — já removi tudo (server, tools, edge function, plugin, dependência, páginas, rotas, manifest).

## Ação

Clique em **Publish changes** (botão azul no próprio painel) ou no botão de Publish do topo. Depois recarregue a tela de Agent integrations — ela deve aparecer vazia.

<presentation-actions>
<presentation-open-publish>Publish your app</presentation-open-publish>
</presentation-actions>

Se após publicar ainda mostrar os tools antigos, me avise que eu investigo (pode ser cache do painel).
