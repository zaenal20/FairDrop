"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
interface ThemeContextValue { theme: Theme; toggleTheme: () => void; }

// Default dark — matches server render, avoids hydration flash
const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,   setTheme]   = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved   = localStorage.getItem("theme") as Theme | null;
    const initial = saved ?? "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  };

  // Expose mounted so consumers can avoid hydration mismatch
  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : "dark", toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
