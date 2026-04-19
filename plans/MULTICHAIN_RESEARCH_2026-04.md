# CipheX Atlas — Multi-Chain Expansion Research

**Prepared:** April 2026
**Audience:** Engineering, marketing, BD
**Companion to:** `plans/RWA_TOKEN_PLATFORM_PROPOSAL.md`, `plans/RWA_TOKEN_PLATFORM_ADDENDUM.md`

---

## TL;DR

Atlas today: Solana Token-2022, full compliance extension stack, devnet-verified. The market has decisively moved multi-chain since the original proposal — every serious institutional issuer (BlackRock, Franklin Templeton, Apollo, VanEck, WisdomTree, Janus Henderson) is now deployed on at least 2 chains, and the largest tokenized fund (BUIDL) is live on six. Staying Solana-only means walking away from ~85% of issuance flow. The good news: the same compliance primitives Atlas already exposes (whitelist, freeze, force-transfer, pause) map cleanly onto an established EVM standard (ERC-3643 / T-REX) that has been battle-tested across $32B in issued tokens, so the work is integration, not redesign.

The recommended sequence is **Base → Polygon PoS → Avalanche C-Chain → XRPL/Stellar**, with Plume as a research bet for late 2026. The third-party exchange exposure question — i.e. who actually trades these tokens once issued — is the single biggest gating risk for marketing claims and is addressed in its own section.

---

## 1. Market state (Q1 2026)

Total RWA TVL (excluding stablecoins) sits at roughly $21.35 billion at the start of 2026, up from $20.33 billion in late 2025. Including stablecoins, the wider tokenized-asset stack is materially larger; on-chain RWAs surpassed $50 billion in TVL by early 2026 with BlackRock, Franklin Templeton, and JPMorgan running active products.

Chain share of that TVL:

| Chain | Approx. RWA share | Posture |
|---|---|---|
| Ethereum L1 | ~60–65% | Default settlement layer for institutional issuance |
| Polygon PoS | ~13% | Picked up significant BUIDL flow + tokenized bonds |
| Solana | growing | BUIDL allocation in late 2025; tokenized equity issuers |
| Avalanche | meaningful | BUIDL + Janus Henderson CLO fund + subnet ecosystem |
| BNB Chain | rising | Circle's USYC money market fund |
| Stellar | $1.4B+ | Franklin Templeton BENJI is the anchor |
| XRPL | $400M–$500M | Ripple/DBS/Franklin Templeton tokenized MMFs |
| Plume (RWA-native L2) | ~$500M | Apollo-backed, Wisdom­Tree 14 funds, SEC transfer-agent registered |

Coinbase's January 2026 trends report frames late 2025 as a clear shift toward a more multi-chain footprint: Solana gaining share via BUIDL and tokenized equity issuers, Avalanche pulling flows from BUIDL and the Janus Henderson CLO fund, Polygon receiving BUIDL and JusToken's commodity products, and BNB Chain becoming a key venue for Circle's USYC.

The takeaway for Atlas: the issuers we want as customers are already deploying the same product on multiple chains. A multi-chain platform is table stakes, not differentiation.

---

## 2. Chain-by-chain assessment

### 2.1 Base (Coinbase L2) — **recommended first EVM target**

**Why first:** Cheapest credible institutional venue, lowest engineering lift from a Solana-equivalent UX (sub-cent fees, near-instant), and the strongest distribution story for any US-facing issuer because of the Coinbase brand halo.

**Real activity:**
- Backed deployed tokenized US Treasuries on Base in late 2023, citing it as a low-cost, developer-friendly way to build on-chain with transaction fees roughly ten times cheaper than Ethereum mainnet.
- Coinbase announced Coinbase Tokenize in December 2025 as an end-to-end institutional platform combining issuance, custody, compliance, and trading — explicitly built on Base.
- Coinbase's earlier Project Diamond was launched on Base under Abu Dhabi Global Market regulatory oversight, creating digital assets natively on-chain rather than wrapping existing instruments.

**Token standard:** ERC-3643 (T-REX) is the cleanest fit. EVM native, audited, and the same standard Tokeny has used to issue $32B+ in funds, equities, debt, commodities, and cash across other EVM chains.

**Limitations:**
- Centralized sequencer (Coinbase operates it). Concentration risk, censorship risk, and a single point of regulatory pressure.
- Bridge dependency back to Ethereum mainnet for canonical settlement.
- Coinbase Tokenize is now a direct competitor for the high end of the market — Atlas needs to position around self-serve / mid-market.

---

### 2.2 Polygon PoS — **second EVM target, biggest existing RWA footprint outside Ethereum**

**Why second:** Most established RWA flow of any non-Ethereum EVM chain. Mature tooling, deep stablecoin liquidity, broad wallet support.

**Real activity:**
- BlackRock's BUIDL launched on Ethereum in March 2024 and later expanded to Polygon with $500M deployments, raising Polygon's RWA share to roughly 13%.
- Franklin Templeton's FOBXX (the first US-registered mutual fund to settle on a public blockchain) ran initially on Stellar and was later deployed on Polygon as well; the fund holds Treasury bills and government securities and crossed $360M+ AUM.
- Polygon picked up meaningful allocations from BUIDL and JusToken's commodity products in late 2025.

**Token standard:** ERC-3643 is the dominant choice; it is currently the only permissioned-token standard formally accepted as an ERC, and it embeds identity verification, transfer restrictions, and compliance logic directly into the token, making it suitable for regulated assets like real estate, securities, and private funds. ERC-1400 still has legacy deployments and ERC-7518/DyCIST is emerging, but 3643 has the implementation maturity.

**Limitations:**
- Validator centralization concerns relative to Ethereum mainnet.
- The pending PoS → AggLayer / zkEVM migration story is unresolved enough that issuers should pin to a specific chain ID.
- Brand confusion: Polygon PoS, Polygon zkEVM, and AggLayer are all "Polygon" but have very different security/settlement models. Marketing copy must be specific.

---

### 2.3 Avalanche C-Chain (and subnets) — **third target, institutional positioning**

**Why third:** Avalanche has been the most aggressive chain in courting traditional finance directly, and the subnet model lets a sophisticated issuer eventually graduate from a shared chain to a dedicated permissioned one — a useful upsell motion for Atlas.

**Real activity:**
- Wellington Management has been testing tokenized financial instruments inside Spruce, an Avalanche Evergreen Subnet, alongside T. Rowe Price, WisdomTree, and Cumberland — including a live private fund tokenization proof-of-concept with Citi and WisdomTree.
- VanEck launched a $1.25B PurposeBuilt Fund focused on Avalanche-native RWA products in mid-2025, and Avalanche had 80 live subnets as of November 2025.
- The Q3 2025 ecosystem report flagged Wyoming's state-issued stablecoin and SkyBridge Capital's $300M tokenization initiative on Avalanche, plus a Korea-focused RWA infrastructure partnership with a stablecoin pilot scheduled for late 2025.
- Avalanche's RWA value (excluding stablecoins) grew from ~$74M in January 2024 to ~$130M in January 2025, with a further scale jump in 2026 reflecting institutional deployment.

**Token standard:** ERC-3643 on C-Chain. For subnet deployments, the same contracts can be redeployed inside a permissioned EVM environment.

**Limitations:**
- C-Chain RWA TVL is still measurably smaller than Polygon's — Avalanche's institutional story is more forward-looking than current-flow.
- Subnet sovereignty is genuinely useful, but a subnet is a separate chain — interoperability back to C-Chain or other ecosystems requires bridging (Avalanche Warp Messaging or third-party).
- Stablecoin liquidity on C-Chain is healthy but more concentrated than Polygon.

---

### 2.4 XRPL & Stellar — **fourth wave, payments-rail positioning**

These two are grouped because they share a non-EVM, payments-first heritage and target a similar institutional buyer.

**Real activity:**
- In September 2025 Ripple partnered with Franklin Templeton and DBS to launch tokenized lending and trading solutions using tokenized money market funds and RLUSD.
- Stellar's distributed asset value reached roughly $1.4B, with Franklin Templeton's BENJI fund as the main driver at ~$651M market cap.
- Mercado Bitcoin announced tokenization of $200M in RWAs on the XRP Ledger, including fixed-income and equity instruments.

**Token standards:** Native primitives (XRPL Issued Currencies + the new MPT/credentials work; Stellar issued assets + Soroban contracts). Atlas would not be able to reuse ERC-3643 contracts directly here — these are separate codebases.

**Limitations:**
- Different programming models (no general-purpose smart contracts on XRPL classic; Stellar Soroban is a separate runtime). Higher engineering lift than adding another EVM chain.
- Compliance tooling is less standardized — no equivalent of the T-REX framework with $32B in issuance to point to.
- Strong fit for tokenized cash / MMFs / payments; weaker fit for the broader RWA categories Atlas's wizard targets (real estate, private credit, equities).

**Recommendation:** Defer until at least one EVM chain ships and a specific issuer asks for it.

---

### 2.5 Plume — **research bet, not near-term**

Plume is an EVM-compatible L2 purpose-built for RWAs with native compliance primitives.

- As of mid-2025 Plume hosted over $128M in tokenized RWA value and 128,000 holders, with TVL surging 87% in 30 days; it features native KYC/AML, permissioned tokens, and tax infrastructure at the protocol level.
- Plume has been registered by the SEC as a transfer agent for tokenized securities, WisdomTree debuted 14 tokenized funds on it, and Apollo invested in the platform; Mercado Bitcoin used it to tokenize $40M of RWAs.
- Native USDC and CCTP V2 integrated in September 2025; TVL rose from $44M at the June 2025 mainnet launch to $238M by September 2025.

**Why it's interesting:** A lot of the work Atlas has built into the wizard (compliance gating, jurisdiction logic) is being solved at the chain level by Plume. That cuts both ways — it could be a deployment target, or it could be a competitor to the workflow layer.

**Why it's not near-term:** The chain is young, decentralization concerns flagged by L2BEAT (limited challenger set), and the issuer base is still building. Wait one more cycle and re-evaluate.

---

## 3. Token standard summary

| Standard | Chains | Status | Notes |
|---|---|---|---|
| Token-2022 (current) | Solana | Production | What Atlas already uses |
| ERC-3643 / T-REX | Ethereum + every major EVM L2/L1 | Open-source, $32B+ issued, multi-chain | Recommended EVM standard |
| ERC-1400 | Ethereum + EVM | Legacy but still in use | Predecessor; use only if a counterparty insists |
| ERC-7518 / DyCIST | Ethereum + EVM | Emerging | Worth monitoring; not yet at production scale |
| XRPL Issued Currencies + MPT | XRPL | Production | Native, no smart-contract layer |
| Stellar Assets + Soroban | Stellar | Production | Soroban for programmable compliance |
| Hedera HTS + ERC-3643 contracts | Hedera | Production | Hedera's system contracts don't natively support ERC-3643 on HTS tokens, but standard ERC-3643 functions can be implemented in a smart contract deployed on the network like other EVM-compatible chains. |

For a CipheX Atlas multi-chain push the architectural bet is: **Token-2022 on Solana, ERC-3643 on every EVM target.** That's two compliance code paths to maintain, not seven.

---

## 4. Real-world case studies (for marketing copy)

These are the named, on-the-record deployments that make the strongest evidence base.

**Tokenized money market funds / Treasuries**
- BlackRock BUIDL — launched on Ethereum March 2024, now on Ethereum, Polygon, Solana, Avalanche, Arbitrum, Optimism. Leads with $2.83B spread across six blockchain networks.
- Franklin Templeton FOBXX (BENJI token) — first US-registered mutual fund on a public blockchain, originally on Stellar, expanded to Polygon and others.
- Ondo Finance OUSG / USDY — Ethereum-native, expanded multi-chain. Ondo's ecosystem reached about $1.4B TVL by early 2026, the third-largest RWA platform.
- Circle USYC — money market fund, deployed on BNB Chain among others.

**Private credit**
- Apollo ACRED — Wall Street confidence signal for blockchain settlement.
- Figure has tokenized over $12B in HELOCs; Apollo and Maple Finance run on-chain credit vaults.
- Janus Henderson CLO fund on Avalanche (allocation also from BUIDL).

**Commodities**
- Tether Gold (XAUT) and Paxos Gold (PAXG) — established commodity tokens.
- Plume tokenized $1B in mineral rights for Allegiance Oil & Gas and $200M in carbon allowances.

**Real estate / fractional**
- RealT, Lofty.ai — retail-facing fractional real estate, $50 minimums on Ethereum/Polygon.

**Equities**
- Tokenized equities are emerging on Coinbase, Robinhood, Kraken, and BitGo, though still limited by legal caveats — Robinhood notably allowed fractional trading of private companies like OpenAI without formal issuer agreements, drawing regulatory scrutiny.
- Ondo Global Markets has listed tokens for equities including Pfizer and Nvidia.

**Infrastructure / regulated venues**
- Securitize — the transfer-agent backbone for BUIDL.
- INX.one — SEC-registered ATS + broker-dealer for tokenized securities trading.
- SIX Digital Exchange (SDX) — Swiss-regulated, tokenized bonds and equities.

The marketing page should lead with the BUIDL multi-chain story and the Franklin BENJI multi-chain story — they're the two cleanest "look, this is normal now" reference points.

---

## 5. Third-party exchange exposure (the gating issue)

This is the question Atlas customers will actually ask in the second meeting, and it's the section the marketing page has to handle honestly.

**The problem.** Issuing a compliant token is the easy half. Where does it trade? The empirical answer in 2025–2026 is: mostly nowhere, and that's a feature, not a bug, for permissioned securities. A 2025 arXiv study covering more than $25B in tokenized RWAs documented that most RWA tokens exhibit low trading volumes, long holding periods, and limited investor participation despite their potential for 24/7 global markets — with low transfer activity and minimal secondary trading across most asset classes.

**Why "nowhere" is often correct.** A permissioned token by definition can only move between whitelisted addresses. Listing it on a permissionless DEX is technically possible but operationally meaningless — every taker has to be pre-cleared, which is exactly what a centralized ATS already does. Issuance and custody infrastructure have progressed but secondary market activity remains constrained by fragmented exchanges, low trading volumes, and operational inefficiencies.

**The venues that actually exist:**
- Securitize Markets (US ATS, paired with the issuance platform).
- INX.one — SEC-registered exchange, ATS + broker-dealer, supports tokenized securities and other RWAs.
- SIX Digital Exchange (SDX) — Switzerland, regulated full-stack issuance/settlement/custody.
- Archax — UK FCA-regulated, growing XRPL footprint.
- Coinbase Tokenize / Coinbase International — emerging, especially for Base-issued assets.
- Plume's native marketplace and integrated DEX (Nest vaults, etc.).
- Mercado Bitcoin in Brazil for LATAM-issued assets.

**What this means for Atlas marketing copy:**
1. Don't promise liquidity. Promise issuance, compliance, and the ability to *integrate* with whichever ATS / regulated venue the issuer chooses.
2. Be explicit that secondary trading requires a regulated venue partner — list 3–5 concrete options per chain and let the issuer pick.
3. Frame "exchange exposure" as a benefit when it exists (BUIDL accepted as collateral on certain DeFi venues with whitelisted access) and a known limitation when it doesn't.
4. The honest pitch: Atlas + chain + custodian + ATS = full lifecycle. Atlas owns one box.

---

## 6. Engineering implications for chain-agnostic Atlas

Quick map of what changes when adding an EVM chain alongside Solana Token-2022:

| Layer | Solana today | Add for EVM (Base/Polygon/Avax) |
|---|---|---|
| Wallet adapter | `@solana/wallet-adapter-react` | `wagmi` + `viem`, RainbowKit or ConnectKit |
| Network abstraction | `lib/solana/connection.ts` | `lib/evm/clients.ts` (chain-keyed viem clients) |
| Token service | `token-service.ts` (Token-2022) | `token-service.ts` (ERC-3643 / T-REX SDK) |
| Compliance actions | freeze/thaw/pause/burn via Token-2022 extensions | Same actions via T-REX `ComplianceModule` + `IdentityRegistry` |
| Identity / KYC | `lib/kyc.ts` (mock localStorage) | ONCHAINID per investor (T-REX standard) |
| Indexing | Helius (Solana) | Alchemy / QuickNode + The Graph or Goldsky (EVM) |
| Metadata | Token-2022 metadata extension + Pinata | ERC-721/3643 `tokenURI` + Pinata (no change) |
| Mint registry | Upstash ZSET keyed by mint address | Same Upstash, partitioned by `chain:address` |

The 5-step token creation wizard, the holders/cap table, the compliance panel, and the explorer page are all chain-agnostic in their UX — the chain selector is added in step 1, and each underlying service is dispatched on chain ID. The biggest single piece of work is **identity**: T-REX assumes an on-chain identity contract per investor, which is a deeper integration than Atlas's current localStorage mock and a real production-KYC swap regardless.

---

## 7. Recommendation

1. **Phase 2A:** Add Base + ERC-3643. Lowest cost, best brand fit, ships fastest.
2. **Phase 2B:** Add Polygon PoS. Same code path, biggest existing RWA market, named-issuer story (BUIDL, Franklin) for the marketing page.
3. **Phase 2C:** Add Avalanche C-Chain, with subnet upsell path documented.
4. **Phase 3:** Real KYC provider (Civic, Persona, Synaps) replacing the localStorage mock, plus on-chain identity (ONCHAINID) for EVM chains. This is required before any of the above is honest in production.
5. **Phase 4:** Evaluate XRPL or Stellar based on actual customer demand. Don't build speculatively — these are different programming models.
6. **Phase 5:** Re-evaluate Plume in late 2026. If it grows, partner; if it stalls, skip.

The marketing page should claim multi-chain Day 1 (Solana + EVM family) with named case studies (BUIDL, BENJI, ACRED, Wellington's Spruce work), be explicit about secondary-market exposure as an integration not a built-in, and avoid TVL claims about Atlas itself until there are customers to count.
