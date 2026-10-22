import { describe, expect, it } from "vitest";
import { documentError } from "./documents";
describe("documentos do assistente", () => {
  it("aceita os formatos de importação existentes", () => {
    for (const ext of ["pdf", "docx", "xlsx", "xls", "csv", "txt", "md"]) expect(documentError({ name: `reuniao.${ext}`, size: 100 })).toBeNull();
  });
  it("recusa arquivos vazios e formatos não suportados", () => {
    expect(documentError({ name: "reuniao.txt", size: 0 })).not.toBeNull();
    expect(documentError({ name: "programa.exe", size: 100 })).not.toBeNull();
  });
  it("limita anexos a 10 MB", () => {
    expect(documentError({ name: "reuniao.pdf", size: 10 * 1024 * 1024 })).toBeNull();
    expect(documentError({ name: "reuniao.pdf", size: 10 * 1024 * 1024 + 1 })).not.toBeNull();
  });
});