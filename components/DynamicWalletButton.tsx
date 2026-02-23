"use client";

import dynamic from "next/dynamic";

// Must be dynamically imported with ssr:false to prevent hydration mismatch.
// WalletMultiButton reads browser state (wallet connection) which doesn't exist on server.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => (
    <div className="h-9 w-24 rounded-lg bg-accent/20 animate-pulse" />
  )},
);

export default function DynamicWalletButton({ style }: { style?: React.CSSProperties }) {
  return <WalletMultiButton style={style} />;
}
