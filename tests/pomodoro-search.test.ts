import test from "node:test";
import assert from "node:assert/strict";
import { fresh, format, isFinished, next, pause, remainingMs, start } from "../src/lib/pomodoro.ts";
import { rank, score } from "../src/lib/search.ts";

test("pomodoro: iniciar, pausar e retomar preservam o tempo", () => {
  let s = start(fresh("focus", 25), 1_000);
  assert.equal(remainingMs(s, 1_000 + 60_000), 24 * 60_000);
  s = pause(s, 1_000 + 60_000);
  assert.equal(s.running, false);
  assert.equal(remainingMs(s, 999_999_999), 24 * 60_000);
  s = start(s, 5_000_000);
  assert.equal(s.endsAt, 5_000_000 + 24 * 60_000);
});

test("pomodoro: termina e alterna modo", () => {
  const s = start(fresh("focus", 15), 0);
  assert.equal(isFinished(s, 14 * 60_000), false);
  assert.equal(isFinished(s, 15 * 60_000), true);
  assert.equal(next(s).mode, "break");
  assert.equal(next(next(s)).mode, "focus");
});

test("pomodoro: formata mm:ss arredondando para cima", () => {
  assert.equal(format(25 * 60_000), "25:00");
  assert.equal(format(61_001), "01:02");
  assert.equal(format(0), "00:00");
});

test("busca ignora acentos e caixa, exige todos os termos", () => {
  assert.ok(score("agencia", "Agências") > 0);
  assert.equal(score("foo bar", "foo baz"), 0);
  assert.ok(score("ho", "Hoje") > score("ho", "Alho"));
});

test("rank ordena por relevância", () => {
  const r = rank("re", ["Compre pão", "Revisar texto", "Ligar"], (x) => x);
  assert.deepEqual(r, ["Revisar texto", "Compre pão"]);
});
