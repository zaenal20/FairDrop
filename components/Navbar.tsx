"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTheme } from "@/lib/theme";
import { NETWORK } from "@/lib/constants";
import DynamicWalletButton from "./DynamicWalletButton";

export default function Navbar() {
  const { connected } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const themeLabel = theme === "dark" ? "☀ Light Mode" : "☾ Dark Mode";
  const themeIcon = theme === "dark" ? "☀" : "☾";

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg/80 backdrop-blur-sm"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">

        {/* Logo */}
        <Link href="/" className="font-display text-xl font-bold text-text tracking-tight shrink-0">
          <span className="text-2xl text-accent">Fair</span>
          Drop<span className="text-accent">.</span>
        </Link>

        {/* ── Desktop ─────────────────────────────── */}
        <div className="hidden sm:flex items-center gap-4">
          {NETWORK === "devnet" && (
            <span className="text-xs font-mono px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
              devnet
            </span>
          )}

          {connected && (
            <Link href="/dashboard" className="text-sm text-muted hover:text-text transition-colors">
              My Drops
            </Link>
          )}

          <Link href="/create" className="text-sm text-muted hover:text-text transition-colors">
            Create
          </Link>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:border-accent/30 transition-colors text-sm"
          >
            {themeIcon}
          </button>

          <DynamicWalletButton
            style={{
              background: "#2BF916",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "'DM Sans', sans-serif",
              height: "36px",
              padding: "0 12px",
            }}
          />
        </div>

        {/* ── Mobile ─────────────────────────────── */}
        <div className="flex sm:hidden items-center gap-2">
          <DynamicWalletButton
            style={{
              background: "#2BF916",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "'DM Sans', sans-serif",
              height: "32px",
              padding: "0 10px",
            }}
          />

          {/* Hamburger */}
          <button
            aria-label="Toggle menu"
            onClick={() => setMenuOpen(prev => !prev)}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:border-accent/30 transition-colors"
          >
            <span
              className={`absolute w-5 h-[2px] bg-current transition-all duration-300 ease-in-out ${menuOpen ? "rotate-45" : "-translate-y-2"
                }`}
            />
            <span
              className={`absolute w-5 h-[2px] bg-current transition-all duration-300 ease-in-out ${menuOpen ? "opacity-0 scale-x-0" : ""
                }`}
            />
            <span
              className={`absolute w-5 h-[2px] bg-current transition-all duration-300 ease-in-out ${menuOpen ? "-rotate-45" : "translate-y-2"
                }`}
            />
          </button>
        </div>
      </div>

      {/* ── Mobile Dropdown ──────────────────────────── */}
      <div
        className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out border-border bg-bg/95 backdrop-blur-sm ${menuOpen ? "max-h-64 border-t opacity-100" : "max-h-0 opacity-0"
          }`}
      >
        <div className="px-4 py-3 space-y-1">
          {NETWORK === "devnet" && (
            <div className="px-3 py-2">
              <span className="text-xs font-mono px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                devnet
              </span>
            </div>
          )}

          {connected && (
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-text hover:bg-surface transition-colors"
            >
              My Drops
            </Link>
          )}

          <Link
            href="/create"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-text hover:bg-surface transition-colors"
          >
            Create Drop
          </Link>

          <button
            onClick={() => {
              toggleTheme();
              setMenuOpen(false);
            }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted hover:text-text hover:bg-surface transition-colors text-left"
          >
            {themeLabel}
          </button>
        </div>
      </div>
    </nav>
  );
}