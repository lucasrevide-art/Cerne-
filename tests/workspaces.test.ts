import assert from "node:assert/strict";
import test from "node:test";
import { activeTasks, inInbox, reviewLabel, workflow } from "../src/lib/workspaces.ts";
import type { Task } from "../src/types.ts";

const task = (patch: Partial<Task>): Task => ({
  id: "1", title: "Tarefa", notes: "", when: null, whenDate: null, deadline: null, status: "open",
  priority: 0, type: "default", amount: null, category: null, projectId: null, areaId: null,
  tagIds: [], isFocus: false, startTime: null, durationMinutes: null, boardStage: "todo", columnId: null,
  createdAt: "2026-01-01T00:00:00Z", completedAt: null, sortOrder: 0, ...patch,
});

test("Entrada distingue captura de uma tarefa pessoal já organizada", () => {
  assert.equal(inInbox(task({ inbox: true })), true);
  assert.equal(inInbox(task({ inbox: false })), false);
  assert.equal(inInbox(task({ inbox: true, status: "completed" })), false);
  assert.equal(inInbox(task({ when: "today" })), false);
});

test("os quadros selecionam só as colunas da área correspondente", () => {
  const columns = [
    { id: "1", areaId: null, name: "Pessoal", isDone: false, sortOrder: 1 },
    { id: "2", areaId: "a", name: "Área A", isDone: false, sortOrder: 1 },
    { id: "3", areaId: "b", name: "Área B", isDone: false, sortOrder: 1 },
  ];
  assert.deepEqual(workflow(columns, "a", true).columns.map((c) => c.id), ["2"]);
  assert.deepEqual(workflow(columns, "b", true).columns.map((c) => c.id), ["3"]);
  assert.deepEqual(workflow(columns, "b", false).columns.map((c) => c.id), ["1"]);
});

test("espaços arquivados somem da rotina e preservam as tarefas", () => {
  const active = task({ id: "active", areaId: "a" });
  const inactive = task({ id: "inactive", projectId: "p" });
  const project = { id: "p", name: "Projeto", areaId: "a", archivedAt: "2026-11-14", notes: "", status: "active", deadline: null, sortOrder: 1 } as const;
  assert.deepEqual(activeTasks([active, inactive], [], [project]), [active]);
});

test("uma aprovação se aplica à versão submetida", () => {
  assert.equal(reviewLabel({ kind: "approved", version: 1 }, 1), "Aprovado");
  assert.equal(reviewLabel({ kind: "approved", version: 1 }, 2), "Nova versão · revisão necessária");
});
