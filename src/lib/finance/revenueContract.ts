export type ContractUnit = "days" | "months" | "years";
export interface Installment { competence: string; amount: number; }

const pad = (n: number) => String(n).padStart(2, "0");
const toCents = (v: number) => Math.round(v * 100);

/** Spreads a contract total into monthly competences.
 * days: total ÷ days, each month gets its own days; months: total ÷ months;
 * years: total ÷ years per year, each year spread over 12 months. Rounding cents go to the last month. */
export function splitContract(total: number, startISO: string, duration: number, unit: ContractUnit): Installment[] {
  const cents = toCents(total);
  if (!(cents > 0) || !(duration > 0)) return [];
  const [y0, m0, d0] = startISO.substring(0, 10).split("-").map(Number);
  const weights: { key: string; w: number }[] = [];
  const add = (key: string, w: number) => {
    const last = weights[weights.length - 1];
    if (last && last.key === key) last.w += w; else weights.push({ key, w });
  };
  if (unit === "days") {
    const start = Date.UTC(y0, m0 - 1, d0);
    for (let i = 0; i < duration; i++) {
      const d = new Date(start + i * 86400000);
      add(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`, 1);
    }
  } else {
    const months = unit === "months" ? duration : duration * 12;
    for (let i = 0; i < months; i++) {
      const idx = m0 - 1 + i;
      add(`${y0 + Math.floor(idx / 12)}-${pad((idx % 12) + 1)}-01`, 1);
    }
  }
  const totalW = weights.reduce((s, x) => s + x.w, 0);
  let used = 0;
  return weights.map((x, i) => {
    const c = i === weights.length - 1 ? cents - used : Math.floor((cents * x.w) / totalW);
    used += c;
    return { competence: x.key, amount: c / 100 };
  });
}

/** Value of one period (day, month or year) of the contract. */
export const periodValue = (total: number, duration: number) => (duration > 0 ? total / duration : 0);

export const unitLabel = (u: ContractUnit, n: number) =>
  u === "days" ? (n === 1 ? "dia" : "dias") : u === "months" ? (n === 1 ? "mês" : "meses") : n === 1 ? "ano" : "anos";

/** Last day covered by the contract, ISO yyyy-mm-dd. */
export function contractEnd(startISO: string, duration: number, unit: ContractUnit): string {
  const [y, m, d] = startISO.substring(0, 10).split("-").map(Number);
  let end: Date;
  if (unit === "days") end = new Date(Date.UTC(y, m - 1, d + duration - 1));
  else end = new Date(Date.UTC(y, m - 1 + (unit === "months" ? duration : duration * 12), d - 1));
  return end.toISOString().substring(0, 10);
}
