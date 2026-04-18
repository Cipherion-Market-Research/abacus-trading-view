import type {
  AssetType,
  RegulatoryFramework,
  TokenExtensionConfig,
  TokenMetadataField,
} from "@/types/token";

export interface AssetTemplate {
  assetType: AssetType;
  label: string;
  description: string;
  defaultSymbolPrefix: string;
  defaultDecimals: number;
  defaultExtensions: TokenExtensionConfig;
  defaultFramework: RegulatoryFramework;
  metadataFields: TokenMetadataField[];
}

export const ASSET_TEMPLATES: AssetTemplate[] = [
  {
    assetType: "treasury",
    label: "Treasury Bill Fund",
    description: "Tokenized government treasury bills or money market instruments",
    defaultSymbolPrefix: "TB",
    defaultDecimals: 6,
    defaultExtensions: {
      defaultAccountState: "frozen",
      pausable: true,
      transferFee: { bps: 25, maxFee: 1000000n },
    },
    defaultFramework: "reg_d",
    metadataFields: [
      { key: "asset_type", value: "us_treasury_bill" },
      { key: "nav_per_token", value: "10.00" },
      { key: "coupon_rate", value: "" },
      { key: "maturity_date", value: "" },
      { key: "custodian", value: "" },
    ],
  },
  {
    assetType: "real_estate",
    label: "Real Estate Share",
    description: "Fractional ownership in real estate property or REIT",
    defaultSymbolPrefix: "RE",
    defaultDecimals: 6,
    defaultExtensions: {
      defaultAccountState: "frozen",
      pausable: true,
      permanentDelegate: undefined,
    },
    defaultFramework: "reg_d",
    metadataFields: [
      { key: "asset_type", value: "real_estate" },
      { key: "property_address", value: "" },
      { key: "nav_per_token", value: "" },
      { key: "annual_yield", value: "" },
      { key: "property_type", value: "" },
    ],
  },
  {
    assetType: "equity",
    label: "Private Equity Token",
    description: "Tokenized equity in a private company or fund",
    defaultSymbolPrefix: "EQ",
    defaultDecimals: 0,
    defaultExtensions: {
      defaultAccountState: "frozen",
      pausable: true,
    },
    defaultFramework: "reg_d",
    metadataFields: [
      { key: "asset_type", value: "private_equity" },
      { key: "share_class", value: "" },
      { key: "par_value", value: "" },
      { key: "voting_rights", value: "yes" },
    ],
  },
  {
    assetType: "commodity",
    label: "Commodity-Backed Token",
    description: "Token backed by physical commodities (gold, silver, oil, etc.)",
    defaultSymbolPrefix: "CM",
    defaultDecimals: 6,
    defaultExtensions: {
      defaultAccountState: "frozen",
      pausable: true,
      transferFee: { bps: 50, maxFee: 5000000n },
    },
    defaultFramework: "none",
    metadataFields: [
      { key: "asset_type", value: "commodity" },
      { key: "commodity", value: "" },
      { key: "weight_per_token", value: "" },
      { key: "purity", value: "" },
      { key: "vault_location", value: "" },
      { key: "auditor", value: "" },
    ],
  },
  {
    assetType: "debt",
    label: "Debt Instrument",
    description: "Tokenized bond, note, or other debt security",
    defaultSymbolPrefix: "BD",
    defaultDecimals: 6,
    defaultExtensions: {
      defaultAccountState: "frozen",
      pausable: true,
    },
    defaultFramework: "reg_s",
    metadataFields: [
      { key: "asset_type", value: "corporate_bond" },
      { key: "face_value", value: "" },
      { key: "coupon_rate", value: "" },
      { key: "maturity_date", value: "" },
      { key: "payment_frequency", value: "semi-annual" },
      { key: "credit_rating", value: "" },
      { key: "isin", value: "" },
    ],
  },
  {
    assetType: "fund",
    label: "Investment Fund",
    description: "Tokenized fund shares (hedge fund, venture, PE fund)",
    defaultSymbolPrefix: "FD",
    defaultDecimals: 6,
    defaultExtensions: {
      defaultAccountState: "frozen",
      pausable: true,
      permanentDelegate: undefined,
    },
    defaultFramework: "reg_d",
    metadataFields: [
      { key: "asset_type", value: "investment_fund" },
      { key: "nav_per_token", value: "" },
      { key: "fund_manager", value: "" },
      { key: "strategy", value: "" },
      { key: "lockup_period", value: "" },
      { key: "management_fee", value: "" },
      { key: "performance_fee", value: "" },
    ],
  },
];

export function getTemplate(assetType: AssetType): AssetTemplate | undefined {
  return ASSET_TEMPLATES.find((t) => t.assetType === assetType);
}
