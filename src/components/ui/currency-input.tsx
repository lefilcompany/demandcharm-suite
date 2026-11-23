import * as React from "react";
import { Input } from "@/components/ui/input";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Converts typed digits into a value filled from the cents (e.g. "1","12","123" → 0,01 / 0,12 / 1,23). */
export function digitsToAmount(raw: string): number {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 13);
  return digits ? Number(digits) / 100 : 0;
}

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string | number | null | undefined;
  /** Emits a plain decimal string ("1234.56"), or "" when cleared. */
  onValueChange: (value: string) => void;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, Props>(({ value, onValueChange, className, ...rest }, ref) => {
  const n = value === "" || value == null ? null : Number(value);
  const shown = n == null || !Number.isFinite(n) ? "" : fmt.format(n);
  return (
    <Input
      ref={ref}
      {...rest}
      type="text"
      inputMode="numeric"
      className={`tabular-nums ${className ?? ""}`}
      placeholder={rest.placeholder ?? "R$ 0,00"}
      value={shown}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onValueChange(digits ? digitsToAmount(digits).toFixed(2) : "");
      }}
      onFocus={(e) => { const el = e.currentTarget; requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length)); rest.onFocus?.(e); }}
    />
  );
});
CurrencyInput.displayName = "CurrencyInput";
