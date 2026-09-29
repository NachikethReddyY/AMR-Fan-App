// Exact arithmetic over the retained number's canonical decimal representation.
// No intermediate binary multiplication, per-leg rounding or precision guess.
type Decimal = { units: bigint; scale: number };
export function decimal(value: number): Decimal {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  const units = BigInt(whole + fraction);
  return scale < 0
    ? { units: units * 10n ** BigInt(-scale), scale: 0 }
    : { units, scale };
}
export function add(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return {
    units:
      a.units * 10n ** BigInt(scale - a.scale) +
      b.units * 10n ** BigInt(scale - b.scale),
    scale,
  };
}
export function multiply(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}
export function perThousand(a: Decimal): Decimal {
  return { units: a.units, scale: a.scale + 3 };
}
export function savings(a: Decimal, b: Decimal): Decimal {
  const difference = add(a, { units: -b.units, scale: b.scale });
  return {
    ...difference,
    units: difference.units > 0n ? difference.units : 0n,
  };
}
export function wholePoints(a: Decimal, rate: number, cap: number): number {
  const product = multiply(a, decimal(rate));
  const floored = product.units / 10n ** BigInt(product.scale);
  return Number(floored > BigInt(cap) ? BigInt(cap) : floored);
}
export function decimalString(a: Decimal): string {
  if (a.scale === 0) return String(a.units);
  const digits = String(a.units).padStart(a.scale + 1, '0');
  const fraction = digits.slice(-a.scale).replace(/0+$/, '');
  return digits.slice(0, -a.scale) + (fraction ? `.${fraction}` : '');
}
