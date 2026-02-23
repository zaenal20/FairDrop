## FairDrop

FairDrop is a Solana-based airdrop platform that lets you create on-chain token drops (SOL or any SPL token) and gate them by **FairScale** reputation.  
You deposit tokens once, get a shareable claim link, and let real users (not bots) claim until the drop is exhausted.

---

## Features

- **Create drops on Solana**
  - Fund a drop with **SOL or any SPL token**.
  - Configure **number of winners** and total amount.
  - Built-in **platform fee** preview (1% by default).
  - Uses an on-chain program with PDAs for drop, vault, and claim records.

- **FairScale-powered reputation gating**
  - Optional **minimum FairScale score** per drop.
  - Fetches scores from the FairScale API at claim time.
  - If a wallet’s score is below the threshold, it cannot claim.

- **Link-based claiming**
  - Each drop gets a **short slug** (e.g. `/claim/abcd1234`).
  - Creator can safely share the link on X, Discord, etc.
  - The underlying drop address is not exposed in the URL.

- **Claim experience**
  - Claimers connect a Solana wallet and see:
    - Amount per claim (SOL or token).
    - Remaining slots and total claimed.
    - Their **FairScale score** and eligibility status.
  - If eligible, backend issues a signed claim token and the app sends an on-chain claim transaction.
  - Claim history with timestamps and Solscan links.

- **Creator dashboard**
  - “My Drops” dashboard showing all drops created by the connected wallet.
  - Filters by status (active / ended / canceled) and token type (SOL / SPL).
  - Shows remaining claims, total claims, and quick actions (copy link, open Solscan, etc.).

---
