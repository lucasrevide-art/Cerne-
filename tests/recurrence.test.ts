import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, describe, nextOccurrence } from "../src/lib/recurrence.ts";

const r = (type: "daily" | "weekly" | "monthly" | "custom", interval = 1, weekdays: number[] = []) => ({ type, interval, weekdays });

test("diária e personalizada somam dias", () => {
  assert.equal(nextOccurrence(r("daily"), "2026-06-30"), "2026-07-01");
  assert.equal(nextOccurrence(r("custom", 10), "2026-06-25"), "2026-07-05");
});

test("mensal limita ao fim do mês", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(nextOccurrence(r("monthly"), "2026-12-15"), "2027-01-15");
  assert.equal(nextOccurrence(r("monthly", 3), "2026-11-30"), "2027-02-28");
});

test("semanal sem dias soma 7*n", () => {
  assert.equal(nextOccurrence(r("weekly", 2), "2026-06-10"), "2026-06-24");
});

test("semanal com dias escolhe o próximo dia da semana", () => {
  // 2026-06-10 é quarta. seg(1) e qua(3): próxima depois de quarta é segunda 15.
  assert.equal(nextOccurrence(r("weekly", 1, [1, 3]), "2026-06-10"), "2026-06-15");
  // segunda 15 → quarta 17
  assert.equal(nextOccurrence(r("weekly", 1, [1, 3]), "2026-06-15"), "2026-06-17");
});

test("semanal quinzenal pula a semana intermediária", () => {
  // quarta 10, dias [1,3], a cada 2 semanas: mesma semana não tem mais; próxima é segunda 22
  assert.equal(nextOccurrence(r("weekly", 2, [1, 3]), "2026-06-10"), "2026-06-22");
  // mesma semana ainda tem dia depois: segunda 8 → quarta 10
  assert.equal(nextOccurrence(r("weekly", 2, [1, 3]), "2026-06-08"), "2026-06-10");
});

test("descrição legível", () => {
  assert.equal(describe(r("daily")), "Todo dia");
  assert.equal(describe(r("weekly", 1, [3, 1])), "Toda semana (seg, qua)");
  assert.equal(describe(r("monthly", 2)), "A cada 2 meses");
});
