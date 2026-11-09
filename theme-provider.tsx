"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/types";

type ThemeContextValue = {
  theme: ThemePreference;
  resolved: "dark" | "light";
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialTheme = "dark",
  children,
}: {
  initialTheme?: ThemePreference;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = React.useState<ThemePreference>(initialTheme);
  const [systemDark, setSystemDark] = React.useState(true);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("lockin-theme") as ThemePreference | null;
    if (stored && ["dark", "light", "system"].includes(stored)) {
      setThemeState(stored);
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: "dark" | "light" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = React.useCallback((next: ThemePreference) => {
    setThemeState(next);
    window.localStorage.setItem("lockin-theme", next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const options: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
    { value: "dark", icon: Moon, label: "Dark theme" },
    { value: "light", icon: Sun, label: "Light theme" },
    { value: "system", icon: Monitor, label: "System theme" },
  ];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-surface-2/60 p-0.5",
        className,
      )}
      role="group"
      aria-label="Theme"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-label={option.label}
            aria-pressed={active}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export function ThemeScript({ initialTheme = "dark" }: { initialTheme?: ThemePreference }) {
  const script = `
(function(){
  try {
    var stored = localStorage.getItem('lockin-theme') || '${initialTheme}';
    var dark = stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.remove('dark','light');
    document.documentElement.classList.add(dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
