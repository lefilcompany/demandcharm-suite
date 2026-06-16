/**
 * Formats a demand sequence number as a 4-digit code with leading zeros
 * @param sequenceNumber - The sequence number to format
 * @returns Formatted code like "#0001", "#0023", etc.
 */
export function formatDemandCode(sequenceNumber: number | null | undefined): string {
  if (sequenceNumber == null || sequenceNumber <= 0) {
    return "";
  }
  return `#${sequenceNumber.toString().padStart(4, "0")}`;
}
