# CipheX Atlas — Research Addendum

**Date:** 2026-04-17
**Status:** Complete — Technical reference for counterparty Q&A and internal decision-making

---

## Table of Contents

1. [Solana Networks: Devnet vs Testnet vs Mainnet](#1-solana-networks)
2. [2026 Friction Points & Hurdles](#2-2026-friction-points)
3. [Mainnet Porting & Cost Forecast](#3-mainnet-cost-forecast)
4. [Compliance Feature Landscape: Standard vs Controversial](#4-compliance-feature-landscape)
5. [Competitive Landscape (2026)](#5-competitive-landscape-2026)
6. [Wallet Compatibility Matrix](#6-wallet-compatibility)
7. [UI/UX Design: Industry Expectations](#7-uiux-design)
8. [Secondary Vehicles: Staking, Liquidity, DeFi Composability](#8-secondary-vehicles)
9. [Features Beyond HTS Demo: What Solana Token-2022 Unlocks](#9-features-beyond-hts)

---

## 1. Solana Networks

### Three Networks, Three Purposes

| | **Devnet** | **Testnet** | **Mainnet-Beta** |
|---|---|---|---|
| **Purpose** | Developer sandbox — build and test apps | Validator stress-testing of upcoming Solana releases | Production network with real SOL |
| **SOL** | Free (via faucet: up to 5 SOL, 2x/hour) | Free (via faucet) | Real value (~$89.20 as of April 2026) |
| **Token-2022** | Fully deployed, same program ID | Fully deployed, same program ID | Fully deployed, same program ID |
| **Stability** | Generally stable; mirrors mainnet behavior | Less stable — runs newer/experimental software, may reset | Production-grade |
| **Resets** | No fixed schedule; can reset without warning | Periodic resets for upgrade testing | Never resets |
| **Who uses it** | App developers, dApp builders | Solana core devs, validator operators | End users, production apps |
| **RPC Endpoint** | `api.devnet.solana.com` | `api.testnet.solana.com` | `api.mainnet-beta.solana.com` |
| **Rate Limits** | 100 req/10s per IP | 100 req/10s per IP | 100 req/10s per IP (public; not for production) |

**Key takeaway for counterparties:** Devnet is our development and demo environment — it behaves identically to mainnet but uses free test SOL. The token program (Token-2022) has the **exact same program ID** across all three networks, meaning zero code changes to the core token logic when moving to production.

### What Persists and What Doesn't

- **Devnet data is ephemeral.** Deployed programs, mints, token accounts — all can vanish on reset. This is why we script everything for repeatable deployment.
- **Mainnet data is permanent.** Once deployed, tokens, accounts, and transaction history persist indefinitely.
- **Testnet is irrelevant for us.** It's for Solana protocol developers, not application builders.

### What "Mainnet-Beta" Means

Still officially called "Mainnet-Beta" as of April 2026. The upcoming Alpenglow consensus upgrade (approved Sept 2025, mainnet expected late 2026) may eventually drop the "Beta" label. The "Beta" designation is historical — the network has been fully production-grade since 2021 and secures billions in real value.

---

## 2. 2026 Friction Points

### Token-2022 Adoption Gaps

**The single biggest friction point: not everything in the Solana ecosystem supports Token-2022 yet.**

| Integration Point | Token-2022 Support | Notes |
|---|---|---|
| **Phantom wallet** | Full | Displays fees, frozen status, metadata, warnings |
| **Solflare wallet** | Full | Enterprise-grade; Shield previews tx effects |
| **Backpack wallet** | Supported | Less documented but functional |
| **Trust Wallet** | **Unconfirmed** | Do not recommend until independently verified |
| **CEX deposits** | **Not supported** | Do NOT send Token-2022 tokens to exchange addresses |
| **Jupiter (DEX aggregator)** | Supported (via routing) | Routes through compatible venues |
| **Raydium (DEX)** | Full in CPMM pools | Transfer fee extension supported |
| **Orca (DEX)** | Partial | Via Jupiter routing; direct pools may have issues |
| **Fireblocks (custody)** | Full (8 extensions) | Best institutional custody option |
| **Anchorage, BitGo** | **Unconfirmed for Token-2022** | SPL support exists; extensions not documented |

**Implication for RWA tokens specifically:** Because our tokens use DefaultAccountState=Frozen, they **cannot be freely listed on DEXes** — the DEX pool accounts would start frozen and need issuer approval. This is intentional compliance behavior, not a bug. But it means secondary market liquidity requires explicit issuer cooperation.

### Priority Fees & Congestion

Solana uses **local fee markets** — you compete only with transactions touching the same writable accounts. Current priority fee levels:

| Priority | Cost per Typical Tx |
|---|---|
| Low | ~$0.001 |
| Medium | ~$0.003 |
| High | ~$0.006 |

During major market events, fees for hot accounts can spike. The **Alpenglow upgrade** (mainnet late 2026) aims to reduce this by freeing ~75% of block space currently used for validator votes.

**For RWA tokens:** Our transactions touch unique mint/token accounts with low contention. Priority fees will be negligible. This is not a DeFi memecoin trading scenario.

### Transfer Hook Complexity

Transfer Hooks are the most powerful compliance tool but carry real engineering friction:

- **CPI depth limit of 4:** A Transfer Hook consumes 2+ CPI levels. Deep composability chains can hit `CallDepthExceeded`.
- **Integration burden:** Every protocol interacting with your token must know to pass the Transfer Hook's extra accounts. This breaks "drop-in" composability.
- **No re-entrancy:** Cannot call Token-2022 to move tokens while it's waiting for your hook to finish.
- **Incompatible with Confidential Transfers** (encrypted amounts can't be read by hooks).

**Our mitigation:** Phase 1A uses the simpler DefaultAccountState=Frozen pattern for KYC gating. Transfer Hook is Phase 1B. Both work; the tradeoff is flexibility vs. complexity.

### Extension Immutability

**Extensions cannot be added after mint creation.** You must decide upfront which extensions to enable. If you create a token without TransferFeeConfig, you can never add fees later. This means the creation wizard must help issuers understand what they're committing to — it's a one-shot decision.

### Known Security Pitfalls (From Neodyme Audit)

| Extension | Pitfall |
|---|---|
| **PermanentDelegate** | Can drain any account's tokens. If used with DeFi vault/pool accounts, funds can be seized. Wallets (Phantom) display a warning. |
| **TransferFeeConfig** | Fees deducted from the **recipient's** amount, not added to sender's cost. Escrow calculations often get this wrong. |
| **DefaultAccountState=Frozen** | Newly created vault/escrow accounts start frozen. Can break programs that expect immediate usability. |
| **MintCloseAuthority** | Can create orphan token accounts when mints are reinitialized. |

### RPC Provider Requirements

Public endpoints (free) are rate-limited and **not suitable for production**. You need a paid provider:

| Provider | Entry Tier | Notes |
|---|---|---|
| **Helius** | $49/mo (10M credits) | Solana-native; best for Solana-only projects |
| **QuickNode** | $49/mo (80M credits) | Multi-chain; Solana uses 1.5x credit multiplier |
| **Triton One** | ~$2,900/mo (dedicated) | Ultra-low latency; overkill for RWA platform |

**For MVP/demo:** Helius Free tier (1M credits) works. For production: Developer at $49/mo.

### Regulatory Tailwinds (Good News)

- **SEC and CFTC officially recognized SOL as a digital commodity** (March 2026), providing legal clarity.
- **CLARITY Act** expected to pass in 2026, defining SEC/CFTC roles for tokenized assets.
- Solana's RWA market reached **$2B+ with 182,000+ holders** in March 2026.
- BlackRock's $255M BUIDL Fund and Franklin Templeton's $594M FOBXX both operate on Solana.

---

## 3. Mainnet Cost Forecast

### Porting Effort: Devnet to Mainnet

**Minimal code changes:**

| Change | Effort |
|---|---|
| Swap RPC endpoint URL (devnet → Helius/QuickNode mainnet) | 1 line |
| Remove/gate `requestAirdrop()` calls | Search-and-replace |
| Update custom program ID (if Transfer Hook deployed) | 1 constant |
| Remove any hardcoded "devnet" references | Grep and fix |
| Add priority fee logic for production | ~20 lines |
| Set up paid RPC provider account | 15 min |

**Token-2022 program ID does NOT change** — it's `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` on all networks.

**What you DO need to redo on mainnet:** All mints, token accounts, and metadata must be created fresh. Nothing carries over from devnet. But the code is identical.

### Cost Breakdown — Contract/Program Deployment

| Item | SOL | USD (@ $89.20) |
|---|---|---|
| **Token-2022 Mint** (5 extensions + metadata, ~700-900 bytes) | 0.006-0.007 | **$0.54-$0.63** |
| **Transfer Hook Program** (50-150KB Anchor binary) | 0.5-1.5 | **$45-$134** |
| **Supplemental Program** (if needed, ~200KB) | ~1.4 | **$125** |
| Buffer SOL for deployment transactions | 0.1 | $8.92 |
| **Total initial deployment** | **~2.0-3.0** | **~$179-$268** |

Note: Rent is **fully refundable** if you close accounts/programs later.

### Cost Breakdown — Per Operation (Ongoing)

| Operation | SOL | USD | Notes |
|---|---|---|---|
| **Create investor ATA** (onboarding) | 0.002107 | **$0.19** | Rent-exempt deposit + tx fee. Dominant per-user cost. |
| **Mint tokens** | 0.000033 | **$0.003** | Sub-penny |
| **Transfer tokens** | 0.000033 | **$0.003** | Sub-penny |
| **Transfer with Hook** | 0.000061 | **$0.005** | Higher compute units |
| **Freeze/thaw account** | 0.000033 | **$0.003** | Sub-penny |
| **Pause/unpause token** | 0.000033 | **$0.003** | Sub-penny |
| **Metadata update** | 0.000033 | **$0.003** | Sub-penny |
| **Burn tokens** | 0.000033 | **$0.003** | Sub-penny |

### Forecast Scenarios

**Scenario A — Small Demo (10 investors)**

| Item | Cost |
|---|---|
| Mint creation | $0.63 |
| 10 ATAs | $1.90 |
| 20 transfers | $0.06 |
| 10 compliance actions | $0.03 |
| **Total on-chain cost** | **~$2.62** |
| RPC (Helius Free) | $0/mo |

**Scenario B — Pilot (100 investors)**

| Item | Cost |
|---|---|
| Mint creation | $0.63 |
| Transfer Hook deployment | $89.00 |
| 100 ATAs | $19.00 |
| 500 transfers | $1.50 |
| 50 compliance actions | $0.15 |
| **Total on-chain cost** | **~$110** |
| RPC (Helius Developer) | $49/mo |

**Scenario C — Production (1,000 investors, first year)**

| Item | Cost |
|---|---|
| Programs + mint | ~$225 |
| 1,000 ATAs | $190 |
| 10,000 transfers | $30 |
| 500 compliance actions | $1.50 |
| **Total on-chain cost** | **~$447** |
| RPC (Helius Developer) | $588/yr |
| **Total Year 1** | **~$1,035** |

**Scenario D — Scale (10,000 investors, first year)**

| Item | Cost |
|---|---|
| Programs + mint | ~$225 |
| 10,000 ATAs | $1,900 |
| 100,000 transfers | $300 |
| 5,000 compliance actions | $15 |
| **Total on-chain cost** | **~$2,440** |
| RPC (Helius Business) | $5,988/yr |
| **Total Year 1** | **~$8,428** |

### Counterparty Q&A Talking Points

> "What does it cost to launch a token?"

Under $1 on-chain. The mint account with full compliance extensions costs ~$0.63 in rent deposit (refundable). If we deploy a custom compliance program (Transfer Hook), that's an additional ~$45-$134 one-time.

> "What does it cost per investor?"

$0.19 to onboard (create their token account). Every transfer after that is $0.003. Compare to: traditional fund admin charges $50-$150 per investor for onboarding paperwork.

> "What does it cost at scale?"

Under $2,500/year on-chain for 10,000 investors with 100,000 annual transfers. Add ~$6,000/year for production RPC infrastructure. Total: **under $8,500/year** for infrastructure that would cost $500K+ in traditional transfer agent and registrar fees.

> "Can we move to mainnet easily?"

Yes. One endpoint change, one program redeployment, fresh mint creation. Same code, same Token-2022 program ID. Tokens and accounts don't migrate — they're created fresh on mainnet. The porting effort is measured in hours, not weeks.

---

## 4. Compliance Feature Landscape

### Are Freeze/Pause/KYC Controls Standard or Red Flags?

**They are not just standard — they are legally required for regulated securities/RWA tokens.**

#### Regulatory Expectations by Jurisdiction

| Jurisdiction | Regulator | Stance on Issuer Controls |
|---|---|---|
| **United States** | SEC | Required. Reg D, Reg S, Reg A+ all mandate transfer restrictions and issuer control over who holds the security. |
| **European Union** | ESMA / EBA (MiCA + MiFID II) | Required. Issuers of asset-referenced tokens must maintain governance controls. Smart contract enforceability of compliance rules is expected. |
| **Singapore** | MAS | Required. Project Guardian explicitly demonstrated tokens with on-chain compliance. CMS/RMO licensing requires holder registries and transfer eligibility controls. |
| **Dubai** | VARA | Required. VASPs must implement freeze/seize capabilities when directed by authorities. |
| **Switzerland** | FINMA | Required. DLT Act enables tokenized securities but requires compliance infrastructure. |

#### How Different Audiences View These Features

| Feature | Crypto-Native Investors | Institutional Investors | Regulators |
|---|---|---|---|
| **Freeze/Unfreeze** | "Centralization risk" | "Non-negotiable for compliance" | Required |
| **Pause/Unpause** | "Acceptable for emergencies" | "Expected — circuit breaker" | Expected |
| **KYC Grant/Revoke** | "Philosophical tension with DeFi" | "Absolute baseline" | Required by law |
| **Clawback / Forced Transfer** | "Red flag" | "Required for legal compliance" | Required (court orders, sanctions) |
| **Permanent Delegate** | "Uncommon, raises questions" | "Useful for fund admin" | Acceptable if governed |

#### The Key Insight

**The target audience for RWA tokens is institutional and accredited investors, not DeFi-native users.** For this audience, these controls are features, not bugs. Any platform lacking them is non-viable for regulated offerings.

Every major competitor — Securitize, Polymath/Polymesh, Tokeny (ERC-3643), Centrifuge, Ondo — implements full issuer controls. Securitize built their entire business on "compliance-first" tokenization. Polymesh built an entire L1 blockchain specifically because they argued general-purpose chains can't properly enforce securities compliance.

**For counterparty conversations:** The question isn't "why do you have freeze/pause?" — it's "do you have freeze/pause?" If they're asking the former, they may not understand regulated securities. If they're asking the latter, they're doing proper due diligence.

---

## 5. Competitive Landscape (2026)

### Tier 1 — Established Leaders

| Platform | Chain | Value Prop | Key Differentiator |
|---|---|---|---|
| **Securitize** | Ethereum, Avalanche, Polygon, Solana (expanding) | End-to-end regulated platform: issuance, compliance, cap table, secondary trading | SEC-registered transfer agent & broker-dealer. BlackRock's BUIDL ($500M+) uses them. |
| **Polymath / Polymesh** | Polymesh (purpose-built L1) | Purpose-built regulated asset chain with protocol-level compliance | Only blockchain designed from scratch for securities. On-chain KYC, gasless tx (2025+), Stripe fiat. |
| **Tokeny (ERC-3643)** | Ethereum, Polygon (EVM) | Open standard for permissioned tokens — ERC-3643 is the leading security token standard | Standards-based, interoperable, growing ecosystem. Not locked to one chain. |
| **Fireblocks** | Multi-chain infrastructure | Institutional custody + tokenization infrastructure | Infrastructure layer. Many platforms use Fireblocks under the hood. Confirmed Token-2022 support. |
| **Paxos** | Ethereum, Solana | Regulated tokenization (stablecoins, gold — PAXG) | NYDFS regulated, powers PayPal's PYUSD. Regulatory gold standard. |

### Tier 2 — Credit/Lending & Yield

| Platform | Chain | Value Prop |
|---|---|---|
| **Ondo Finance** | Ethereum (expanding multi-chain) | Tokenized US Treasuries. USDY ($1.4B TVL). Made tokenized treasuries mainstream. |
| **Centrifuge** | Centrifuge Chain, Ethereum, Base | Real-world credit (invoices, mortgages, trade finance). Major MakerDAO integration. |
| **Maple Finance** | Ethereum (+ Solana historically) | Institutional under-collateralized lending. |
| **Goldfinch** | Ethereum | DeFi lending to real-world businesses (emerging markets). |
| **Credix** | **Solana** | Credit marketplace for LatAm lending. One of the few serious Solana-native RWA platforms. |

### Tier 3 — Specialized

| Platform | Chain | Niche |
|---|---|---|
| **RealT** | Ethereum / Gnosis | Fractional US residential real estate. Functional rental income distribution. |
| **Backed Finance** | Ethereum, Polygon | Tokenized stocks/ETFs as ERC-20 tokens. Swiss regulatory framework. |
| **Swarm Markets** | Ethereum, Polygon | BaFin-regulated compliant DEX for tokenized assets. |
| **Parcl** | **Solana** | Tokenized real estate price exposure (synthetic, not direct ownership). |

### Common Features Across ALL Platforms

1. KYC/AML verification (always gated)
2. Transfer restrictions / whitelist model
3. Investor accreditation verification
4. Issuer control panel / dashboard
5. Cap table management
6. Compliance rules engine
7. Basic reporting / transaction history
8. Custody integration

### What Differentiates the Leaders

1. **Regulatory licensing** (broker-dealer, transfer agent, ATS) — Securitize's moat
2. **Secondary market access** — most platforms lack this; huge gap
3. **Programmable distributions** — automated yield/dividend is the most requested feature
4. **Institutional client roster** — BlackRock choosing Securitize validated the entire space
5. **Multi-chain deployment** — increasingly expected

### Where Our Platform Fits

The Solana-native RWA platform space is **thin**. Credix is the most mature but focused on credit/lending, not general-purpose tokenization. There is no Securitize-equivalent on Solana. Token-2022's compliance extensions (Transfer Hooks, DefaultAccountState, PermanentDelegate, Pausable) make Solana **technically better suited for RWA than Ethereum's base ERC-20** — the gap has been ecosystem tooling and institutional adoption, not capability. That gap is closing fast with BlackRock and Franklin Templeton now on Solana.

---

## 6. Wallet Compatibility

### Confirmed Support Matrix

| Wallet | Token-2022 | Transfer Fees | Frozen Display | Metadata | Ledger | Self-Custody |
|---|---|---|---|---|---|---|
| **Phantom** | Full | Shows on confirmation screen | Yes, with explanation | Yes (Metaplex schema) | Yes (blind signing) | Yes |
| **Solflare** | Full | Shield previews deductions | Yes, with explanation | Yes | Yes | Yes |
| **Backpack** | Supported | Less documented | Likely | Yes | — | Yes |
| **Trust Wallet** | **Unconfirmed** | Unknown | Unknown | Unknown | — | Yes |
| **Ledger (via Phantom/Solflare)** | Full | Via host wallet | Via host wallet | Via host wallet | Native | Hardware |
| **Fireblocks** | Full (8 extensions) | Yes | Yes | Yes | N/A | Institutional custody |
| **Squads Multisig** | Compatible | At tx level | At tx level | At tx level | — | Multi-sig |

### What to Tell Counterparties

> "Which wallet do I use?"

**Phantom** (most popular, best UX) or **Solflare** (best security previews). Both fully support Token-2022 with all the extensions we use. Both work with Ledger hardware wallets for maximum security.

> "Can I use Trust Wallet?"

Not confirmed for Token-2022. We recommend Phantom or Solflare. Sending Token-2022 tokens to an unsupported wallet may result in tokens not displaying correctly.

> "What about institutional custody?"

**Fireblocks** has confirmed support for 8 Token-2022 extensions including all of ours (Metadata, Transfer Hook, Default Account State, Transfer Fee, Permanent Delegate, Mint Close Authority). This is the recommended institutional custody path.

> "What about multisig for treasury management?"

**Squads Protocol** — Solana's dominant multisig, securing $10B+ in value. Supports multi-party approval for critical operations like minting, burning, and compliance actions.

### Known UX Friction

- **Transfer fees are deducted from the recipient**, not added to the sender. Sending 100 tokens with 1% fee = sender spends 100, recipient receives 99. Our UI must explain this clearly.
- **DefaultAccountState=Frozen means every new token account starts frozen.** If a user creates their own account (via DEX, direct SPL call) before the issuer thaws it, it will be frozen. Our onboarding flow (issuer creates ATA + thaws) mitigates this.
- **Phantom shows a warning for PermanentDelegate tokens.** This is appropriate for RWA — we should include educational material explaining why this exists.
- **CEX deposits: DO NOT send Token-2022 tokens to exchange deposit addresses.** Coinbase, Binance, etc. have not broadly announced Token-2022 support.

---

## 7. UI/UX Design

### What the Industry Expects

**The UX bar for RWA platforms is enterprise SaaS, not crypto-native.** Think Carta or Allvue, not Uniswap.

#### Must-Have UI Features (Table Stakes)

| Feature | Why |
|---|---|
| **Step-by-step token creation wizard** | Abstracts blockchain complexity for non-technical issuers |
| **Real-time cap table** | Who holds what, compliance status per holder |
| **Compliance dashboard** | Traffic-light indicators for KYC status, freeze status per account |
| **Transaction history** | Immutable, filterable, exportable audit trail |
| **Bulk operations** | Mass whitelist, bulk distribution (institutional scale) |
| **Document management** | Link to prospectus, offering memorandum, legal docs |
| **Role-based access** | Issuer admin vs compliance officer vs read-only viewer |

#### High-Value Differentiators (What Leaders Offer)

| Feature | Who Does It | Impact |
|---|---|---|
| **Programmable distributions** | Securitize, RealT, Centrifuge | #1 most requested feature. "I tokenized my fund, how do I pay quarterly dividends automatically?" |
| **NAV oracle integration** | Ondo, Securitize | On-chain NAV updates for fund tokens. Automated pricing for subscriptions/redemptions. |
| **Redemption workflows** | Securitize, Polymath | Subscribe/redeem with approval queues, settlement windows, NAV-based pricing. |
| **Secondary market / OTC** | Securitize Markets, Swarm, tZERO | Compliant peer-to-peer trading with pre-clearance. Massive gap in the market. |
| **White-labeling** | Tokeny, Securitize | Branded investor portal, custom domain. Important for fund admins building on top. |
| **API access** | Securitize, Fireblocks | RESTful APIs for cap table, distributions, compliance events. Integration with existing portfolio systems. |

#### Nice-to-Have / Emerging

- Analytics dashboard (investor demographics, trading volume)
- Compliance alert system (automated flagging)
- Automated investor communications
- Tokenized governance (on-chain voting for fund decisions)
- Cross-chain bridge support

### Design Language

- **Desktop-first.** Primary users (fund managers, compliance officers) work on desktops. Mobile-responsive for investor portfolio checks, but core experience is desktop.
- **Conservative, professional.** Bloomberg-terminal-adjacent, not DeFi-degen. Think Securitize's enterprise SaaS feel.
- **Wizard-driven token creation.** Polymath's TokenStudio pattern: step-by-step, abstracts blockchain complexity, guides issuers through decisions.
- **Investor portal separate from issuer dashboard.** Two distinct experiences: issuers manage tokens and compliance; investors view holdings, transfer, check distributions.

### Institutional Onboarding Expectations

Institutional counterparties expect:
1. **Sandbox environment** — test everything before committing
2. **White-glove setup** — personal demo, not self-service sign-up
3. **Integration support** — API docs, dedicated technical contact
4. **Legal review period** — their lawyers will review everything
5. **KYC portability** — accept existing KYC, don't start from scratch

---

## 8. Secondary Vehicles

### Staking

**Can RWA tokens be staked?**

Not in the traditional PoS sense, but yield-bearing mechanisms are emerging:

- **Compliant staking vaults:** Purpose-built contracts where the vault itself is whitelisted. Only KYC'd users can deposit/withdraw. Yield accrues to the vault and is distributed pro-rata.
- **Token-2022 interest-bearing extension:** Cosmetic display only (shows accrued interest in wallet UI) but useful for representing yield on treasury tokens.
- **Receipt token pattern:** Deposit RWA token into compliant vault, receive a receipt token that can participate in limited DeFi activities within the compliant ecosystem.

**The compliance tension:** Traditional DeFi staking assumes permissionless composability. RWA tokens with transfer restrictions can't freely flow into permissionless contracts. The staking contract itself must be a whitelisted holder.

### Liquidity Pools / AMMs

**Compliant AMMs are an active frontier:**

| Approach | Status | Notes |
|---|---|---|
| **Swarm Markets** | Live (BaFin-regulated) | KYC-gated DEX. Most advanced compliant AMM. Ethereum/Polygon. |
| **Raydium (Solana)** | Token-2022 supported in CPMM pools | Transfer fee extensions work. But frozen default state blocks permissionless listing. |
| **Transfer Hook-gated pools** | Technically feasible | Hook validates both LP and trader are whitelisted before allowing swaps. Solana's unique advantage. |
| **Permissioned liquidity pools** | Emerging pattern | Both LPs and traders must be KYC'd. Pool contract respects transfer restrictions. Compliance oracle validates trades. |

**Key insight:** Token-2022 Transfer Hooks position Solana uniquely — the ability to enforce compliance rules **inside** DeFi interactions (AMMs, lending, staking) without needing a separate permissioned chain is a genuine differentiator vs. Polymesh's "separate chain" approach.

### Lending / Borrowing Against RWA Tokens

**Highest-demand DeFi use case for RWA:**

- Use tokenized treasuries as collateral, borrow stablecoins against them
- Flux Finance (Ondo ecosystem) already offers this for OUSG
- On Solana, lending protocols could integrate Token-2022 Transfer Hooks

**Key challenge: Liquidation.** If a borrower defaults, the protocol must sell the RWA collateral — but only to whitelisted buyers. Requires either:
- Pre-approved pool of liquidators
- Automated compliance-gated auction
- Issuer backstop (designated market maker)

### Revenue Share / Distributions

**This is core RWA functionality and the #1 most requested feature:**

| Type | Description | Complexity |
|---|---|---|
| **Pro-rata distributions** | Each holder receives proportional share of income | Medium |
| **Waterfall distributions** | Preferred returns, hurdle rates, carried interest | High |
| **DRIP (dividend reinvestment)** | Auto-reinvest distributions into additional tokens | Medium |
| **Multi-currency** | Pay in USDC while underlying generates fiat income | Medium |

On Solana: Token-2022's PermanentDelegate can automate distributions without requiring holder action. Transfer Hooks can enforce that payments only go to compliant holders.

### Fund-of-Funds / Basket Products

Emerging but early:
- Tokenized index products (basket of RWA tokens)
- ETF-like creation/redemption mechanisms on-chain
- Requires deep infrastructure: NAV calculation, rebalancing, compliance inheritance from underlying tokens

### What We Should Consider for MVP vs Phase 2+

| Vehicle | MVP? | Phase 2? | Rationale |
|---|---|---|---|
| Basic yield display (interest-bearing) | Yes | — | Low effort, high demo value |
| Pro-rata distributions | — | Yes | Killer feature, moderate complexity |
| Compliant staking vault | — | Phase 3 | Needs Transfer Hook + custom program |
| Permissioned liquidity pool | — | Phase 3 | Significant engineering, frontier territory |
| Lending/borrowing | — | Phase 3+ | Requires liquidation infrastructure |
| Fund-of-funds | — | Phase 4+ | Deep infrastructure, low immediate demand |

---

## 9. Features Beyond HTS Demo

### What Solana Token-2022 Unlocks That Hedera HTS Doesn't

| Capability | HTS | Token-2022 | Advantage |
|---|---|---|---|
| **Transfer Hooks** | Not available | Programmable custom logic on every transfer | Arbitrary compliance rules, oracle integration, whitelist registries |
| **Transfer Fees** | Custom fee schedules (limited) | Native basis-point fees with max cap | Automated management fee collection, no smart contract needed |
| **Confidential Transfers** | Not available | ElGamal + ZK proofs (when re-enabled) | Institutional privacy — hide balances/amounts from public view |
| **Pausable** | Native pause | Extension-based pause | Equivalent |
| **Permanent Delegate** | Wipe operation | Unrestricted transfer/burn from any account | More flexible — can transfer (not just destroy) |
| **Interest-Bearing Display** | Not available | Cosmetic rate display in wallets | Shows accrued yield natively |
| **Memo Required** | Native memo field | MemoTransfer extension (enforced) | Protocol-enforced audit trail |
| **Non-Transferable (Soulbound)** | Not natively | Extension-based | Compliance credentials, voting tokens |
| **DeFi Composability** | Limited (HBAR ecosystem is small) | Massive (Jupiter, Raydium, Marinade, etc.) | Token can participate in Solana DeFi within compliance bounds |
| **Wallet Ecosystem** | HashPack, Blade (small) | Phantom, Solflare, Backpack (massive) | Counterparties likely already have Phantom |

### Additional Features to Offer

Based on competitive analysis and institutional demand, these are features we **should** offer beyond the HTS demo baseline:

**High-Impact Additions for MVP:**

1. **Asset templates** — Pre-built configurations for common RWA types (treasury bill, real estate, equity, debt instrument). Auto-fills creation wizard with appropriate parameters, metadata fields, and compliance defaults. Low effort, high demo value.

2. **Distribution simulator** — Show how quarterly distributions would work: calculate pro-rata amounts, preview the transaction batch, show estimated costs. Doesn't need to execute real distributions in MVP — just demonstrate the capability.

3. **Compliance rules builder (visual)** — Instead of just toggles, a visual interface: "Only wallets from [US, CA, EU] can hold this token" / "Maximum 500 holders" / "Minimum holding period: 90 days". These map to Transfer Hook logic in Phase 1B.

4. **Audit export** — One-click export of all on-chain activity as CSV/PDF. Regulators and auditors expect this. Reads directly from Solana transaction history.

5. **Multi-sig integration (Squads)** — For demo, show that critical operations (mint, burn, freeze, config changes) require multi-party approval. This is what institutional treasuries expect.

**High-Impact Additions for Phase 2:**

6. **Programmable distributions** — Automated dividend/yield/rent payments. The single most requested feature by asset managers.

7. **NAV oracle** — On-chain NAV updates. Automated pricing for subscriptions/redemptions.

8. **Redemption workflows** — Request queue with approval, NAV-based pricing, settlement windows.

9. **Secondary OTC desk** — Compliant P2P transfer with pre-clearance. Request-for-quote system.

10. **API layer** — RESTful APIs for cap table queries, investor management, distribution triggers. Webhook notifications. Integration with existing portfolio management systems.

---

## Appendix: Counterparty Q&A Quick Reference

| Question | Answer |
|---|---|
| What blockchain? | Solana, using Token-2022 (Token Extensions) |
| Why not Ethereum? | 100-1000x cheaper per transaction. Native compliance extensions. No smart contract deployment for base operations. |
| Is Solana production-ready for RWA? | Yes. BlackRock ($255M BUIDL), Franklin Templeton ($594M FOBXX), Ondo ($176M USDY) all on Solana. SOL recognized as digital commodity by SEC/CFTC (March 2026). |
| What does it cost to launch a token? | Under $1 on-chain (refundable rent deposit). |
| What does it cost per investor? | $0.19 to onboard, $0.003 per transfer. |
| What does it cost at scale (10K investors)? | ~$8,500/year total (on-chain + infrastructure). |
| Can we freeze/pause tokens? | Yes — required by regulators. Every major RWA platform has these features. |
| Which wallets work? | Phantom, Solflare, Backpack (self-custody). Fireblocks (institutional custody). Ledger (hardware). |
| Can we move to mainnet? | Yes — same code, same Token-2022 program ID, one endpoint swap. Hours, not weeks. |
| What about secondary trading? | Phase 2. Transfer Hooks enable compliant DEX integration. Permissioned liquidity pools are the emerging pattern. |
| What about staking/yield? | Interest-bearing display in MVP. Programmable distributions in Phase 2. Compliant staking vaults in Phase 3. |
| What about privacy? | Confidential Transfers (ZK proofs) are a Token-2022 extension, currently paused for security audit. Expected to re-enable. Phase 2+. |
