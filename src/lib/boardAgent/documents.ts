export const DOCUMENT_ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.txt,.md";
export function documentError(file: Pick<File, "name" | "size">): string | null {
  if (!/\.(pdf|docx|xlsx|xls|csv|txt|md)$/i.test(file.name)) return "Escolha um PDF, DOCX, Excel, CSV, TXT ou Markdown.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > 10 * 1024 * 1024) return "O documento deve ter até 10 MB.";
  return null;
}