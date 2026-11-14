import assert from "node:assert/strict";
import test from "node:test";
import { activeTasks, inInbox, reviewLabel, workflow } from "../src/lib/workspaces.ts";
import { inboxSections } from "../src/lib/inbox.ts";
import { tasksByDay } from "../src/lib/calendar.ts";

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

test("Entrada mostra compromissos e prazos uma vez, incluindo atrasos de tarefas em espera", () => {
  const sections = inboxSections([
    task({ id: "atrasada", deadline: "2026-11-13", status: "waiting" }),
    task({ id: "hoje", when: "today", startTime: "10:00" }),
    task({ id: "agenda", when: "date", whenDate: "2026-11-16", startTime: "09:00", deadline: "2026-11-17" }),
    task({ id: "prazo", deadline: "2026-11-21" }),
    task({ id: "mais-tarde", deadline: "2026-11-22" }),
    task({ id: "captura", inbox: true }),
    task({ id: "prioridade", priority: 3 }),
    task({ id: "concluída", deadline: "2026-11-13", status: "completed" }),
  ], "2026-11-14");
  assert.deepEqual(sections.overdue.map(({ task }) => task.id), ["atrasada"]);
  assert.equal(sections.today[0]?.scheduled, "2026-11-14");
  assert.deepEqual(sections.upcoming.map(({ task }) => task.id), ["agenda", "prazo"]);
  assert.deepEqual(sections.capture.map(({ task }) => task.id), ["captura"]);
  assert.deepEqual(sections.later.map(({ task }) => task.id), ["mais-tarde"]);
  assert.deepEqual(sections.priority.map(({ task }) => task.id), ["prioridade"]);
  assert.equal(sections.waiting.length, 0);
});

test("Agenda mensal reúne compromissos de hoje e prazos no mesmo dia sem duplicação", () => {
  const now = "2026-11-14";
  const meeting = task({ id: "reunião", when: "today", startTime: "11:00", deadline: now });
  assert.deepEqual(tasksByDay([meeting], now).get(now), [meeting]);
});
