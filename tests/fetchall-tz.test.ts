import test from "node:test";
import assert from "node:assert/strict";
import { fetchAll } from "../src/lib/repository/util.ts";
import { completedByDay } from "../src/lib/lenses.ts";
import { shortDate } from "../src/lib/format.ts";
import type { Task } from "../src/types.ts";

const fakeTable = (n: number) => {
  const calls: [number, number][] = [];
  const build = async (a: number, b: number) => {
    calls.push([a, b]);
    return { data: Array.from({ length: Math.max(0, Math.min(b + 1, n) - a) }, (_, i) => a + i), error: null };
  };
  return { build, calls };
};

test("fetchAll junta páginas além do limite", async () => {
  const { build, calls } = fakeTable(2500);
  const rows = await fetchAll(build);
  assert.equal(rows.length, 2500);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("fetchAll com múltiplo exato do tamanho faz uma consulta extra vazia", async () => {
  const { build, calls } = fakeTable(2000);
  assert.equal((await fetchAll(build)).length, 2000);
  assert.equal(calls.length, 3);
});

test("fetchAll propaga erro", async () => {
  await assert.rejects(
    fetchAll(async () => ({ data: null, error: { message: "boom" } as never })),
    /boom/,
  );
});

test("concluídas agrupa pelo dia local, não UTC", () => {
  const old = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  try {
    const t = { id: "a", status: "completed", completedAt: "2026-06-11T01:00:00Z" } as Task;
    assert.deepEqual(completedByDay([t]).map(([d]) => d), ["2026-06-10"]);
  } finally {
    if (old === undefined) delete process.env.TZ; else process.env.TZ = old;
  }
});

test("shortDate", () => assert.equal(shortDate("2026-06-10"), "10/06"));
