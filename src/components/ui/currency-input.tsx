import * as React from "react";

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

/**
 * Money field with a muted "R$" prefix and the amount shown in large tabular digits.
 * Digits enter from the cents: typing 1, 2, 3 shows 0,01 → 0,12 → 1,23.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, className, disabled, id, ...rest }, ref) => {
    const n = value === "" || value == null ? null : Number(value);
    const hasValue = n != null && Number.isFinite(n);
    const shown = hasValue ? fmt.format(n).replace(/^R\$\s?/, "") : "";

    return (
      <div
        className={`flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
          disabled ? "cursor-not-allowed opacity-50" : ""
        } ${className ?? ""}`}
      >
        <span
          aria-hidden
          className={`shrink-0 select-none text-xs font-semibold tracking-wide ${
            hasValue ? "text-primary" : "text-muted-foreground"
          }`}
        >
          R$
        </span>
        <input
          ref={ref}
          id={id}
          {...rest}
          disabled={disabled}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="w-full min-w-0 flex-1 bg-transparent text-right text-sm font-semibold tabular-nums text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground disabled:cursor-not-allowed"
          placeholder="0,00"
          value={shown}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onValueChange(digits ? digitsToAmount(digits).toFixed(2) : "");
          }}
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
            rest.onFocus?.(e);
          }}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
