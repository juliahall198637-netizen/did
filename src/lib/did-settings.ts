import { supabase } from "@/integrations/supabase/client";

export type DidSettings = {
  id: string;
  client_key: string;
  agent_id: string;
  embed_script_url: string;
  mode: string;
  name: string;
  monitor: boolean;
  light_mode: boolean;
  orientation: string;
  position: string;
  open_mode: string;
};

export const DID_SETTINGS_QUERY_KEY = ["did-settings"] as const;

export async function fetchDidSettings(): Promise<DidSettings | null> {
  const { data, error } = await supabase
    .from("did_settings")
    .select(
      "id, client_key, agent_id, embed_script_url, mode, name, monitor, light_mode, orientation, position, open_mode",
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as DidSettings) ?? null;
}

export async function saveDidSettings(id: string, values: Partial<DidSettings>) {
  const { error } = await supabase.from("did_settings").update(values).eq("id", id);
  if (error) throw error;
}
