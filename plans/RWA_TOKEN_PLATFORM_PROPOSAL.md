# CipheX Atlas — POC/MVP Proposal

**Date:** 2026-04-17 (original) · last audit 2026-04-18
**Status:** Historical — this is the pre-build proposal. The MVP shipped and has since grown beyond the original scope (env hardening, public marketing shell, KYC gate, design-system parity, mobile). **For current state see `ATLAS_HANDOFF.md`. For remaining work see `ROADMAP.md`.**
**Brand:** CipheX Atlas (package: `ciphex-atlas`, directory: `/cipherion-tokenize/`)

> **Read this for:** the original chain-selection analysis, architectural rationale, token-parameter rationale, and screen-by-screen UX spec as designed at the outset. Every architectural bet in this doc was honored in the implementation, though many features have since been extended. Do not edit this doc to reflect current state — that's what `ATLAS_HANDOFF.md` is for.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Blockchain Selection Analysis](#2-blockchain-selection-analysis)
3. [Recommended Stack: Solana Token-2022](#3-recommended-stack-solana-token-2022)
4. [Token Parameters & Configuration](#4-token-parameters--configuration)
5. [Architecture Design](#5-architecture-design)
6. [Feature Scope — MVP](#6-feature-scope--mvp)
7. [Screen-by-Screen UX Spec](#7-screen-by-screen-ux-spec)
8. [Technical Implementation Details](#8-technical-implementation-details)
9. [Demo Scenario Walkthrough](#9-demo-scenario-walkthrough)
10. [Project Structure](#10-project-structure)
11. [Risk & Trade-offs](#11-risk--trade-offs)
12. [Phase 2+ Roadmap](#12-phase-2-roadmap)
13. [Open Questions](#13-open-questions)

---

## 1. Executive Summary

**Goal:** Build a demonstrable POC/MVP that allows users to create RWA-backed tokens with configurable compliance features, mint/distribute them to investor wallets, and freely trade them — all on a live blockchain testnet.

**Target audience for demo:** RWA-curious counterparties (asset managers, fund administrators, institutional investors) who want to see how tokenization works in practice.

**Recommended chain:** Solana (Devnet) using the **Token-2022 (Token Extensions)** program.

**Why Solana Token-2022 over alternatives:**
- Native compliance primitives (Transfer Hooks, Freeze, Pause, Permanent Delegate) — no smart contract deployment for basic RWA operations
- ~$0.00025/tx — cheapest meaningful chain for demos and production
- Franklin Templeton's $594M FOBXX fund validates institutional adoption
- Maps cleanly to the Hedera HTS demo you previously built (KYC Grant → DefaultAccountState; Freeze → Freeze Authority; Wipe → Permanent Delegate; atomic swaps → Solana tx atomicity)
- Mature wallet ecosystem (Phantom, Solflare, Backpack) with React adapter libraries
- Token-2022's 20+ extensions provide more configurability than any competing standard

**What the demo will show:**
1. An asset issuer creates a tokenized real-world asset (e.g., a treasury bill fund, real estate share, or commodity-backed token) with configurable compliance rules
2. Investor wallets get KYC-approved and can receive tokens
3. The issuer mints and distributes tokens to approved investors
4. Investors can transfer tokens peer-to-peer (compliance checks enforced on every transfer)
5. The issuer can freeze accounts, pause the token, force-redeem, or burn supply
6. A dashboard shows the full cap table, transaction history, and compliance status

---

## 2. Blockchain Selection Analysis

### Cost Comparison

| Chain | Avg Tx Cost | Token Creation | Token Transfer | USD-Stable Fees |
|-------|-------------|----------------|----------------|-----------------|
| **Solana** | ~$0.00025 | ~$1.50-$2.70 | ~$0.00025 | No (SOL-denominated) |
| **Hedera HTS** | ~$0.001 | $1.00 (fixed) | $0.001 (fixed) | Yes (USD-pegged) |
| **Polygon PoS** | $0.0005-$0.005 | ~$0.01-$0.10 | ~$0.001-$0.01 | No |
| **Base (L2)** | <$0.01 | ~$0.05-$0.50 | <$0.01 | No |
| **Avalanche C-Chain** | ~$0.01-$0.05 | ~$0.10-$0.50 | ~$0.01-$0.05 | No |
| **Ethereum L1** | $0.50-$50+ | $5-$50+ | $0.50-$5+ | No |

### RWA Feature Comparison

| Feature | Solana Token-2022 | Hedera HTS | EVM (ERC-3643) |
|---------|-------------------|------------|----------------|
| KYC Gating | Transfer Hook + oracle | Native KYC flag | ONCHAINID + Identity Registry |
| Transfer Restrictions | Transfer Hook (programmable) | Native Freeze/Pause | Compliance Contract modules |
| Forced Transfer/Seizure | Permanent Delegate | Wipe operation | Token owner function |
| Emergency Pause | Pausable extension | Native Pause | Token pause function |
| Audit Trail | MemoTransfer extension | Native memo field | Event logs |
| Transfer Fees | Native (basis points) | Custom fee schedules | Smart contract logic |
| Confidential Transfers | ElGamal + ZK proofs | Not supported | Not standard |
| Smart Contract Required | No (extensions only) | No (API-based) | Yes (deploy 6 contracts) |
| Dev Ecosystem Size | Large, growing | Small | Largest |

### Scoring Matrix

| Criteria (weight) | Solana | Hedera | Polygon | Base |
|-------------------|--------|--------|---------|------|
| Tx cost (20%) | 10 | 9 | 8 | 8 |
| RWA features (25%) | 9 | 8 | 9 | 7 |
| Dev tooling (20%) | 8 | 6 | 10 | 9 |
| Ecosystem adoption (15%) | 8 | 5 | 7 | 6 |
| Demo friendliness (10%) | 9 | 8 | 7 | 7 |
| Institutional credibility (10%) | 8 | 7 | 6 | 6 |
| **Weighted Total** | **8.75** | **7.05** | **8.05** | **7.30** |

### Decision: Solana with Token-2022

Solana wins on cost, native compliance extensions, and demo-friendliness. The only area where EVM chains pull ahead is developer tooling breadth (Hardhat/Foundry/OpenZeppelin), but Solana's `@solana/spl-token` and Anchor framework are mature enough for our scope. Hedera is a close second for simplicity but has a smaller ecosystem and lower counterparty name recognition.

**Fallback option:** If Solana's Transfer Hook complexity becomes a blocker for the MVP timeline, we can simplify by using DefaultAccountState=Frozen + manual freeze/unfreeze for KYC gating (no custom program needed) and defer Transfer Hook implementation to Phase 2.

---

## 3. Recommended Stack: Solana Token-2022

### What is Token-2022?

Token-2022 (program ID: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) is Solana's next-generation token program. It's a superset of the original SPL Token program with 20+ configurable extensions that are set at mint creation time. Key difference from EVM: these are **protocol-level features**, not smart contract logic — meaning compliance primitives are enforced by the Solana runtime itself.

### Extensions Relevant to RWA

| Extension | What It Does | RWA Use Case |
|-----------|-------------|--------------|
| **TransferFeeConfig** | Deducts a configurable fee (basis points + max cap) on every transfer | Management fees, platform fees |
| **DefaultAccountState** | New token accounts start in a specified state (e.g., `Frozen`) | KYC gate: accounts frozen until approved |
| **TransferHook** | Calls a custom on-chain program on every transfer | Advanced compliance: whitelist checks, jurisdiction, investor caps |
| **PermanentDelegate** | Designated authority can transfer/burn from any account | Regulatory seizure, forced redemption |
| **Pausable** | Authority can halt all minting, burning, and transferring | Emergency regulatory halt, NAV recalculation |
| **NonTransferable** | Tokens cannot be transferred (soulbound) | Compliance credentials, voting rights |
| **MetadataPointer + TokenMetadata** | On-chain name, symbol, URI, key-value pairs | Asset documentation, legal docs URI |
| **MemoTransfer** | Requires a memo on every inbound transfer | Audit trail — reference IDs, signed claims |
| **InterestBearingConfig** | Cosmetic interest rate for UI display | Show accrued yield on treasury tokens |
| **MintCloseAuthority** | Authority to close the mint account | Clean asset lifecycle termination |
| **ConfidentialTransfers** | ElGamal-encrypted balances with ZK proofs | Institutional privacy (Phase 2 — incompatible with Transfer Hooks currently) |

### How This Maps to the Hedera HTS Demo

| HTS Feature | Solana Token-2022 Equivalent |
|-------------|------------------------------|
| `TokenCreate` | `createMint()` with extensions |
| `TokenMint` | `mintTo()` |
| `TokenTransfer` | `transfer()` / `transferChecked()` |
| `TokenAssociate` | `createAssociatedTokenAccount()` |
| `TokenGrantKyc` | Thaw account (unfreeze) when using DefaultAccountState=Frozen |
| `TokenRevokeKyc` | Freeze account |
| `TokenFreeze/Unfreeze` | `freezeAccount()` / `thawAccount()` |
| `TokenWipe` | `burnChecked()` via PermanentDelegate |
| `TokenPause/Unpause` | Pausable extension `pause()` / `unpause()` |
| `TokenBurn` | `burnChecked()` |
| `TokenDelete` | `closeAccount()` via MintCloseAuthority |
| Atomic Swap | Single Solana transaction with multiple instructions |

---

## 4. Token Parameters & Configuration

### User-Configurable Parameters (Token Creation Form)

These are the parameters the UI will expose when creating a new RWA token:

#### Basic Information
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `name` | string | Yes | — | Token name (e.g., "Cipherion Treasury Fund A") |
| `symbol` | string | Yes | — | Ticker symbol (e.g., "CTF-A") |
| `description` | string | No | — | Short description of the underlying asset |
| `decimals` | number (0-9) | Yes | 6 | Decimal precision (6 = USDC-like, 0 = whole units) |
| `initialSupply` | number | No | 0 | Tokens to mint immediately to treasury |
| `maxSupply` | number | No | Unlimited | Maximum total supply cap (enforced in Transfer Hook or off-chain) |
| `imageUri` | string | No | — | Token icon URI (IPFS or HTTPS) |
| `externalUri` | string | No | — | Link to prospectus, legal docs, or asset details |

#### Asset Classification
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `assetType` | enum | Yes | — | `treasury`, `real_estate`, `commodity`, `equity`, `debt`, `fund`, `other` |
| `jurisdiction` | string | No | — | Issuing jurisdiction (e.g., "US", "CA", "EU") |
| `regulatoryFramework` | enum | No | `none` | `reg_d`, `reg_s`, `reg_a_plus`, `mifid2`, `none` |

#### Authorities (Key Management)
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `mintAuthority` | pubkey | Yes | Connected wallet | Who can mint new tokens |
| `freezeAuthority` | pubkey | Yes | Connected wallet | Who can freeze/thaw accounts |
| `transferFeeAuthority` | pubkey | Conditional | Connected wallet | Who can modify transfer fee config |
| `permanentDelegate` | pubkey | No | None | Unrestricted burn/transfer authority (regulatory) |

#### Compliance Extensions (Toggle-Based)
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `enableKycGating` | boolean | No | true | New accounts start frozen; must be approved |
| `enableTransferFees` | boolean | No | false | Charge fee on every transfer |
| `transferFeeBps` | number (0-10000) | Conditional | 0 | Fee in basis points (100 = 1%) |
| `transferFeeMax` | number | Conditional | — | Max fee per transfer (in token units) |
| `enablePause` | boolean | No | true | Allow emergency pause of all activity |
| `enablePermanentDelegate` | boolean | No | false | Allow forced transfer/burn from any account |
| `enableMemoRequired` | boolean | No | false | Require memo on inbound transfers |
| `enableTransferHook` | boolean | No | false | Advanced: custom compliance program on every transfer |

#### Metadata (On-Chain Key-Value Pairs)
| Key | Value Example | Description |
|-----|---------------|-------------|
| `asset_type` | `us_treasury_bill` | Underlying asset classification |
| `nav_per_token` | `10.00` | Net asset value per token |
| `maturity_date` | `2027-01-15` | For debt instruments |
| `coupon_rate` | `4.25` | Annual yield / interest rate |
| `custodian` | `Bank of New York Mellon` | Asset custodian |
| `auditor` | `Deloitte` | Fund auditor |
| `legal_doc_uri` | `ipfs://Qm...` | Link to prospectus/offering memorandum |
| `isin` | `US912797GR25` | ISIN of underlying asset |

---

## 5. Architecture Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Token    │  │ Investor │  │  Admin   │  │  Portfolio  │ │
│  │ Creator  │  │ Onboard  │  │  Panel   │  │  Dashboard  │ │
│  │  Wizard  │  │   Flow   │  │          │  │             │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │              │             │               │         │
│  ┌────▼──────────────▼─────────────▼───────────────▼──────┐ │
│  │            Solana Service Layer (TypeScript)            │ │
│  │  - Token operations (create, mint, transfer, burn)     │ │
│  │  - Account management (create ATA, freeze, thaw)       │ │
│  │  - Transaction building & signing                      │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │          @solana/wallet-adapter (React)                 │ │
│  │   Phantom  |  Solflare  |  Backpack  |  Ledger          │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  Solana Devnet  │
                   │                 │
                   │  Token-2022     │
                   │  Program        │
                   │                 │
                   │  (Optional)     │
                   │  Transfer Hook  │
                   │  Program        │
                   └─────────────────┘
```

### Key Design Decisions

1. **Client-side transaction construction** — All Solana transactions are built and signed in the browser via wallet adapter. No backend custody of private keys. This is the standard Solana dApp pattern and avoids regulatory complexity.

2. **No custom backend needed for MVP** — Token-2022 operations are executed directly against the Solana network. Token metadata and transaction history are read from on-chain state and the Solana RPC/indexer. This dramatically simplifies the architecture.

3. **Optional: Lightweight API for demo state** — For demo convenience (pre-seeded accounts, scenario state, supplemental metadata not stored on-chain), we may add a thin Next.js API route backed by local storage or a small database. This is NOT required for core functionality.

4. **Transfer Hook as Phase 1B** — The base MVP uses DefaultAccountState=Frozen for KYC gating (simpler). Transfer Hook for advanced compliance (whitelist registry, investor caps, jurisdiction checks) can be added as a fast-follow since the mint extension is set at creation time.

### Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 16 + React 19 + TypeScript | Matches existing Cipherion stack |
| Styling | Tailwind CSS 4 + Radix UI + shadcn/ui | Matches existing Cipherion stack |
| Wallet | @solana/wallet-adapter-react | Standard Solana wallet integration |
| Blockchain SDK | @solana/web3.js + @solana/spl-token | Core Solana + Token-2022 operations |
| On-chain program | Token-2022 (native) | No custom program for base MVP |
| Transfer Hook (Phase 1B) | Anchor v0.31+ (Rust) | Custom compliance logic |
| Network | Solana Devnet | Free, resets periodically |
| Deployment | Vercel | Same as existing platform |

---

## 6. Feature Scope — MVP

### Phase 1A: Core Token Lifecycle (Recommended MVP)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 1 | **Wallet Connection** | Connect Phantom/Solflare/Backpack via wallet adapter | Low |
| 2 | **Token Creation Wizard** | Multi-step form → creates Token-2022 mint with selected extensions | Medium |
| 3 | **Token Dashboard** | View all tokens created by connected wallet, with metadata and supply info | Low-Medium |
| 4 | **Mint Tokens** | Mint new supply to treasury (mint authority's ATA) | Low |
| 5 | **Investor Onboarding** | Create associated token account for investor wallet; KYC approve (thaw) | Medium |
| 6 | **Token Distribution** | Transfer tokens from treasury to approved investor wallets | Low |
| 7 | **Peer-to-Peer Transfer** | Investor-to-investor transfer (both must be KYC-approved/unfrozen) | Low |
| 8 | **Compliance Actions** | Freeze/thaw accounts, pause/unpause token, burn via permanent delegate | Medium |
| 9 | **Cap Table View** | List all token holders with balances, KYC status, freeze status | Medium |
| 10 | **Transaction History** | On-chain transaction log for the token (via Solana RPC `getSignaturesForAddress`) | Medium |
| 11 | **Devnet Faucet Integration** | Request test SOL for demo wallets | Low |

### Phase 1B: Enhanced Compliance (Fast-Follow)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 12 | **Transfer Hook Program** | Custom Anchor program enforcing whitelist/jurisdiction checks on transfer | High |
| 13 | **Whitelist Registry** | On-chain PDA storing approved wallet addresses per token | Medium |
| 14 | **Investor Caps** | Max holder count or max balance per wallet enforced in Transfer Hook | Medium |

### Phase 2: Production Readiness (Future)

| # | Feature | Description |
|---|---------|-------------|
| 15 | **KYC Provider Integration** | Civic Pass, Synaps, or similar for real identity verification |
| 16 | **Fiat On-Ramp** | Stripe/MoonPay for purchasing tokens with USD |
| 17 | **Mainnet Deployment** | Move from Devnet to Mainnet-Beta |
| 18 | **Multi-Token Portfolio** | Investor view across all held RWA tokens |
| 19 | **Distribution/Dividends** | Batch airdrop yield payments to all holders |
| 20 | **Confidential Transfers** | ElGamal-encrypted balances for institutional privacy |
| 21 | **Secondary Marketplace** | Order-book or AMM for token trading |
| 22 | **Audit Reporting** | Exportable compliance reports |

### What's Explicitly Out of Scope for MVP
- Real KYC/AML verification (simulated in demo)
- Fiat payments / on-ramp
- Mainnet deployment
- Mobile-native app
- Multi-chain support
- Automated market maker / DEX integration
- Legal/regulatory opinions

---

## 7. Screen-by-Screen UX Spec

### Screen 1: Landing / Home
- Cipherion branding, brief explainer of RWA tokenization
- "Connect Wallet" button (triggers wallet adapter modal)
- Once connected: show wallet address, SOL balance, "Request Devnet SOL" button
- Navigation: Token Creator | My Tokens | Explorer

### Screen 2: Token Creation Wizard (Multi-Step)

**Step 1 — Basic Info:**
- Token name (text input)
- Symbol (text input, auto-uppercase)
- Description (textarea)
- Decimals (number, default 6)
- Asset type (dropdown: Treasury, Real Estate, Commodity, Equity, Debt, Fund, Other)
- Token image (URL input or file upload to IPFS placeholder)

**Step 2 — Compliance Configuration:**
- Toggle: KYC Gating (DefaultAccountState=Frozen) — default ON
- Toggle: Transfer Fees — reveals fee bps + max fee inputs
- Toggle: Pausable — default ON
- Toggle: Permanent Delegate (forced redemption) — default OFF, with warning tooltip
- Toggle: Memo Required — default OFF
- Regulatory framework selector (informational metadata)

**Step 3 — Supply & Authorities:**
- Initial mint amount (number input)
- Mint authority (defaults to connected wallet, editable)
- Freeze authority (defaults to connected wallet, editable)
- Advanced: permanent delegate pubkey (if enabled)

**Step 4 — Metadata (Optional):**
- Key-value pair editor for on-chain metadata
- Pre-populated fields based on asset type (NAV, maturity, coupon, custodian, ISIN)
- Legal document URI input

**Step 5 — Review & Create:**
- Summary card showing all selected parameters
- Estimated cost in SOL
- "Create Token" button → builds and sends transaction
- Success: show mint address, link to Solana Explorer

### Screen 3: Token Dashboard (Issuer View)

**Header:** Token name, symbol, icon, mint address (copyable), Solana Explorer link

**Stats Row:**
- Total Supply | Circulating Supply | # Holders | # KYC Approved | Token Status (Active/Paused)

**Tabs:**
- **Holders (Cap Table):** Table with columns: Wallet Address (truncated), Balance, % of Supply, KYC Status (Approved/Pending), Freeze Status, Actions (Freeze/Thaw/Wipe)
- **Mint & Distribute:** Mint new tokens form + transfer to investor form (autocomplete from known addresses)
- **Compliance Actions:** Pause/Unpause toggle, Freeze/Thaw specific account, Burn from account (via Permanent Delegate)
- **Transaction History:** Paginated list of all token transactions from on-chain data
- **Token Details:** Read-only view of all metadata, authorities, extension configuration

### Screen 4: Investor Onboarding

- Input: Investor wallet address (pubkey)
- Action 1: Create Associated Token Account (ATA) for this wallet+token
- Action 2: Approve KYC (thaw the account)
- Shows confirmation with the investor's new token account address
- Batch mode: paste multiple addresses (one per line) for bulk onboarding

### Screen 5: Investor Portfolio (Investor View)

- Connected wallet's token holdings across all RWA tokens
- Per token: balance, token name/symbol, issuer, asset type, KYC status
- Transfer form: select token, enter recipient address, amount, optional memo
- Transaction history for connected wallet

### Screen 6: Explorer / Public View

- Search by mint address or token name
- Public token info: name, symbol, supply, holder count, metadata
- Useful for demo walkthrough — show counterparties the on-chain state

---

## 8. Technical Implementation Details

### Key Dependencies

```json
{
  "@solana/web3.js": "^1.95.0",
  "@solana/spl-token": "^0.4.0",
  "@solana/wallet-adapter-base": "^0.9.23",
  "@solana/wallet-adapter-react": "^0.15.35",
  "@solana/wallet-adapter-react-ui": "^0.9.35",
  "@solana/wallet-adapter-wallets": "^0.19.32",
  "@metaplex-foundation/mpl-token-metadata": "^3.0.0"
}
```

### Core Service Functions

```typescript
// Pseudocode — key operations the Solana service layer must support

// 1. Create RWA Token
async function createRwaToken(params: {
  name: string;
  symbol: string;
  decimals: number;
  uri: string;
  extensions: {
    defaultAccountState?: 'frozen' | 'initialized';
    transferFee?: { bps: number; maxFee: bigint };
    pausable?: boolean;
    permanentDelegate?: PublicKey;
    memoTransfer?: boolean;
    transferHook?: PublicKey;
  };
  initialSupply?: bigint;
  metadata?: Record<string, string>;
}): Promise<{ mint: PublicKey; signature: string }>

// 2. Mint tokens to treasury
async function mintTokens(
  mint: PublicKey, amount: bigint
): Promise<string>

// 3. Onboard investor (create ATA + KYC approve)
async function onboardInvestor(
  mint: PublicKey, investor: PublicKey
): Promise<{ ata: PublicKey; signature: string }>

// 4. Transfer tokens
async function transferTokens(
  mint: PublicKey, to: PublicKey, amount: bigint, memo?: string
): Promise<string>

// 5. Compliance actions
async function freezeAccount(mint: PublicKey, account: PublicKey): Promise<string>
async function thawAccount(mint: PublicKey, account: PublicKey): Promise<string>
async function pauseToken(mint: PublicKey): Promise<string>
async function unpauseToken(mint: PublicKey): Promise<string>
async function forceTransfer(mint: PublicKey, from: PublicKey, to: PublicKey, amount: bigint): Promise<string>
async function forceBurn(mint: PublicKey, from: PublicKey, amount: bigint): Promise<string>

// 6. Read operations
async function getTokenInfo(mint: PublicKey): Promise<TokenInfo>
async function getTokenHolders(mint: PublicKey): Promise<HolderInfo[]>
async function getTransactionHistory(mint: PublicKey): Promise<TxInfo[]>
```

### Token-2022 Creation Flow (Technical)

```typescript
// Simplified flow for creating a Token-2022 mint with extensions

import {
  ExtensionType,
  createInitializeMintInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializePermanentDelegateInstruction,
  createInitializeMetadataPointerInstruction,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import {
  createInitializeInstruction as createInitializeMetadataInstruction,
} from '@solana/spl-token-metadata';

// 1. Determine extensions list
const extensions: ExtensionType[] = [
  ExtensionType.MetadataPointer,      // Always — for name/symbol/uri
  ExtensionType.DefaultAccountState,   // If KYC gating enabled
  ExtensionType.TransferFeeConfig,     // If transfer fees enabled
  ExtensionType.PermanentDelegate,     // If force-redemption enabled
  // ExtensionType.TransferHook,       // Phase 1B
];

// 2. Calculate space and rent
const mintLen = getMintLen(extensions);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

// 3. Build transaction with ordered instructions:
//    a. Create account (SystemProgram)
//    b. Initialize each extension
//    c. Initialize mint
//    d. Initialize metadata
//    e. (Optional) Mint initial supply

// Extensions MUST be initialized BEFORE initializeMint
```

### Wallet Integration Pattern

```typescript
// Next.js App Router — providers wrapper
// app/providers.tsx

'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

export function SolanaProviders({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### Reading Cap Table (Token Holders)

```typescript
// Use getProgramAccounts to find all token accounts for a mint
const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
  filters: [
    { dataSize: 165 }, // base token account size (may vary with extensions)
    { memcmp: { offset: 0, bytes: mint.toBase58() } }, // filter by mint
  ],
});

// Parse each account to get: owner, balance, frozen state
// For large holder counts, use a Solana indexer (Helius, Triton, etc.)
```

---

## 9. Demo Scenario Walkthrough

### Scenario: "Cipherion Treasury Fund A" — Tokenized T-Bill Fund

This is the scripted demo flow for counterparty presentations:

**Setup (pre-demo):**
- 3 browser profiles: Issuer (Phantom), Investor A (Solflare), Investor B (Phantom)
- All wallets funded with Devnet SOL

**Act 1 — Token Creation (Issuer):**
1. Issuer connects wallet
2. Opens Token Creator wizard
3. Fills in: Name="Cipherion Treasury Fund A", Symbol="CTF-A", Decimals=6, Asset Type=Treasury
4. Enables: KYC Gating, Transfer Fee (0.25%, max 100 CTF-A), Pausable
5. Sets metadata: NAV=$10.00, Coupon=4.5%, Custodian="BNY Mellon", Legal Doc URI
6. Reviews and creates → transaction confirmed, mint address shown
7. Mints 1,000,000 CTF-A to treasury

**Act 2 — Investor Onboarding (Issuer):**
1. Issuer navigates to investor onboarding
2. Pastes Investor A's wallet address → creates ATA + approves KYC
3. Pastes Investor B's wallet address → creates ATA + approves KYC
4. Cap table now shows 2 approved investors (zero balance)

**Act 3 — Distribution (Issuer):**
1. Issuer distributes 100,000 CTF-A to Investor A
2. Distributes 50,000 CTF-A to Investor B
3. Cap table updates: Issuer=850,000, A=100,000, B=50,000

**Act 4 — Peer-to-Peer Transfer (Investor A):**
1. Investor A connects their wallet
2. Opens portfolio — sees 100,000 CTF-A
3. Transfers 10,000 CTF-A to Investor B
4. Transfer succeeds — 0.25% fee (25 CTF-A) withheld
5. Result: A=89,975, B=60,000, Fee pool=25

**Act 5 — Compliance Actions (Issuer):**
1. Issuer freezes Investor B's account (simulating suspicious activity)
2. Investor B tries to transfer → **transaction fails** (account frozen)
3. Issuer unfreezes Investor B
4. Issuer pauses entire token → **all transfers blocked**
5. Issuer unpauses → normal operations resume

**Act 6 — Forced Redemption (if Permanent Delegate enabled):**
1. Issuer burns 10,000 CTF-A from Investor B via Permanent Delegate
2. Investor B's balance decreases (simulating asset redemption/regulatory seizure)

**Debrief:**
- Show on-chain transaction history on Solana Explorer
- Show cap table reflects all changes
- Emphasize: all compliance actions are on-chain, auditable, immutable

---

## 10. Project Structure

```
rwa-token-platform/                    # New Next.js app (or route group in existing app)
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with SolanaProviders
│   │   ├── page.tsx                   # Landing page
│   │   ├── create/
│   │   │   └── page.tsx               # Token creation wizard
│   │   ├── tokens/
│   │   │   ├── page.tsx               # My tokens list
│   │   │   └── [mint]/
│   │   │       ├── page.tsx           # Token dashboard (issuer view)
│   │   │       ├── holders/
│   │   │       │   └── page.tsx       # Cap table
│   │   │       ├── onboard/
│   │   │       │   └── page.tsx       # Investor onboarding
│   │   │       └── history/
│   │   │           └── page.tsx       # Transaction history
│   │   ├── portfolio/
│   │   │   └── page.tsx               # Investor portfolio view
│   │   └── explorer/
│   │       └── page.tsx               # Public token explorer
│   │
│   ├── components/
│   │   ├── wallet/
│   │   │   ├── wallet-provider.tsx    # Solana provider wrapper
│   │   │   └── connect-button.tsx     # Wallet connect UI
│   │   ├── token/
│   │   │   ├── create-wizard.tsx      # Multi-step creation form
│   │   │   ├── token-card.tsx         # Token summary card
│   │   │   ├── token-stats.tsx        # Supply/holder stats
│   │   │   └── metadata-editor.tsx    # Key-value metadata form
│   │   ├── holders/
│   │   │   ├── cap-table.tsx          # Holder table with actions
│   │   │   └── onboard-form.tsx       # Investor onboarding form
│   │   ├── transfer/
│   │   │   └── transfer-form.tsx      # Token transfer UI
│   │   ├── compliance/
│   │   │   ├── compliance-panel.tsx   # Freeze/thaw/pause controls
│   │   │   └── status-badge.tsx       # KYC/freeze status indicator
│   │   └── ui/                        # Shared UI components (shadcn)
│   │
│   ├── lib/
│   │   ├── solana/
│   │   │   ├── token-service.ts       # Core Token-2022 operations
│   │   │   ├── account-service.ts     # ATA management, balance queries
│   │   │   ├── compliance-service.ts  # Freeze/thaw/pause/delegate ops
│   │   │   ├── metadata-service.ts    # On-chain metadata operations
│   │   │   ├── history-service.ts     # Transaction history queries
│   │   │   └── constants.ts           # Program IDs, network config
│   │   └── utils/
│   │       ├── format.ts              # Address truncation, number formatting
│   │       └── validation.ts          # Form validation helpers
│   │
│   ├── hooks/
│   │   ├── use-token-create.ts        # Token creation mutation hook
│   │   ├── use-token-info.ts          # Token metadata query hook
│   │   ├── use-holders.ts             # Cap table query hook
│   │   ├── use-transfer.ts            # Transfer mutation hook
│   │   └── use-compliance.ts          # Compliance action hooks
│   │
│   └── types/
│       └── token.ts                   # TypeScript types for RWA tokens
│
├── programs/                          # Phase 1B: Anchor programs
│   └── transfer-hook/
│       ├── src/lib.rs                 # Transfer Hook compliance logic
│       └── Anchor.toml
│
├── public/
│   └── token-templates/               # Pre-built asset type templates
│       ├── treasury.json
│       ├── real-estate.json
│       └── equity.json
│
├── package.json
├── tsconfig.json
└── next.config.ts
```

### Monorepo Decision

**Option A: Separate Next.js app** (Recommended for POC)
- Clean separation from trading view codebase
- Independent deployment
- Can be merged later if needed
- Faster iteration without risk to existing platform

**Option B: Route group in existing app** (`ciphex-predictions/src/app/(rwa)/...`)
- Shared dependencies and components
- Unified deployment
- Risk of coupling with existing trading view features

**Recommendation:** Option A — separate app in a new directory within the Cipherion workspace. Shared Tailwind/shadcn config can be copied. This keeps the POC isolated and demo-ready without affecting the live trading view platform.

---

## 11. Risk & Trade-offs

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Token-2022 SDK gaps or bugs | Medium | High | Pin SDK versions; test all operations on Devnet early; have SPL Token (v1) fallback for basic ops |
| Devnet instability / resets | Low | Medium | Document re-creation steps; consider local validator (`solana-test-validator`) for demo reliability |
| Transfer Hook complexity | High | Medium | Phase 1A uses simpler DefaultAccountState pattern; Transfer Hook is Phase 1B |
| Wallet adapter compatibility | Low | Low | Test with Phantom + Solflare; both support Token-2022 |
| `getProgramAccounts` performance for cap table | Medium | Medium | Use Helius or Triton DAS API if needed; fine for demo-scale holder counts |

### Trade-offs Accepted

1. **Simulated KYC over real KYC** — For demo purposes, "KYC approval" is just the issuer clicking a button to thaw an account. Real KYC integration (Civic Pass, Synaps) is Phase 2.

2. **No backend server** — All operations run client-side. This is simpler but means no server-side validation, no webhook processing, no background jobs. Acceptable for a demo.

3. **Devnet only** — Tokens have no real value. This is intentional — the demo shows the mechanics, not the economics. Mainnet deployment requires legal review.

4. **No Transfer Hook in base MVP** — The DefaultAccountState=Frozen pattern gives us KYC gating without writing any Rust. Transfer Hook (for whitelist enforcement, investor caps, jurisdiction checks) adds significant complexity (custom Anchor program) and is deferred.

5. **On-chain metadata only** — We store core metadata on-chain via Token-2022's metadata extension. Rich documents (prospectus PDFs, legal filings) are referenced by URI but not stored or validated on-chain.

---

## 12. Phase 2+ Roadmap

```
Phase 1A (MVP)          Phase 1B                Phase 2               Phase 3
─────────────────────   ──────────────────      ──────────────────    ──────────────────
Token creation wizard   Transfer Hook program   Real KYC (Civic)     Secondary marketplace
Mint & distribute       Whitelist registry      Fiat on-ramp          Multi-chain (EVM bridge)
KYC sim (freeze/thaw)   Investor caps           Mainnet deployment    Automated distributions
Cap table view          Jurisdiction checks     Audit reporting       Confidential transfers
P2P transfer                                    Portfolio analytics   Mobile app
Compliance actions                              Batch operations
Tx history
Wallet integration
```

---

## 13. Open Questions (Resolved)

| # | Question | Resolution |
|---|----------|-----------|
| 1 | Standalone vs. integrated? | **Standalone.** Separate Next.js app at `/cipherion-tokenize/`, independently deployable. |
| 2 | Demo wallet strategy? | **Real wallets.** Phantom/Solflare on Devnet with airdrop button for test SOL. |
| 3 | Transfer Hook scope? | **Deferred to Phase 1B.** Phase 1A uses DefaultAccountState=Frozen for KYC gating. |
| 4 | Asset templates? | **Built.** 6 templates: Treasury, Real Estate, Equity, Commodity, Debt, Fund. |
| 5 | Branding? | **CipheX Atlas.** CipheX sub-brand. |
| 6 | Network? | **Devnet only for MVP.** Mainnet is a config change. Local validator not needed. |
| 7 | Existing code reuse? | **Design system copied from ciphex-predictions.** Same dark theme, Geist fonts, shadcn/ui. |

---

## Appendix A: Competitor Feature Matrix

| Feature | Ondo | Securitize | Polymath | RealT | Centrifuge | **Our MVP** |
|---------|------|-----------|----------|-------|------------|-------------|
| Token creation | - | Yes | Yes (wizard) | - | Yes | **Yes (wizard)** |
| KYC/AML | Institutional | SEC-registered | On-chain | Third-party | Off-chain | **Simulated** |
| Transfer restrictions | Yes | Yes | Smart contract | Yes | Yes | **Yes (freeze)** |
| Pause/emergency | - | Yes | Yes | - | Yes | **Yes** |
| Cap table | - | Yes | Yes | - | Yes | **Yes** |
| P2P transfer | Limited | Regulated | Yes | Yes | No | **Yes** |
| Fiat on-ramp | Yes | Yes | Yes (Stripe) | Yes | No | **Phase 2** |
| Yield/distributions | Yes | Yes | Yes | Yes (rent) | Yes (tranche) | **Phase 2** |
| Chain | Multi | Ethereum | Polymesh | Eth+Gnosis | Multi | **Solana** |

## Appendix B: Solana Devnet Resources

- **Faucet:** https://faucet.solana.com (up to 2 SOL/request)
- **Explorer:** https://explorer.solana.com/?cluster=devnet
- **RPC Endpoint:** `https://api.devnet.solana.com` (rate-limited; use Helius/QuickNode for production)
- **Local validator:** `solana-test-validator` (offline testing)
- **Token-2022 Docs:** https://solana.com/docs/tokens/extensions
- **Wallet Adapter Docs:** https://github.com/anza-xyz/wallet-adapter
