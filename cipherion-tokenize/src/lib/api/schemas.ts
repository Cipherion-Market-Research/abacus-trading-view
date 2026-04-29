import { z } from "zod";

const base58Address = z.string().min(32).max(44);

export const distributionRecipientSchema = z.object({
  ownerAddress: base58Address,
  amount: z.string(),
  signature: z.string().optional(),
  status: z.enum(["pending", "done", "failed", "skipped"]),
  error: z.string().optional(),
});

export const distributionRecordSchema = z.object({
  id: z.string().startsWith("dist_"),
  mintAddress: base58Address,
  timestamp: z.number(),
  totalAmount: z.string(),
  totalAllocated: z.string(),
  memo: z.string(),
  recipients: z.array(distributionRecipientSchema).min(1),
  status: z.enum(["complete", "partial", "failed"]),
});

export const registerEntrySchema = z.object({
  address: z.string(),
  balance: z.string(),
  status: z.enum(["active", "frozen"]),
});

export const registerUploadSchema = z.object({
  mint: base58Address,
  wallet: base58Address,
  entries: z.array(registerEntrySchema).min(1),
});

export const mintRegisterSchema = z.object({
  mint: base58Address,
  assetType: z.string().min(1),
  imageUri: z.string().optional().default(""),
  description: z.string().optional().default(""),
});

export const walletAuthSchema = z.object({
  wallet: base58Address,
  nonce: z.string().uuid(),
  timestamp: z.number(),
  signature: z.string(),
});

export type DistributionRecordPayload = z.infer<typeof distributionRecordSchema>;
export type RegisterUploadPayload = z.infer<typeof registerUploadSchema>;
export type WalletAuthPayload = z.infer<typeof walletAuthSchema>;
