/**
 * Format price from cents to Brazilian Real (R$)
 */
export function formatPrice(priceCents: number): string {
  const priceReais = priceCents / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(priceReais);
}

/**
 * Parse price input (accepts "100,50" or "100.50") to cents
 */
export function parsePriceToCents(priceInput: string): number {
  // Replace comma with dot for parsing
  const normalized = priceInput.replace(",", ".");
  const value = parseFloat(normalized);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Format cents to decimal string for input fields
 */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
