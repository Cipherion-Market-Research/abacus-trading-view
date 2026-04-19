import type { CreateTokenParams } from "@/lib/solana/types";

export interface DemoSeed {
  symbol: string;
  params: Omit<CreateTokenParams, "extensions" | "metadata"> & {
    extensions: CreateTokenParams["extensions"];
    metadata: CreateTokenParams["metadata"];
  };
}

const DECIMALS_6 = 6;
const SUPPLY = (whole: number, decimals: number) =>
  BigInt(Math.floor(whole * 10 ** decimals));

export const DEMO_SEEDS: DemoSeed[] = [
  {
    symbol: "CTN-26",
    params: {
      name: "Cipherion Treasury Note Q3-26",
      symbol: "CTN-26",
      decimals: DECIMALS_6,
      uri: "",
      description:
        "Tokenized 90-day US Treasury bills, NAV-tracked, monthly coupon.",
      assetType: "treasury",
      regulatoryFramework: "reg_d",
      jurisdiction: "US",
      extensions: {
        defaultAccountState: "frozen",
        pausable: true,
        transferFee: { bps: 25, maxFee: SUPPLY(1000, DECIMALS_6) },
      },
      initialSupply: SUPPLY(1_000_000, DECIMALS_6),
      metadata: [
        { key: "asset_type", value: "treasury" },
        { key: "nav_per_token", value: "10.00" },
        { key: "coupon_rate", value: "4.50" },
        { key: "maturity_date", value: "2027-01-15" },
        { key: "custodian", value: "BNY Mellon" },
        { key: "auditor", value: "Deloitte" },
        { key: "isin", value: "US912797GR25" },
      ],
    },
  },
  {
    symbol: "MORE-A",
    params: {
      name: "Manhattan Office REIT Series A",
      symbol: "MORE-A",
      decimals: 0,
      uri: "",
      description:
        "Fractional ownership in 350 5th Avenue commercial real estate.",
      assetType: "real_estate",
      regulatoryFramework: "reg_d",
      jurisdiction: "US",
      extensions: {
        defaultAccountState: "frozen",
        pausable: true,
      },
      initialSupply: BigInt(10_000),
      metadata: [
        { key: "asset_type", value: "real_estate" },
        { key: "nav_per_token", value: "1500.00" },
        { key: "building", value: "350 5th Avenue, New York" },
        { key: "cap_rate", value: "5.20" },
        { key: "occupancy", value: "94" },
        { key: "custodian", value: "Northern Trust" },
      ],
    },
  },
  {
    symbol: "ADC7",
    params: {
      name: "Apollo Direct Credit Fund VII",
      symbol: "ADC7",
      decimals: DECIMALS_6,
      uri: "",
      description:
        "Senior secured private credit, vintage 2026, quarterly distributions.",
      assetType: "debt",
      regulatoryFramework: "reg_d",
      jurisdiction: "US",
      extensions: {
        defaultAccountState: "frozen",
        pausable: true,
      },
      initialSupply: SUPPLY(50_000, DECIMALS_6),
      metadata: [
        { key: "asset_type", value: "debt" },
        { key: "nav_per_token", value: "1.00" },
        { key: "coupon_rate", value: "8.50" },
        { key: "vintage", value: "2026" },
        { key: "credit_rating", value: "A-" },
        { key: "custodian", value: "State Street" },
      ],
    },
  },
  {
    symbol: "CGR",
    params: {
      name: "Cipherion Gold Reserve",
      symbol: "CGR",
      decimals: 4,
      uri: "",
      description:
        "Each token represents 1 gram of LBMA-grade 24K gold held in vault.",
      assetType: "commodity",
      regulatoryFramework: "none",
      jurisdiction: "Singapore",
      extensions: {
        defaultAccountState: "frozen",
        pausable: true,
      },
      initialSupply: SUPPLY(100_000, 4),
      metadata: [
        { key: "asset_type", value: "commodity" },
        { key: "backing", value: "1g 24K gold per token" },
        { key: "vault", value: "Brink's Singapore" },
        { key: "auditor", value: "Bureau Veritas" },
        { key: "audit_frequency", value: "Quarterly" },
      ],
    },
  },
  {
    symbol: "TTI-50",
    params: {
      name: "Tokenized Tech Index 50",
      symbol: "TTI-50",
      decimals: DECIMALS_6,
      uri: "",
      description:
        "Top 50 listed technology companies by market cap, rebalanced quarterly.",
      assetType: "fund",
      regulatoryFramework: "reg_d",
      jurisdiction: "US",
      extensions: {
        defaultAccountState: "frozen",
        pausable: true,
      },
      initialSupply: SUPPLY(100_000, DECIMALS_6),
      metadata: [
        { key: "asset_type", value: "fund" },
        { key: "nav_per_token", value: "50.00" },
        { key: "annual_yield", value: "1.20" },
        { key: "constituents", value: "50" },
        { key: "rebalanced", value: "Quarterly" },
        { key: "fund_manager", value: "Cipherion Asset Management" },
      ],
    },
  },
];
