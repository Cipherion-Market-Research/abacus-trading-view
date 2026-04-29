export function buildSignatureMessage(
  purpose: string,
  mint: string,
  nonce: string,
  timestamp: number
): string {
  return `atlas-${purpose}|${mint}|${nonce}|${timestamp}`;
}
