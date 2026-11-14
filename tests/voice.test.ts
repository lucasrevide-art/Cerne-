import test from "node:test";
import assert from "node:assert/strict";
import { decodeWavHeader } from "./helpers.ts";
import { downsample, encodeWav, toBase64 } from "../src/lib/wav.ts";
import { isValidDate, isValidTime, normalizeDraft } from "../src/lib/voice.ts";

test("WAV: cabeçalho, tamanho e clipping", () => {
  const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 16000);
  const h = decodeWavHeader(wav);
  assert.equal(h.riff, "RIFF");
  assert.equal(h.wave, "WAVE");
  assert.equal(h.sampleRate, 16000);
  assert.equal(h.channels, 1);
  assert.equal(h.bits, 16);
  assert.equal(h.dataBytes, 8);
  assert.equal(wav.length, 44 + 8);
  assert.equal(h.samples[1], 32767);
  assert.equal(h.samples[2], -32768);
  assert.equal(h.samples[3], 32767); // 2 é cortado em 1
});

test("downsample reduz pelo fator e mantém média", () => {
  const out = downsample(new Float32Array([1, 3, 5, 7]), 48000, 24000);
  assert.deepEqual([...out], [2, 6]);
  assert.equal(downsample(new Float32Array(4), 16000, 16000).length, 4);
});

test("base64 de bytes grandes não estoura a pilha", () => {
  assert.equal(toBase64(new Uint8Array(200_000)).length, Math.ceil(200_000 / 3) * 4);
});

test("validação de data e hora", () => {
  assert.ok(isValidDate("2026-02-28"));
  assert.ok(!isValidDate("2026-02-30"));
  assert.ok(!isValidDate("amanhã"));
  assert.ok(isValidTime("09:30"));
  assert.ok(!isValidTime("24:00"));
});

const ctx = {
  areas: [{ id: "a1", name: "Agências", color: "", icon: "", sortOrder: 0 }],
  projects: [{ id: "p1", name: "Site Cliente X", notes: "", status: "active" as const, areaId: "a1", deadline: null, sortOrder: 0 }],
  tags: [{ id: "t1", name: "Acme", color: "" }],
};

test("rascunho: resolve nomes sem acento, herda área do projeto, ignora tag inexistente", () => {
  const d = normalizeDraft(
    { title: "Enviar proposta", project: "site cliente x", tags: ["acme", "inventada"], date: "2026-06-11", time: "14:00", durationMinutes: 40 },
    ctx, "2026-06-10",
  );
  assert.equal(d.projectId, "p1");
  assert.equal(d.areaId, "a1");
  assert.deepEqual(d.tagIds, ["t1"]);
  assert.equal(d.durationMinutes, 45);
});

test("rascunho: data inválida some; horário sem data vira hoje; financeiro por valor", () => {
  const d = normalizeDraft({ title: "x", date: "amanhã", time: "09:00", amount: 150.5, category: "Aluguel" }, ctx, "2026-06-10");
  assert.equal(d.date, "2026-06-10");
  assert.equal(d.financial, true);
  assert.equal(d.amount, 150.5);
  const e = normalizeDraft({ title: "y", date: "lixo" }, ctx, "2026-06-10");
  assert.equal(e.date, null);
  assert.equal(e.financial, false);
  assert.equal(e.durationMinutes, null);
});
