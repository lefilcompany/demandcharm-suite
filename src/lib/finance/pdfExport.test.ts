import { parseFinanceCsv } from "./pdfExport";
import { expect, test } from "vitest";
test("parse", () => { expect(parseFinanceCsv('\ufeff"a;b";"x""y"\n1;2')).toEqual([["a;b",'x"y'],["1","2"]]); });
