/**
 * IVA: os preços guardados já incluem IVA (preço final ao cliente).
 * Sem imports de servidor: também é usado nos formulários.
 */

export type Vat = { enabled: boolean; rate: number; breakdown: boolean };

export const NO_VAT: Vat = { enabled: false, rate: 0, breakdown: false };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Divide um preço final em valor sem IVA e IVA. */
export function splitVat(gross: number | string, vat: Vat) {
  const total = round2(Number(gross) || 0);
  if (!vat.enabled || vat.rate <= 0) return { total, net: total, vat: 0 };
  const net = round2(total / (1 + vat.rate / 100));
  return { total, net, vat: round2(total - net) };
}

/** "23%" ou "6,5%" */
export const vatLabel = (vat: Vat) => `${String(vat.rate).replace(".", ",")}%`;
