import test from "node:test";
import assert from "node:assert/strict";
import { attentionCount, displayName, dotColor, initial, openCount, priorityTasks } from "../src/lib/sidebar.ts";
import type { Task } from "../src/types.ts";

const base: Task = {
  id: "1", title: "t", notes: "", when: null, whenDate: null, deadline: null, status: "open",
  priority: 0, type: "default", amount: null, category: null, projectId: null, areaId: "a",
  tagIds: [], isFocus: false, startTime: null, durationMinutes: null, boardStage: "todo", columnId: null,
  createdAt: "2026-01-01T00:00:00Z", completedAt: null, sortOrder: 0,
};
const task = (p: Partial<Task>): Task => ({ ...base, ...p });

test("nome vem do perfil ou do e-mail", () => {
  assert.equal(displayName("andre.rosa@x.com", "  André Rosa "), "André Rosa");
  assert.equal(displayName("andre.rosa@x.com"), "Andre Rosa");
  assert.equal(displayName(undefined), "Minha conta");
  assert.equal(initial("andré"), "A");
});

test("cor da bolinha: própria ou da paleta, repetindo depois da sexta", () => {
  assert.equal(dotColor("#ff0000", 0), "#ff0000");
  assert.equal(dotColor("", 0), "var(--dot-1)");
  assert.equal(dotColor(undefined, 7), "var(--dot-2)");
});

test("prioridades: alta ou em foco, só abertas, foco primeiro", () => {
  const list = priorityTasks([
    task({ id: "a", priority: 2 }), task({ id: "b", priority: 3 }), task({ id: "c", priority: 0 }),
    task({ id: "d", priority: 0, isFocus: true }), task({ id: "e", priority: 3, status: "completed" }),
  ]);
  assert.deepEqual(list.map((t) => t.id), ["d", "b", "a"]);
});

test("contadores", () => {
  const now = "2026-11-17";
  assert.equal(attentionCount([
    task({ id: "a", deadline: "2026-11-10" }), task({ id: "b", priority: 2 }), task({ id: "c", when: "today" }), task({ id: "d" }),
  ], now), 3);
  assert.equal(openCount([task({}), task({ id: "x", status: "completed" }), task({ id: "y", status: "waiting" })]), 2);
});
