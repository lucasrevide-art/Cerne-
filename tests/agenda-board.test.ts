import test from "node:test";
import assert from "node:assert/strict";
import { addDays, allDayOn, clampBlock, layoutDay, snap, timedOn, weekDays } from "../src/lib/agenda.ts";
import { byColumn, dropOrder, movePatch } from "../src/lib/board.ts";
import type { Task } from "../src/types.ts";

const base: Task = {
  id: "1", title: "t", notes: "", when: null, whenDate: null, deadline: null, status: "open",
  priority: 0, type: "default", amount: null, category: null, projectId: null, areaId: null,
  tagIds: [], isFocus: false, startTime: null, durationMinutes: null, boardStage: "todo",
  createdAt: "2026-01-01T00:00:00Z", completedAt: null, sortOrder: 0,
};
const mk = (p: Partial<Task>): Task => ({ ...base, ...p });

test("snap de 15 min e limites", () => {
  assert.equal(snap(8 * 60 + 7), 8 * 60);
  assert.equal(snap(8 * 60 + 8), 8 * 60 + 15);
  assert.equal(snap(0), 6 * 60);
  assert.equal(snap(23 * 60), 22 * 60);
});

test("semana começa no domingo e addDays cruza o mês", () => {
  assert.equal(weekDays("2026-06-10")[0], "2026-06-07");
  assert.equal(addDays("2026-06-30", 1), "2026-07-01");
});

test("bloco com horário vs dia inteiro", () => {
  const ts = [
    mk({ id: "a", when: "date", whenDate: "2026-06-10", startTime: "09:00" }),
    mk({ id: "b", when: "date", whenDate: "2026-06-10" }),
    mk({ id: "c", when: "date", whenDate: "2026-06-11", startTime: "09:00" }),
  ];
  assert.deepEqual(timedOn(ts, "2026-06-10").map((t) => t.id), ["a"]);
  assert.deepEqual(allDayOn(ts, "2026-06-10").map((t) => t.id), ["b"]);
});

test("sobreposição ocupa colunas lado a lado", () => {
  const p = layoutDay([
    mk({ id: "a", startTime: "09:00", durationMinutes: 60 }),
    mk({ id: "b", startTime: "09:30", durationMinutes: 60 }),
    mk({ id: "c", startTime: "11:00", durationMinutes: 30 }),
  ]);
  const g = (id: string) => p.find((x) => x.task.id === id)!;
  assert.equal(g("a").cols, 2);
  assert.notEqual(g("a").col, g("b").col);
  assert.equal(g("c").cols, 1);
});

test("clampBlock mantém dentro da grade", () => {
  assert.deepEqual(clampBlock(21 * 60 + 30, 120), { start: 20 * 60, duration: 120 });
});

test("quadro: concluída sempre em Concluído", () => {
  const c = byColumn([mk({ id: "a", status: "completed", boardStage: "doing" }), mk({ id: "b", boardStage: "review" })]);
  assert.equal(c.done.length, 1);
  assert.equal(c.review.length, 1);
});

test("mover para Concluído conclui; sair de Concluído reabre", () => {
  assert.equal(movePatch(mk({}), "done").status, "completed");
  const p = movePatch(mk({ status: "completed" }), "doing");
  assert.deepEqual([p.status, p.boardStage, p.completedAt], ["open", "doing", null]);
});

test("dropOrder insere entre vizinhos", () => {
  const col = [mk({ id: "a", sortOrder: 0 }), mk({ id: "b", sortOrder: 2 })];
  assert.equal(dropOrder(col, "b", "x"), 1);
  assert.equal(dropOrder(col, "a", "x"), -1);
  assert.equal(dropOrder(col, null, "x"), 3);
});

import { monthGrid, shiftMonth, tasksByDay } from "../src/lib/calendar.ts";

test("grade mensal tem 42 dias e começa no domingo", () => {
  const g = monthGrid("2026-06-15");
  assert.equal(g.length, 42);
  assert.equal(g[0], "2026-05-31");
  assert.ok(g.includes("2026-06-30"));
});

test("shiftMonth vira o ano", () => {
  assert.equal(shiftMonth("2026-12-10", 1), "2027-01-01");
  assert.equal(shiftMonth("2026-01-10", -1), "2025-12-01");
});

test("tasksByDay junta data e prazo sem duplicar", () => {
  const m = tasksByDay([
    mk({ id: "a", when: "date", whenDate: "2026-06-10", deadline: "2026-06-10" }),
    mk({ id: "b", deadline: "2026-06-12" }),
    mk({ id: "c", whenDate: "2026-06-10", status: "completed" }),
  ]);
  assert.equal(m.get("2026-06-10")!.length, 1);
  assert.equal(m.get("2026-06-12")!.length, 1);
});
