import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/theme-provider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, today } = await requireUser();
  return (
    <ThemeProvider initialTheme={profile.theme}>
      <AppShell profile={profile} email="Stored on this device" today={today}>
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
