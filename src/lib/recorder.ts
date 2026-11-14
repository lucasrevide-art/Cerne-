import { downsample, encodeWav, toBase64 } from "./wav.ts";

export const MAX_SECONDS = 75;
const TARGET_RATE = 16000;

/** Grava microfone via Web Audio e entrega WAV 16 kHz mono (base64). */
export class Recorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    source.connect(this.node);
    this.node.connect(this.ctx.destination);
  }

  /** Para a gravação e devolve o áudio em base64, ou null se ficou vazio. */
  async stop(): Promise<{ base64: string; seconds: number } | null> {
    const rate = this.ctx?.sampleRate ?? TARGET_RATE;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const all = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) { all.set(c, o); o += c.length; }
    this.chunks = [];
    this.ctx = null; this.stream = null; this.node = null;
    if (total < rate * 0.5) return null; // menos de meio segundo
    const wav = encodeWav(downsample(all, rate, TARGET_RATE), Math.min(rate, TARGET_RATE));
    return { base64: toBase64(wav), seconds: total / rate };
  }

  cancel() {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.chunks = [];
  }
}
