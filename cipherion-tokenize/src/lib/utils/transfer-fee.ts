export function calculateTransferFee(
  amount: bigint,
  bps: number,
  maxFee: bigint
): bigint {
  if (amount <= 0n || bps <= 0) return 0n;
  const raw = (amount * BigInt(bps)) / 10000n;
  return raw > maxFee ? maxFee : raw;
}
