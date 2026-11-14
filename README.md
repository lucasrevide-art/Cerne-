# Cerne

React + TS + Vite, Zustand, Supabase. Ordem de setup: GitHub → Supabase (rodar `supabase/schema.sql`) → Vercel (env vars ANTES do 1º deploy).

Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Publishable key). Variável Vite só vale em build novo.

Comandos: `npm run dev | build | test | lint`.

## Voz (Gemini)

`api/voice.ts` é uma função serverless do Vercel. Env vars no Vercel (sem prefixo `VITE_` para a chave da IA):
`GEMINI_API_KEY` (Google AI Studio, plano gratuito). A função também lê `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` para validar o login.
`npm run dev` (Vite) não serve `/api`; para testar a voz localmente use `npx vercel dev`, ou teste direto no deploy.
Toda tarefa por voz passa por uma tela de conferência antes de ser salva.
