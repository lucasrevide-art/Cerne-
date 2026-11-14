import test from "node:test";
import assert from "node:assert/strict";
import { TABLES, buildBackup, chunk, parseBackup, stripOwner, summarize, type Tables } from "../src/lib/backup.ts";

const empty = (): Tables => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Tables;

test("backup ida e volta preserva as tabelas", () => {
  const t = empty();
  t.areas = [{ id: "a", name: "Pessoal" }];
  const parsed = parseBackup(JSON.stringify(buildBackup(t)));
  assert.deepEqual(parsed.areas, t.areas);
});

test("rejeita JSON inválido, arquivo alheio e backup incompleto", () => {
  assert.throws(() => parseBackup("{"), /JSON/);
  assert.throws(() => parseBackup('{"app":"outro"}'), /não é um backup/);
  assert.throws(() => parseBackup('{"app":"cerne","version":2,"tables":{}}'), /Versão/);
  assert.throws(() => parseBackup('{"app":"cerne","version":1,"tables":{"areas":[]}}'), /falta a tabela/);
});

test("stripOwner remove user_id; chunk divide; summarize resume", () => {
  assert.deepEqual(stripOwner([{ id: 1, user_id: "u" }]), [{ id: 1 }]);
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  const t = empty();
  t.tasks = [{}, {}];
  assert.equal(summarize(t), "2 tasks");
  assert.equal(summarize(empty()), "nenhum registro");
});

test("ordem das tabelas põe pais antes de filhos", () => {
  assert.ok(TABLES.indexOf("tasks") < TABLES.indexOf("task_tags"));
  assert.ok(TABLES.indexOf("areas") < TABLES.indexOf("projects"));
});

import { forTask, progress } from "../src/lib/subtasks.ts";
import type { Subtask } from "../src/types.ts";

test("subtarefas: ordena e conta progresso por tarefa", () => {
  const s = (id: string, taskId: string, status: Subtask["status"], sortOrder: number): Subtask => ({ id, taskId, title: id, status, sortOrder });
  const all = [s("b", "t1", "completed", 2), s("a", "t1", "open", 1), s("x", "t2", "open", 0)];
  assert.deepEqual(forTask(all, "t1").map((x) => x.id), ["a", "b"]);
  assert.deepEqual(progress(all, "t1"), { done: 1, total: 2 });
  assert.deepEqual(progress(all, "nada"), { done: 0, total: 0 });
});

test("backup antigo sem board_columns ainda é aceito", () => {
  const t = empty();
  const old = buildBackup(t) as unknown as { tables: Record<string, unknown> };
  delete old.tables.board_columns;
  assert.deepEqual(parseBackup(JSON.stringify(old)).board_columns, []);
  assert.ok(TABLES.indexOf("board_columns") < TABLES.indexOf("tasks"));
});

import { isMissingTable } from "../src/lib/repository/util.ts";

test("detecta tabela ausente pelo erro do Supabase", () => {
  assert.ok(isMissingTable({ code: "PGRST205", message: "Could not find the table 'public.board_columns' in the schema cache" }));
  assert.ok(isMissingTable(new Error("Could not find the table 'public.x' in the schema cache")));
  assert.ok(!isMissingTable({ code: "42501", message: "permission denied" }));
  assert.ok(!isMissingTable(null));
});
