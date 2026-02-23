import type { Metadata } from "next";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/lib/toast";

export const metadata: Metadata = {
  title: "FairDrop. — Reputation-gated token drops on Solana",
  description: "Create and claim token drops gated by FairScale reputation score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <WalletProvider>
              <Navbar />
              <main className="min-h-screen pt-16">
                {children}
              </main>
            </WalletProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
