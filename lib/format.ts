/**
 * Nederlandse format helpers — komma als decimaal, € prefix, K/M suffix.
 */

const eurFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurNoDecimalFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatEurCents(cents: number, opts: { showDecimals?: boolean } = {}): string {
  const euros = cents / 100;
  return opts.showDecimals === false
    ? eurNoDecimalFormatter.format(euros)
    : eurFormatter.format(euros);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatRelativeDate(d: Date | string, now: Date = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = now.getTime() - date.getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "zojuist";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min geleden`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} uur geleden`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days} dag${days === 1 ? "" : "en"} geleden`;
  if (days < 30) return `${Math.round(days / 7)} wk geleden`;
  if (days < 365) return `${Math.round(days / 30)} mnd geleden`;
  return `${Math.round(days / 365)} jaar geleden`;
}

export function parseEurInput(input: string): number | null {
  // Accept "15,70", "15.70", "€ 15,70", "1.234,56", "1,234.56"
  if (!input) return null;
  let s = input.trim().replace(/^€\s*/, "").replace(/\s+/g, "");
  if (!s) return null;
  // Detect format: if both . and , present, last separator = decimal
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thouSep = decimalSep === "." ? "," : ".";
    s = s.split(thouSep).join("").replace(decimalSep, ".");
  } else if (hasComma) {
    // Likely NL — comma is decimal
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) s = parts[0] + "." + parts[1];
    else s = s.replace(/,/g, ""); // thousands
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100); // return cents
}
