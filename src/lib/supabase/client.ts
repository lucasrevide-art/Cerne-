import { createClient } from "@supabase/supabase-js";
import { resolveConfig } from "./config.ts";

const config = resolveConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase = createClient(config.url, config.key);
