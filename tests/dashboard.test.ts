import test from "node:test";
import assert from "node:assert/strict";
import { dashboard, projectsForArea, sectionOf } from "../src/lib/dashboard.ts";
import { agendaList } from "../src/lib/calendar.ts";
import type { Project, Task } from "../src/types.ts";

const base: Task = {
  id: "1", title: "t", notes: "", when: null, whenDate: null, deadline: null, status: "open",
  priority: 0, type: "default", amount: null, category: null, projectId: null, areaId: null,
  tagIds: [], isFocus: false, startTime: null, durationMinutes: null, boardStage: "todo", columnId: null,
  createdAt: "2026-01-01T00:00:00Z", completedAt: null, sortOrder: 0,
};
const mk = (p: Partial<Task>): Task => ({ ...base, ...p });
const NOW = "2026-06-10";

test("painel: cada tarefa entra em uma seção só, a mais importante", () => {
  assert.equal(sectionOf(mk({ deadline: "2026-06-01", priority: 3 }), NOW), "overdue");
  assert.equal(sectionOf(mk({ when: "date", whenDate: "2026-06-09" }), NOW), "overdue");
  assert.equal(sectionOf(mk({ priority: 2, when: "today" }), NOW), "urgent");
  assert.equal(sectionOf(mk({ when: "today", areaId: "a" }), NOW), "today");
  assert.equal(sectionOf(mk({ deadline: NOW }), NOW), "today");
  assert.equal(sectionOf(mk({ deadline: "2026-06-17", areaId: "a" }), NOW), "upcoming");
  assert.equal(sectionOf(mk({ deadline: "2026-06-18", areaId: "a" }), NOW), null);
  assert.equal(sectionOf(mk({ status: "waiting", deadline: "2026-01-01" }), NOW), "waiting");
  assert.equal(sectionOf(mk({}), NOW), "unsorted");
  assert.equal(sectionOf(mk({ areaId: "a" }), NOW), null);
  assert.equal(sectionOf(mk({ status: "completed", deadline: "2026-01-01" }), NOW), null);
});

test("painel: reúne todas as áreas, na ordem de atenção, sem seções vazias", () => {
  const s = dashboard([
    mk({ id: "a", areaId: "x", when: "today" }),
    mk({ id: "b", areaId: "y", projectId: "p", deadline: "2026-06-01" }),
    mk({ id: "c", areaId: "y", deadline: "2026-05-01" }),
    mk({ id: "d" }),
  ], NOW);
  assert.deepEqual(s.map((x) => x.id), ["overdue", "today", "unsorted"]);
  assert.deepEqual(s[0].tasks.map((t) => t.id), ["c", "b"]); // mais antiga primeiro
});

test("projeto depende da área; o projeto atual nunca some da lista", () => {
  const P = (id: string, areaId: string | null, status: Project["status"] = "active"): Project =>
    ({ id, name: id, notes: "", status, areaId, deadline: null, sortOrder: 0 });
  const ps = [P("p1", "a1"), P("p2", "a2"), P("p3", "a1", "archived")];
  assert.deepEqual(projectsForArea(ps, "a1").map((p) => p.id), ["p1"]);
  assert.deepEqual(projectsForArea(ps, null).map((p) => p.id), []);
  assert.deepEqual(projectsForArea(ps, "a1", "p2").map((p) => p.id), ["p1", "p2"]);
});

test("agenda em lista: atrasadas primeiro, depois dias em ordem", () => {
  const l = agendaList([
    mk({ id: "a", when: "date", whenDate: "2026-06-12" }),
    mk({ id: "b", deadline: "2026-06-01" }),
    mk({ id: "c", deadline: NOW }),
    mk({ id: "d", when: "date", whenDate: "2026-06-01", deadline: "2026-06-20" }),
  ], NOW);
  assert.deepEqual(l.map((g) => g.day), ["overdue", NOW, "2026-06-12", "2026-06-20"]);
  assert.deepEqual(l[0].tasks.map((t) => t.id), ["b"]);
});
