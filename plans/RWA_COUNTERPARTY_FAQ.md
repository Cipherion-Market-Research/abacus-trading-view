# CipheX Atlas — Counterparty FAQ

**Purpose:** Reference document for content writers, sales, and stakeholder Q&A sessions. Written in plain language with technical depth where needed.

**Last Updated:** 2026-04-18

> Content here is evergreen business/product Q&A. For current implementation state see `ATLAS_HANDOFF.md`. A public **split-persona FAQ UI** with this content is live at `/faq` in the app — use this document as the source of truth when adding/editing entries there.
>
> **Updates since 2026-04-17:**
> - `/explorer` is now a public Atlas catalog (registered mints, searchable) with asset-type visual identity per token
> - Live yield-accrual ticker on every detail page that has a `coupon_rate` in metadata — replicates the Franklin BENJI 2025 differentiator
> - Distributions tab on every token dashboard — pro-rata (yield/coupon) or equal-share (initial allocation), executed as on-chain mints to each holder, matching the BUIDL mechanic
> - New section 12 below covers the distribution and yield model in detail

---

## Table of Contents

1. [What is CipheX Atlas?](#1-what-is-ciphex-atlas)
2. [Why Solana? Why Token-2022?](#2-why-solana-why-token-2022)
3. [Token Creation & Configuration](#3-token-creation--configuration)
4. [Compliance & Regulatory](#4-compliance--regulatory)
5. [Investor Experience](#5-investor-experience)
6. [Secondary Markets & Liquidity](#6-secondary-markets--liquidity)
7. [Custody & Wallets](#7-custody--wallets)
8. [Costs & Economics](#8-costs--economics)
9. [Security & Risk](#9-security--risk)
10. [Technical Architecture](#10-technical-architecture)
11. [Competitive Positioning](#11-competitive-positioning)
12. [Distributions & Yield Mechanics](#12-distributions--yield-mechanics)

---

## 1. What is CipheX Atlas?

**Q: What does CipheX Atlas do?**

Atlas is a platform for creating, managing, and distributing real-world asset (RWA) tokens on Solana. An asset manager or fund administrator uses Atlas to tokenize an asset (treasury fund, real estate, private equity, commodity), onboard investors with KYC approval, distribute tokens, and enforce compliance rules — all on-chain with full audit trail.

**Q: Who is the target user?**

Two personas:
- **Issuers** — Asset managers, fund administrators, family offices, SPVs who want to tokenize an asset and manage the investor lifecycle.
- **Investors** — Accredited or institutional investors who hold, transfer, and eventually redeem tokenized assets.

**Q: Is this live?**

The platform is operational on Solana Devnet (test network) for demonstrations. Moving to Solana Mainnet requires one configuration change. The token program (Token-2022) is the same on both networks.

---

## 2. Why Solana? Why Token-2022?

**Q: Why Solana instead of Ethereum?**

Three reasons:
1. **Cost.** A token transfer on Solana costs ~$0.003. On Ethereum L1 that's $0.50–$50. Even on Ethereum L2s (Base, Polygon) it's $0.01–$0.10. At scale (10,000 investors, 100K annual transfers), Solana's on-chain cost is under $2,500/year.
2. **Native compliance.** Solana's Token-2022 program has compliance features built into the protocol — freeze, pause, transfer hooks, forced redemption. On Ethereum, you deploy 6 smart contracts (ERC-3643) to achieve the same thing. Protocol-level enforcement is stronger than contract-level enforcement.
3. **Institutional adoption.** Franklin Templeton ($594M FOBXX), BlackRock ($255M BUIDL), and Ondo ($176M USDY) all operate tokenized funds on Solana as of 2026. SOL was recognized as a digital commodity by the SEC and CFTC in March 2026.

**Q: What is Token-2022?**

Token-2022 is Solana's current-generation token program. It's the protocol-level software that creates and manages all tokens on Solana. The "2022" refers to when it was designed, not a version number or environment. It runs on both Devnet and Mainnet with the same program ID.

Token-2022 includes 20+ configurable extensions that are set when a token is created. The extensions relevant to RWA:
- **DefaultAccountState (Frozen)** — new accounts start frozen until the issuer approves them (KYC gate)
- **Transfer Fees** — automatic percentage-based fee deducted on every transfer
- **Permanent Delegate** — designated authority can transfer or burn tokens from any account (regulatory seizure)
- **Pausable** — halt all activity (emergency, NAV recalculation)
- **Transfer Hook** — custom compliance logic executed on every transfer (Phase 2)
- **Metadata** — token name, symbol, and asset details stored on-chain

**Q: Is Token-2022 just for testing? Does it change on mainnet?**

No. Token-2022 is the production token program. The same program ID runs on Devnet, Testnet, and Mainnet. Franklin Templeton's $594M tokenized treasury fund runs on Token-2022 on mainnet. There is no separate "mainnet version" — everything we demonstrate on Devnet works identically on Mainnet with one configuration change (the RPC endpoint URL).

**Q: What about Hedera / Ethereum / Polygon / Avalanche?**

We evaluated all major chains. Solana won on cost, native compliance features, and institutional adoption momentum. For details, see the full chain comparison in our technical proposal (RWA_TOKEN_PLATFORM_PROPOSAL.md, Section 2).

---

## 3. Token Creation & Configuration

**Q: What parameters can be configured when creating a token?**

| Category | Parameters |
|----------|-----------|
| **Identity** | Name, symbol, decimals, description, image, asset type |
| **Compliance** | KYC gating (on/off), transfer fees (basis points + max), pausable, permanent delegate (forced redemption), memo required |
| **Supply** | Initial supply (can be 0, mint later), no hard cap on total supply |
| **Authorities** | Mint authority, freeze authority, update authority — all assigned to the creator's wallet |
| **Metadata** | Jurisdiction, regulatory framework, NAV, maturity date, coupon rate, custodian, ISIN, plus arbitrary key-value pairs |
| **Asset templates** | Pre-built configurations for treasury, real estate, equity, commodity, debt, fund |

**Q: Can these be changed after creation?**

- **Extensions (compliance features):** No. These are set at creation and immutable. This is by design — investors need certainty that the rules won't change under them.
- **Supply:** Yes. The mint authority can mint new tokens or burn existing ones at any time.
- **Metadata:** Yes. The update authority can modify on-chain metadata (NAV updates, document links, etc.).
- **Authorities:** Yes. Authorities can be transferred to another wallet or revoked entirely.

**Q: What asset types are supported?**

Any real-world asset can be tokenized. The platform provides templates for common types (treasury bills, real estate, private equity, commodities, debt instruments, investment funds) but the token is fundamentally a configurable digital representation — the legal structure wrapping it determines what it represents.

---

## 4. Compliance & Regulatory

**Q: Can the issuer freeze an investor's account?**

Yes. The freeze authority (typically the issuer's wallet) can freeze any individual token account at any time. A frozen account cannot send or receive tokens. This is used for:
- Suspicious activity investigation
- Regulatory hold / court order compliance
- KYC expiry (re-verification required)

The issuer can also unfreeze (thaw) the account to restore normal operation.

**Q: Can the issuer pause all activity?**

Yes. The pausable extension allows the issuer to halt all minting, burning, and transfers across the entire token. Use cases:
- NAV recalculation periods (fund tokens)
- Regulatory emergency
- Corporate action processing (dividends, splits)

**Q: Can the issuer seize or claw back tokens?**

Yes, if the Permanent Delegate extension is enabled. The designated authority can transfer or burn tokens from any account without the holder's consent. Use cases:
- Court-ordered asset seizure
- Sanctions compliance
- Forced redemption at maturity
- Estate settlement

Wallets (Phantom, Solflare) display a warning to holders when a token has this extension enabled.

**Q: Is KYC real or simulated?**

In the current MVP, KYC is simulated — the issuer manually approves (thaws) investor accounts. In production, this would integrate with a KYC provider (Civic Pass, Synaps, Persona) that issues on-chain credentials. The approval mechanism is the same either way — the account transitions from frozen to active.

**Q: Are these compliance features standard in the industry?**

Yes. Every major RWA platform implements freeze, pause, KYC gating, and forced transfer capabilities. These are not optional features — they are regulatory requirements:

- **SEC (US):** Reg D, Reg S, Reg A+ all require transfer restrictions and issuer control
- **MiCA (EU):** Asset-referenced tokens require governance controls and smart contract enforceability
- **MAS (Singapore):** Project Guardian demonstrated tokens with on-chain compliance
- **VARA (Dubai):** Requires freeze/seize capabilities directed by authorities

Platforms without these controls cannot be used for regulated securities offerings.

**Q: Which regulatory frameworks are supported?**

The platform stores the regulatory framework as on-chain metadata (Reg D, Reg S, Reg A+, MiFID II). The actual compliance enforcement (who can hold, transfer limits, lock-up periods) is implemented through the freeze/thaw model in Phase 1 and through Transfer Hook logic in Phase 2.

---

## 5. Investor Experience

**Q: How does an investor receive tokens?**

1. The issuer onboards the investor by entering their Solana wallet address
2. Atlas creates a token account for the investor and approves it (thaws)
3. The issuer distributes tokens to the investor's approved account
4. The investor sees the tokens in their wallet (Phantom, Solflare) and on the Atlas portfolio page

**Q: How does an investor transfer tokens?**

An investor can transfer tokens to any other approved (onboarded + thawed) wallet. They go to the portfolio page, select the token, enter the recipient address and amount, and confirm. The transfer is executed on-chain in ~400ms.

Transfers to unapproved wallets fail at the protocol level — the Solana runtime rejects the transaction before it's processed. This isn't application logic that can be bypassed; it's enforced by the blockchain itself.

**Q: How does an investor sell or exit their position?**

Three paths, in order of availability:

| Exit Path | Status | How It Works |
|-----------|--------|-------------|
| **Private OTC transfer** | Available now | Investor finds a buyer, both must be onboarded. Transfer tokens directly between approved wallets. Price negotiated off-chain. |
| **Issuer redemption** | Phase 2 | Investor requests redemption. Issuer burns tokens and pays out NAV value (like mutual fund redemption). May have lock-up periods or redemption windows. |
| **Regulated secondary market** | Requires ATS integration | Token is listed on a regulated exchange (Securitize Markets, tZERO, Archax). Only KYC'd participants can trade. Order book matching. |
| **Compliant DeFi pool** | Phase 2+ (Transfer Hook) | A permissioned liquidity pool on a Solana DEX (Raydium, Orca). The issuer whitelists the pool account. A Transfer Hook validates that both sides of every swap are approved investors. |

**Q: Can these tokens trade on Jupiter, Raydium, or other DEXes?**

Not permissionlessly. The token uses `DefaultAccountState=Frozen`, which means any DEX pool account would start frozen and need explicit issuer approval. This is by design — RWA tokens are regulated securities and cannot be listed on permissionless exchanges.

However, with a Transfer Hook (Phase 2), the issuer can whitelist specific DEX pool accounts and enable compliant trading. The hook validates that both the buyer and seller are approved on every swap. This is Solana's unique advantage — compliant DeFi without needing a separate chain.

**Q: Will this end up on pumpfun or meme coin exchanges?**

No. The protocol physically prevents it. Every transfer requires the recipient to have an approved (unfrozen) token account, which only the issuer can create. A permissionless exchange cannot create these accounts. The compliance controls exist specifically to prevent unregulated secondary trading.

For counterparties concerned about token dumping or unregulated exposure: the same infrastructure that enables regulated exchange listing also prevents unregulated listing. These are two sides of the same compliance coin.

---

## 6. Secondary Markets & Liquidity

**Q: How do token holders get liquidity?**

Near-term: private transfers between approved wallets (OTC) and issuer redemption. Medium-term: compliant secondary markets. Long-term: compliant DeFi integration.

The liquidity roadmap:

| Phase | Mechanism | Description |
|-------|-----------|------------|
| **Now** | Private transfer | Peer-to-peer between approved wallets. Off-chain price negotiation. |
| **Phase 2** | Redemption | Issuer buys back tokens at NAV. Burn-and-settle workflow. |
| **Phase 2** | OTC desk | Request-for-quote system. Investor posts intent, issuer or market maker responds. |
| **Phase 2+** | ATS listing | Integration with Securitize Markets, tZERO, or similar regulated venue. |
| **Phase 2+** | Compliant AMM | Permissioned liquidity pool on Solana DEX. Transfer Hook enforces compliance on every swap. |

**Q: Can RWA tokens be used as collateral for loans?**

Yes, conceptually. A lending protocol that supports Token-2022 could accept RWA tokens as collateral. Flux Finance (Ondo ecosystem) already does this for OUSG tokens. The key challenge is liquidation — if a borrower defaults, the protocol can only sell the collateral to approved investors, requiring either pre-approved liquidators or an issuer backstop.

**Q: Can RWA tokens be staked for yield?**

Not in the traditional DeFi staking sense. But the Token-2022 interest-bearing extension can display accrued yield in wallets. Real yield distribution (dividends, rent, interest) is a Phase 2 feature — the issuer calculates pro-rata distributions and sends payments (in USDC or the RWA token itself) to all holders.

**Q: What about a fund-of-funds or index product?**

Possible but Phase 3+. A basket token representing multiple underlying RWA tokens requires NAV calculation, rebalancing logic, and compliance inheritance from each underlying. The infrastructure is the same (Token-2022 with Transfer Hooks) but the business logic is significantly more complex.

---

## 7. Custody & Wallets

**Q: Which wallets can hold these tokens?**

| Wallet | Support | Best For |
|--------|---------|----------|
| **Phantom** | Full Token-2022 support | Retail/accredited investors. Shows fees, frozen status, metadata, PermanentDelegate warning. |
| **Solflare** | Full Token-2022 support | Security-conscious users. Shield feature previews transaction effects. |
| **Backpack** | Supported | Multi-chain users. |
| **Ledger** (via Phantom/Solflare) | Full | Hardware wallet security. Requires blind signing enabled. |
| **Fireblocks** | Full (8 extensions confirmed) | Institutional custody. MPC-based security with policy engine. |
| **Squads Multisig** | Compatible | DAO/treasury management. $10B+ secured on Solana. |

**Q: What about Trust Wallet?**

Token-2022 support is unconfirmed as of April 2026. We recommend Phantom or Solflare.

**Q: Can I send tokens to a Coinbase/Binance deposit address?**

No. Centralized exchanges have not broadly announced Token-2022 deposit support. Sending tokens to an exchange address may result in lost tokens. This is documented in investor onboarding materials.

**Q: Is self-custody required, or can a fund administrator hold tokens on behalf of investors?**

Both models work:
- **Self-custody:** Each investor has their own Phantom/Solflare wallet. Standard for accredited individual investors.
- **Custodial:** A custodian (Fireblocks, Anchorage) holds tokens on behalf of investors. The custodian's wallet is the on-chain account; investor ownership is tracked off-chain. Standard for institutional allocators.
- **Multisig:** Squads Protocol for treasury management with multi-party approval on critical operations.

---

## 8. Costs & Economics

**Q: What does it cost to launch a token?**

Under $1 in on-chain costs. The mint account with full compliance extensions costs ~$0.63 in rent deposit (refundable if the token is ever closed). If a custom compliance program (Transfer Hook) is deployed, that's an additional $45–$134 one-time.

**Q: What does it cost per investor?**

$0.19 to onboard (create their token account). Every transfer after that is $0.003. Compare to traditional fund administration: $50–$150 per investor for onboarding paperwork.

**Q: What does it cost at scale?**

| Scale | On-Chain Cost | RPC Infrastructure | Total Year 1 |
|-------|-------------|-------------------|--------------|
| 10 investors (demo) | ~$3 | Free | ~$3 |
| 100 investors (pilot) | ~$110 | $49/mo | ~$700 |
| 1,000 investors | ~$450 | $49/mo | ~$1,035 |
| 10,000 investors | ~$2,440 | $499/mo | ~$8,430 |

Compare: traditional transfer agent and registrar fees for 10,000 investors exceed $500,000/year.

**Q: What does the issuer pay vs. the investor?**

In the current model, the issuer pays all on-chain costs (account creation, minting, compliance actions). Investors pay only the ~$0.003 transfer fee when they move tokens. Transfer fees (if enabled) are deducted from the recipient's received amount, not the sender's balance.

**Q: Are costs fixed or do they fluctuate?**

On-chain costs are denominated in SOL and fluctuate with SOL's price. At $89/SOL, a transfer is $0.003. If SOL doubles, transfers cost $0.006 — still negligible. Solana's base fee (5,000 lamports) is protocol-defined and doesn't change with congestion. Priority fees add $0.001–$0.005 during busy periods.

---

## 9. Security & Risk

**Q: What happens if the issuer loses access to their wallet?**

The issuer should use a multisig (Squads Protocol) or institutional custody (Fireblocks) for authority wallets. If a single-key wallet is lost, the mint authority, freeze authority, and update authority are permanently inaccessible — no one can mint new tokens, freeze/thaw accounts, or update metadata. Existing tokens and transfers continue to function.

**Q: Can someone hack the token or change the compliance rules?**

The compliance extensions (DefaultAccountState, TransferFees, PermanentDelegate, etc.) are immutable after creation. No one — not even the issuer — can add, remove, or modify them. This is enforced by the Solana runtime, not by application code.

The mint authority can mint new tokens and the freeze authority can freeze/thaw accounts. These authorities should be protected with multisig or institutional custody.

**Q: What if Solana goes down?**

Solana has experienced outages historically (most recently in Feb 2023). During an outage, no transactions process — tokens can't be transferred, minted, or frozen. When the network recovers, all state is preserved and operations resume. For time-sensitive operations (redemptions, distributions), the issuer should have contingency procedures.

Solana's uptime has improved significantly since 2023, and the Alpenglow upgrade (expected late 2026) aims to further stabilize consensus.

**Q: Has Token-2022 been audited?**

Yes. Token-2022 has been audited by multiple firms. Neodyme published a comprehensive security analysis identifying extension interaction pitfalls. The program is open source and has been in production since 2023 with billions in value secured.

---

## 10. Technical Architecture

**Q: Does Atlas require a backend server?**

Not for the MVP. All transactions are constructed in the browser and signed by the user's wallet. On-chain state is read directly from Solana's RPC. This means no server-side custody of private keys and no centralized point of failure for basic operations.

Production features (automated distributions, webhook listeners, KYC provider integration, audit log persistence) will require a lightweight backend (Next.js API routes or a separate service).

**Q: Is the code open source?**

The platform code is in a private repository. The underlying Solana Token-2022 program is open source and verifiable on-chain. Token-2022's program ID and code can be independently verified by any party.

**Q: Can Atlas be white-labeled?**

Yes. The platform is a Next.js application with a configurable design system. Branding, colors, logos, and domain can be customized. API access for programmatic token management is on the Phase 2 roadmap.

**Q: What happens when Solana upgrades?**

Solana upgrades are backward-compatible. Token-2022 tokens created today will continue to function through future Solana upgrades. The program ID is permanent and the instruction set is stable.

---

## 11. Competitive Positioning

**Q: How does Atlas compare to Securitize?**

Securitize is the market leader with SEC-registered transfer agent and broker-dealer licenses, plus an ATS for secondary trading. Atlas is a platform-layer tool — it handles token creation, compliance, and distribution on Solana. Securitize operates on Ethereum with a full regulatory stack. Atlas is not trying to replace Securitize; it's building the Solana-native equivalent of the tokenization layer, at a fraction of the cost.

**Q: How does Atlas compare to Polymath/Polymesh?**

Polymesh is a purpose-built L1 blockchain for regulated securities. Their argument is that general-purpose chains can't properly enforce compliance. Token-2022's extensions (Transfer Hooks, DefaultAccountState, PermanentDelegate) counter that argument — Solana's runtime enforces compliance at the protocol level without needing a separate chain. Atlas on Solana has access to the broader Solana ecosystem (wallets, DEXes, DeFi) that Polymesh lacks.

**Q: What's the Solana RWA landscape?**

Solana's RWA market reached $2B+ with 182,000+ holders in March 2026. Key players:
- **Franklin Templeton** — $594M FOBXX (tokenized US Treasuries)
- **BlackRock** — $255M BUIDL Fund
- **Ondo Finance** — $176M USD Yield Product
- **Credix** — Credit marketplace (LatAm lending)
- **Parcl** — Tokenized real estate price exposure

There is no Securitize-equivalent self-service tokenization platform on Solana today. This is the gap Atlas fills.

**Q: Why not just use an EVM chain with ERC-3643?**

ERC-3643 requires deploying 6 smart contracts (Token, Identity Registry, Identity Registry Storage, Compliance Contract, Claim Topics Registry, Trusted Issuers Registry). Any bug in these contracts is a security risk. Token-2022's compliance features are built into the Solana runtime — audited once, shared by everyone, enforced at the protocol level. Plus: 100–1000x cheaper per transaction.

---

---

## 12. Distributions & Yield Mechanics

**Q: How does Atlas pay yield to holders?**

Atlas uses a **mint-to-holder** model that matches what BlackRock BUIDL and Franklin BENJI do today: instead of transferring existing tokens from a treasury, the issuer mints *new* tokens directly to each holder's wallet, pro-rata to their share of circulating supply. The holder sees their balance grow on the next block; no claim step, no withdrawal flow.

This is distinct from accumulating-NAV models (Ondo OUSG-style) where the per-token value grows but the supply stays constant. We can support that pattern in Phase 2 if an issuer specifically wants it; the mint-to-holder pattern is the default because it's the most common and the most visceral for holders to see.

**Q: How does Atlas distribute the yield in practice?**

The issuer opens the **Distributions** tab on a token's dashboard, picks a distribution method, enters a total amount and a memo, and previews per-holder allocations before confirming. On submit, Atlas executes one on-chain mint per recipient, sequentially, with progress shown in the UI. Each mint instruction carries the memo for audit purposes. Distribution history is persisted per token so the issuer can review past payouts.

Two distribution methods are supported:

| Method | Eligibility | Use case |
|---|---|---|
| **Pro-rata** | Holder must have a non-zero balance; treasury and frozen accounts excluded | Ongoing coupon, dividend, or interest payouts. Each holder receives `(holderBalance / circulatingSupply) × totalAmount` |
| **Equal share** | Any non-frozen, non-treasury holder regardless of current balance | Initial allocations and bootstrap distributions where holders haven't received anything yet. `totalAmount / eligibleCount` per holder |

**Q: Is the yield accrual visible in real time?**

Yes. Every token detail page (issuer dashboard and public Explorer view) renders a **live yield ticker** at the top when the token's metadata includes a `coupon_rate` or `annual_yield` field. The ticker shows the APY plus the amount accrued today across the entire supply, updating every second client-side. This replicates the per-second accrual visualization Franklin Templeton shipped on BENJI in 2025 — a feature institutional buyers consistently single out as a "lean forward" moment in evaluation demos.

The ticker is purely a visualization computed from `supply × rate / (365 × 86400)`. It does not itself trigger any on-chain action. The actual payout happens when the issuer runs a distribution.

**Q: How are distributions paid — in the same token or in cash?**

Today, distributions are paid in *the same RWA token* (mint-to-holder). This matches the BUIDL pattern and is the simplest mechanic to demo end-to-end on devnet. In Phase 2, we plan to add a USDC payout option using a routing program: the issuer specifies a yield amount in USDC, Atlas burns equivalent value from issuer's USDC balance and mints proof tokens to holders, or executes pro-rata USDC transfers — depending on the issuer's preferred custody model.

**Q: How are distribution events recorded for audit?**

Each distribution generates one on-chain mint instruction per recipient, with the memo embedded. The Solana transaction signatures are the canonical proof; they're queryable from any RPC and from Solana Explorer. The Distributions tab persists a structured record per distribution (timestamp, total amount, memo, per-recipient amount + signature + status) for fast retrieval without re-querying the chain. Production deployment would mirror this into a Postgres `distribution_log` table for SOC-2 audit trails and regulator export.

**Q: What happens if a recipient's wallet is frozen mid-distribution?**

Frozen accounts are filtered out of the eligible set before allocation is computed — they receive nothing. The issuer can thaw and run a follow-up distribution to that holder if they want to make them whole.

**Q: What does a coupon distribution actually cost on-chain?**

Per recipient, ~0.000033 SOL (~$0.003). For a 1,000-holder fund running monthly coupons, that's ~$3/month in on-chain costs — roughly four orders of magnitude cheaper than a traditional transfer-agent fee structure for the same operation.

**Q: Can investors trigger their own redemption?**

Phase 2. Today the demo focuses on issuer-initiated payouts. The plan for atomic redemption is: holder selects "Redeem N tokens", Atlas burns those tokens via Permanent Delegate and pays the equivalent USDC from a treasury contract in the same atomic bundle, returning a downloadable signed receipt for the holder's records. This is the second-most-requested feature in current institutional walkthroughs, behind real-time yield visibility.

---

## Glossary

| Term | Definition |
|------|-----------|
| **ATA** | Associated Token Account — a wallet's account for holding a specific token |
| **DefaultAccountState** | Token-2022 extension that sets the initial state (frozen/active) for all new token accounts |
| **Freeze/Thaw** | Freeze = block account from sending/receiving. Thaw = unblock. Used for KYC approval. |
| **KYC Gating** | Requiring identity verification before an investor can hold tokens. Implemented via frozen default state. |
| **Mint Authority** | The wallet that can create new token supply |
| **Permanent Delegate** | An authority that can transfer or burn tokens from any account (regulatory compliance) |
| **RWA** | Real World Assets — physical or traditional financial assets represented as blockchain tokens |
| **Token-2022** | Solana's token program with configurable extensions for compliance, fees, metadata, etc. |
| **Transfer Hook** | A custom on-chain program executed on every token transfer for compliance validation |
| **Whitelist Model** | Only pre-approved wallets can hold and transfer a token |
| **Pro-rata distribution** | Allocation method where each holder receives a share proportional to their current balance. Used for ongoing yield/coupon payouts. |
| **Equal-share distribution** | Allocation method where the total is split evenly across all eligible holders regardless of balance. Used for initial allocations. |
| **Mint-to-holder** | Distribution mechanic where new tokens are minted directly to holder wallets rather than transferred from a treasury. Same model as BlackRock BUIDL. |
| **Yield ticker** | Live UI element showing per-second yield accrual on a token, computed from on-chain `coupon_rate` metadata. |
