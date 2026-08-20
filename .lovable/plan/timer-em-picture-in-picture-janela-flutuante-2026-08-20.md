# Timer em Picture-in-Picture (janela flutuante)

Permitir acompanhar o timer de uma demanda em uma pequena janela flutuante que fica sempre visível, mesmo com o usuário navegando em outros sites ou aplicativos.

## Como vai funcionar

- No card do timer (Kanban e detalhe da demanda) aparece um novo ícone "Abrir em janela flutuante".
- Ao clicar, abre uma mini janela do navegador (sem barra de endereço) mostrando:
  - Título da demanda (truncado)
  - Cronômetro ao vivo no mesmo estilo atual (fonte monoespaçada, verde esmeralda, ponto pulsante quando rodando)
  - Botão Iniciar/Pausar, com o mesmo comportamento do timer atual
- Clicar no corpo da janela flutuante **volta o foco para a aba do SoMA+ já aberta** e navega para a demanda dentro da mesma aba (sem abrir nova aba/página).
- Fechar a janela flutuante não pausa o timer; o timer continua contando normalmente.
- Só um timer por vez na janela flutuante: abrir outro substitui o conteúdo da janela existente.
- Se o navegador não suportar o recurso (Safari, Firefox, iOS), o botão fica oculto e não atrapalha nada.

## Detalhes técnicos

- Usa a **Document Picture-in-Picture API** (`window.documentPictureInPicture.requestWindow`), disponível em Chrome/Edge desktop. Requer clique do usuário (gesto), o que já é o caso.
- Novo provider `PipTimerProvider` (montado no `App.tsx`, dentro dos providers de auth/query):
  - Estado: `pipDemandId`, referência à janela PiP, `openPip(demandId)`, `closePip()`.
  - Cria a janela (≈320x120), copia as folhas de estilo do documento principal (`adoptedStyleSheets` + clonagem de `<style>`/`<link>` do Vite) para preservar o tema e os tokens do design system.
  - Renderiza um componente React na janela via `createPortal`, reaproveitando `useLiveTimer` e `useUserTimerControl` — assim o tempo e o start/stop continuam sincronizados com o app (React Query + realtime).
- Novo componente `src/components/PipTimerContent.tsx` com o mesmo visual do `KanbanTimeDisplay` (badge esmeralda, ping animado, botão Iniciar/Pausar).
- Novo botão em `KanbanTimeDisplay.tsx` (e no `variant="detail"` de `DemandTimeDisplay.tsx`), exibido apenas quando `'documentPictureInPicture' in window`.
- Retorno ao app: no clique dentro da janela PiP, chamar `window.opener`-equivalente — a janela PiP compartilha o mesmo contexto, então basta `pipWindow.close()` + `window.focus()` + `navigate('/demands/:id')` via o router já existente. Nenhuma aba nova é criada.
- Limpeza: fechar a janela ao desmontar o provider, ao fazer logout e no evento `pagehide`.

## Fora do escopo

- Suporte em Safari/Firefox/mobile (API indisponível).
- Vídeo/canvas PiP como fallback.
