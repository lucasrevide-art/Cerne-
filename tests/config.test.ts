import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SUPABASE_KEY, DEFAULT_SUPABASE_URL, normalizeKey, normalizeUrl, resolveConfig } from "../src/lib/supabase/config.ts";

test("URL: remove /rest/v1, barra final, aspas e espaços", () => {
  const ok = "https://abc.supabase.co";
  for (const raw of [ok, ok + "/", ok + "/rest/v1", ok + "/rest/v1/", `"${ok}"`, `  ${ok}\n`, "abc.supabase.co"]) {
    assert.equal(normalizeUrl(raw), ok, raw);
  }
  assert.equal(normalizeUrl(""), null);
  assert.equal(normalizeUrl(undefined), null);
});

test("chave: limpa aspas/espaços e recusa secret key", () => {
  assert.equal(normalizeKey(' "sb_publishable_abc" '), "sb_publishable_abc");
  assert.equal(normalizeKey("sb_secret_abc"), null);
  assert.equal(normalizeKey("sb_publishable_a b"), null);
  assert.equal(normalizeKey(""), null);
});

test("sem variáveis (ou com variáveis inválidas) usa os padrões públicos", () => {
  assert.deepEqual(resolveConfig(undefined, undefined), { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY });
  assert.deepEqual(resolveConfig("", "sb_secret_x"), { url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_KEY });
  assert.equal(resolveConfig(DEFAULT_SUPABASE_URL + "/rest/v1", undefined).url, DEFAULT_SUPABASE_URL);
});

test("padrões são públicos e bem formados", () => {
  assert.match(DEFAULT_SUPABASE_URL, /^https:\/\/[a-z0-9]+\.supabase\.co$/);
  assert.match(DEFAULT_SUPABASE_KEY, /^sb_publishable_/);
});
