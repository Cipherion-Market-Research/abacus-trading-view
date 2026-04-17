import { PublicKey } from "@solana/web3.js";

export function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function parsePublicKey(value: string): PublicKey {
  if (!isValidPublicKey(value)) {
    throw new Error(`Invalid Solana address: ${value}`);
  }
  return new PublicKey(value);
}

export function isValidSymbol(value: string): boolean {
  return /^[A-Z0-9-]{2,10}$/.test(value);
}

export function isValidDecimals(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 9;
}

export function isValidBasisPoints(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 10000;
}
