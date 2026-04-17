export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatTokenAmount(
  amount: bigint,
  decimals: number
): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;

  if (fractional === 0n) return whole.toLocaleString();

  const fractionalStr = fractional.toString().padStart(decimals, "0");
  const trimmed = fractionalStr.replace(/0+$/, "");
  return `${whole.toLocaleString()}.${trimmed}`;
}

export function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}
