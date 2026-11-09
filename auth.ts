import { todayInTimeZone } from "@/lib/date";
import { createLocalClient, LOCAL_EMAIL, LOCAL_USER_ID, type LocalClient } from "@/lib/local/db";
import { normalizeProfile, PROFILE_COLUMNS } from "@/lib/profile";
import type { AppContext, Profile } from "@/lib/types";

function localUser() {
  return {
    id: LOCAL_USER_ID,
    email: LOCAL_EMAIL,
    user_metadata: { display_name: "You" },
  };
}

async function loadProfile(supabase: LocalClient): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", LOCAL_USER_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return normalizeProfile(data as Record<string, unknown>);

  const created = await supabase
    .from("profiles")
    .insert({
      id: LOCAL_USER_ID,
      display_name: "You",
      timezone: "UTC",
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (created.error) throw new Error(created.error.message);
  return normalizeProfile(created.data as Record<string, unknown>);
}

export async function getOptionalUser(): Promise<{
  supabase: LocalClient;
  user: ReturnType<typeof localUser>;
  profile: Profile;
}> {
  const supabase = createLocalClient();
  const profile = await loadProfile(supabase);
  return { supabase, user: localUser(), profile };
}

/** Local edition: there is always one local workspace, so no login is required. */
export async function requireUser(): Promise<AppContext & { supabase: LocalClient }> {
  const supabase = createLocalClient();
  const profile = await loadProfile(supabase);
  return {
    supabase,
    userId: LOCAL_USER_ID,
    email: LOCAL_EMAIL,
    profile,
    today: todayInTimeZone(profile.timezone),
  };
}
