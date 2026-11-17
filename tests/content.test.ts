import test from "node:test";
import assert from "node:assert/strict";
import {
  contentByDate, draftChanged, draftHasContent, emptyDraft, longDate, monthCells, monthTitle, nextTitle, weekOfMonth, weekdayShort,
} from "../src/lib/content.ts";
import type { ContentItem } from "../src/types.ts";

const item = (o: Partial<ContentItem>): ContentItem => ({
  id: "a", projectId: "p", date: "2026-11-11", title: "", format: "reels", status: "idea",
  objective: "", script: "", caption: "", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", ...o,
});

test("novembro de 2026 começa num domingo e a grade alinha o dia 1 na coluna Dom", () => {
  const cells = monthCells("2026-11-01");
  assert.equal(cells.slice(0, 6).every((c) => c === null), true);
  assert.equal(cells[6], "2026-11-01");
  assert.equal(cells.filter(Boolean).length, 30);
  assert.equal(cells.at(-1), "2026-11-30");
});

test("mês que começa na segunda não tem células vazias no início", () => {
  assert.equal(monthCells("2026-06-15")[0], "2026-06-01");
});

test("semana do mês conta pelas segundas (11/11/2026 é semana 2)", () => {
  assert.equal(weekOfMonth("2026-11-01"), 1);
  assert.equal(weekOfMonth("2026-11-02"), 1);
  assert.equal(weekOfMonth("2026-11-08"), 1);
  assert.equal(weekOfMonth("2026-11-09"), 2);
  assert.equal(weekOfMonth("2026-11-11"), 2);
  assert.equal(weekOfMonth("2026-11-30"), 5);
});

test("rótulos de data em português", () => {
  assert.equal(longDate("2026-11-11"), "Quarta, 11 de Novembro");
  assert.equal(weekdayShort("2026-11-02"), "Seg");
  assert.equal(monthTitle("2026-11-01"), "Novembro 2026");
});

test("agrupa por dia e mantém a ordem de criação", () => {
  const map = contentByDate([
    item({ id: "b", createdAt: "2026-11-02T10:00:00Z" }),
    item({ id: "a", createdAt: "2026-11-01T10:00:00Z" }),
    item({ id: "c", date: "2026-11-12" }),
  ]);
  assert.deepEqual(map.get("2026-11-11")?.map((i) => i.id), ["a", "b"]);
  assert.equal(map.get("2026-11-12")?.length, 1);
});

test("título automático e rascunho vazio não são guardados", () => {
  assert.equal(nextTitle([item({}), item({ id: "b" })]), "Conteúdo 3");
  const d = emptyDraft("2026-11-11", "Conteúdo 3");
  assert.equal(draftHasContent(d, "Conteúdo 3"), false);
  assert.equal(draftHasContent({ ...d, objective: "Alcance" }, "Conteúdo 3"), true);
  assert.equal(draftHasContent({ ...d, title: "Outro nome" }, "Conteúdo 3"), true);
  assert.equal(draftChanged(d, { ...d }), false);
  assert.equal(draftChanged(d, { ...d, format: "story" }), true);
});

import { needsAnswer, verdictOf } from "../src/lib/content.ts";

test("situação diante do cliente", () => {
  assert.equal(verdictOf(false, 1, null), null);
  assert.equal(verdictOf(true, 1, null), "waiting");
  assert.equal(verdictOf(true, 1, { kind: "approved", version: 1 }), "approved");
  assert.equal(verdictOf(true, 1, { kind: "changes", version: 1 }), "changes");
  assert.equal(verdictOf(true, 1, { kind: "rejected", version: 1 }), "rejected");
  // o conteúdo mudou depois da resposta: a resposta antiga não vale mais
  assert.equal(verdictOf(true, 2, { kind: "approved", version: 1 }), "stale");
});

test("conta o que ainda precisa de resposta na versão atual", () => {
  assert.equal(needsAnswer([
    { content_version: 1, review: null },
    { content_version: 2, review: { version: 1 } },
    { content_version: 1, review: { version: 1 } },
  ]), 2);
});
