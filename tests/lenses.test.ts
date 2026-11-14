import test from "node:test";
import assert from "node:assert/strict";
import { completedByDay, focus, inbox, today, waiting } from "../src/lib/lenses.ts";
import type { Task } from "../src/types.ts";

const base: Task = {
  id: "1", title: "t", notes: "", when: null, whenDate: null, deadline: null, status: "open",
  priority: 0, type: "default", amount: null, category: null, projectId: null, areaId: null,
  tagIds: [], isFocus: false, startTime: null, durationMinutes: null, boardStage: "todo",
  createdAt: "2026-01-01T00:00:00Z", completedAt: null, sortOrder: 0,
};
const mk = (p: Partial<Task>): Task => ({ ...base, ...p });

test("inbox: só abertas sem área nem projeto", () => {
  const r = inbox([mk({ id: "a" }), mk({ id: "b", areaId: "x" }), mk({ id: "c", projectId: "p" })]);
  assert.deepEqual(r.map((t) => t.id), ["a"]);
});

test("hoje: when today, data vencida e prazo vencido", () => {
  const r = today([
    mk({ id: "a", when: "today" }),
    mk({ id: "b", when: "date", whenDate: "2026-06-01" }),
    mk({ id: "c", when: "date", whenDate: "2026-07-01" }),
    mk({ id: "d", deadline: "2026-05-01" }),
    mk({ id: "e", when: "someday" }),
  ], "2026-06-10");
  assert.deepEqual(r.map((t) => t.id), ["a", "b", "d"]);
});

test("foco e aguardando", () => {
  assert.equal(focus([mk({ isFocus: true }), mk({ isFocus: true, status: "completed" })]).length, 1);
  assert.equal(waiting([mk({ status: "waiting" }), mk({})]).length, 1);
});

test("concluídas agrupadas por dia, mais recente primeiro", () => {
  const r = completedByDay([
    mk({ id: "a", status: "completed", completedAt: "2026-06-01T10:00:00Z" }),
    mk({ id: "b", status: "completed", completedAt: "2026-06-02T10:00:00Z" }),
  ]);
  assert.deepEqual(r.map(([d]) => d), ["2026-06-02", "2026-06-01"]);
});
