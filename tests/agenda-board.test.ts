import test from "node:test";
import assert from "node:assert/strict";
import { addDays, allDayOn, clampBlock, layoutDay, snap, timedOn, weekDays } from "../src/lib/agenda.ts";
import { LEGACY_COLUMNS, byColumn, canRemoveColumn, columnIdOf, dropOrder, movePatch, swapOrder, type ColumnDef } from "../src/lib/board.ts";
import type { Task } from "../src/types.ts";

const base: Task = {
  id: "1", title: "t", notes: "", when: null, whenDate: null, deadline: null, status: "open",
  priority: 0, type: "default", amount: null, category: null, projectId: null, areaId: null,
  tagIds: [], isFocus: false, startTime: null, durationMinutes: null, boardStage: "todo", columnId: null,
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

const L = LEGACY_COLUMNS;
const col = (id: string) => L.find((c) => c.id === id)!;

test("quadro (modo antigo): concluída sempre em Concluído", () => {
  const c = byColumn([mk({ id: "a", status: "completed", boardStage: "doing" }), mk({ id: "b", boardStage: "review" })], L, false);
  assert.equal(c.done.length, 1);
  assert.equal(c.review.length, 1);
});

test("quadro (modo antigo): mover para Concluído conclui; sair reabre", () => {
  assert.equal(movePatch(mk({}), col("done"), false).status, "completed");
  const p = movePatch(mk({ status: "completed" }), col("doing"), false);
  assert.deepEqual([p.status, p.boardStage, p.completedAt], ["open", "doing", null]);
});

const CUSTOM: ColumnDef[] = [
  { id: "c1", name: "Backlog", isDone: false, sortOrder: 1 },
  { id: "c2", name: "Em produção", isDone: false, sortOrder: 2 },
  { id: "c9", name: "Finalizado", isDone: true, sortOrder: 3 },
];

test("colunas livres: tarefa sem coluna (ou com coluna excluída) cai na primeira aberta", () => {
  assert.equal(columnIdOf(mk({}), CUSTOM, true), "c1");
  assert.equal(columnIdOf(mk({ columnId: "apagada" }), CUSTOM, true), "c1");
  assert.equal(columnIdOf(mk({ columnId: "c2" }), CUSTOM, true), "c2");
  assert.equal(columnIdOf(mk({ columnId: "c2", status: "completed" }), CUSTOM, true), "c9");
  // a primeira aberta é pela ordem, não pela posição no array
  const shuffled = [CUSTOM[1], CUSTOM[2], CUSTOM[0]];
  assert.equal(columnIdOf(mk({}), shuffled, true), "c1");
});

test("colunas livres: mover grava columnId; concluído conclui; sair reabre na coluna", () => {
  assert.deepEqual(movePatch(mk({}), CUSTOM[1], true), { columnId: "c2" });
  assert.equal(movePatch(mk({}), CUSTOM[2], true).status, "completed");
  assert.equal("columnId" in movePatch(mk({}), CUSTOM[2], true), false);
  const p = movePatch(mk({ status: "completed" }), CUSTOM[0], true);
  assert.deepEqual([p.status, p.columnId, p.completedAt], ["open", "c1", null]);
});

test("colunas livres: agrupar ignora canceladas e ordena", () => {
  const g = byColumn([mk({ id: "a", columnId: "c2", sortOrder: 2 }), mk({ id: "b", columnId: "c2", sortOrder: 1 }), mk({ id: "x", status: "canceled" })], CUSTOM, true);
  assert.deepEqual(g.c2.map((t) => t.id), ["b", "a"]);
  assert.equal(g.c1.length, 0);
});

test("reordenar colunas troca com a vizinha e respeita as pontas", () => {
  assert.deepEqual(swapOrder(CUSTOM, "c1", 1), [{ id: "c2", sortOrder: 1 }, { id: "c1", sortOrder: 2 }]);
  assert.deepEqual(swapOrder(CUSTOM, "c1", -1), []);
  assert.deepEqual(swapOrder(CUSTOM, "c9", 1), []);
});

test("excluir coluna: nunca a de concluído nem a última aberta", () => {
  assert.equal(canRemoveColumn(CUSTOM, "c1"), true);
  assert.equal(canRemoveColumn(CUSTOM, "c9"), false);
  assert.equal(canRemoveColumn([CUSTOM[0], CUSTOM[2]], "c1"), false);
});

test("dropOrder insere entre vizinhos", () => {
  const list = [mk({ id: "a", sortOrder: 0 }), mk({ id: "b", sortOrder: 2 })];
  assert.equal(dropOrder(list, "b", "x"), 1);
  assert.equal(dropOrder(list, "a", "x"), -1);
  assert.equal(dropOrder(list, null, "x"), 3);
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

import { boardTasks } from "../src/lib/board.ts";
import { otherTheme, resolveTheme } from "../src/lib/theme.ts";

test("quadro por escopo: projeto, área e tudo", () => {
  const now = new Date("2026-06-20T12:00:00Z");
  const ts = [
    mk({ id: "a", projectId: "p1", areaId: "a1" }),
    mk({ id: "b", areaId: "a1" }),
    mk({ id: "c" }),
    mk({ id: "d", status: "canceled" }),
    mk({ id: "velha", status: "completed", completedAt: "2026-05-01T12:00:00Z" }),
    mk({ id: "nova", status: "completed", completedAt: "2026-06-19T12:00:00Z" }),
    mk({ id: "velhaProj", projectId: "p1", status: "completed", completedAt: "2026-01-01T12:00:00Z" }),
  ];
  const ids = (s: Parameters<typeof boardTasks>[1]) => boardTasks(ts, s, now).map((t) => t.id);
  assert.deepEqual(ids({ kind: "project", id: "p1" }), ["a", "velhaProj"]);
  assert.deepEqual(ids({ kind: "area", id: "a1" }), ["a", "b"]);
  assert.deepEqual(ids({ kind: "all" }), ["a", "b", "c", "nova"]);
});

test("tema: escolha salva vence o sistema", () => {
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme(null, true), "dark");
  assert.equal(resolveTheme("lixo", false), "light");
  assert.equal(otherTheme("dark"), "light");
});
