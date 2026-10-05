/**
 * Middle-click (mouse scroll wheel press) on a demand item should open the
 * demand detail page in a new browser tab, mimicking native link behavior.
 */
export function openDemandOnAuxClick(
  event: { button: number; preventDefault: () => void; stopPropagation: () => void },
  demandId: string
) {
  if (event.button !== 1) return;
  event.preventDefault();
  event.stopPropagation();
  window.open(`/app/demands/${demandId}`, "_blank", "noopener");
}
