# Cerne — instruções para agentes de código

Cerne é um app pessoal de tarefas e produtividade, de um único usuário, inspirado no Things 3, com marca própria. O dono não é desenvolvedor: escreve em português do Brasil e espera que o agente faça sozinho tudo o que puder.

## Como falar com o dono

- Responda em português do Brasil, em linguagem simples.
- Nunca entregue comando ou valor com placeholder (`SEU-USUARIO`, `https://xxxx...`). Descubra o valor real antes.
- Quando um passo depender dele (painel do Supabase ou do Vercel), dê um passo por vez, com o nome exato do menu e do botão, e o texto pronto para copiar e colar.
- Antes de construir algo grande e ambíguo, faça poucas perguntas de escopo. Não implemente em cima de suposição.
- Não peça prints de telas que mostram chaves.

## Stack (não trocar)

- React + TypeScript + Vite.
- Zustand para todo o estado do cliente. Sem Redux, sem Context API para estado de domínio.
- Supabase (Postgres + Auth + Realtime). Sem IndexedDB/local-first.
- CSS escrito à mão, sem framework. Tokens em `src/styles/tokens.css`; o tema escuro redefine os mesmos tokens em `:root[data-theme="dark"]`. Não use cor fixa em `app.css`: crie ou reutilize um token.
- Paleta: verde petróleo `#2F6D64` como destaque, fundo papel `#FAFAF8`, fonte do sistema.

## Comandos (rodar antes de todo commit)

```bash
npx tsc -b
npm run lint
npm test
npm run build
```

- `npm test` usa o test runner nativo do Node (`node --experimental-strip-types --test tests/*.test.ts`). Sem framework externo.
- `npm run dev` sobe o Vite, mas não serve `/api`. Para a função de voz, use `npx vercel dev` ou teste no deploy.

## Estrutura

- `src/types.ts` — tipos de domínio (camelCase).
- `src/lib/` — lógica pura e testável, sem React nem Supabase: `dashboard.ts` (painel do Inbox), `board.ts` (quadro), `agenda.ts`, `calendar.ts`, `recurrence.ts`, `lenses.ts`, `backup.ts`, `search.ts`, `voice.ts`, `wav.ts`, `theme.ts`, `pomodoro.ts`, `content.ts` (calendário de conteúdo).
- `src/lib/repository/*Repository.ts` — **único** lugar que fala com o Supabase. Um arquivo por entidade.
- `src/lib/supabase/mappers.ts` — converte linhas do banco (snake_case) em tipos de domínio.
- `src/lib/supabase/config.ts` — URL e Publishable key do Supabase, embutidas.
- `src/stores/` — `dataStore` (dados), `authStore`, `uiStore` (editor, paleta, tema), `pomodoroStore`.
- `src/views/` e `src/components/` — telas e componentes.
- `api/voice.ts` — função serverless do Vercel (Gemini). Autocontida: não importa de `src/`.
- `supabase/schema.sql` e `supabase/migration_*.sql` — banco.
- `tests/` — um arquivo de teste por área de lógica.

## Direção visual (atual)

- Referência: dashboard "Online Courses" do Figma (arquivo `sxE2nmTQDejAS31MLdd2U8`). Preto, branco e cinza suave; barra lateral preta flutuante; cartões planos cinza `#f4f4f4` de raio 16, sem borda nem sombra; cartão dentro de cartão fica branco.
- Fontes: tipografia do sistema Apple (`-apple-system`, SF Pro), sem fonte web; títulos em peso 700. Nada de Inter/Rubik/Baloo. Sem texto em caixa alta, sem rótulo decorativo acima de títulos.
- Botões: primário preto, secundário com contorno preto de 2px, raio 8. Campos cinza, com borda preta só no foco.
- Cores de apoio (`--butter`, `--coral`, `--sand`, `--rose`, `--tangerine`) só em destaques pontuais, como o cabeçalho da Entrada.
- Tudo é feito por tokens em `src/styles/tokens.css` (claro e escuro). Não use cor fixa em `app.css`. A camada "Direção visual Cerne" no fim de `app.css` sobrescreve a base; mantenha ali o que for do visual.

## Regras de código

1. **Só os repositórios acessam o Supabase.** Componentes e stores chamam o repositório.
2. **Seletor do Zustand nunca filtra, mapeia nem cria objeto.** `useDataStore((s) => s.tasks.filter(...))` devolve referência nova a cada render e causa loop infinito. Selecione o array cru e filtre no corpo do componente, com as funções de `src/lib/`.
3. **Listagens usam `fetchAll`** (`src/lib/repository/util.ts`), com ordenação estável terminando em `id`. O PostgREST corta respostas em 1000 linhas.
4. **Escritas passam por `guard`** no `dataStore`. Ele conta escritas em andamento para que uma recarga do Realtime não sobrescreva o estado otimista.
5. **Lógica nova vai para `src/lib/` com teste.** Componentes ficam finos.
6. **Datas são strings locais `AAAA-MM-DD`** (`todayISO`, `addDays`). Não use `toISOString().slice(0, 10)` para o dia: isso dá o dia em UTC.
7. **Concluir uma tarefa** sempre grava `completedAt` e tira `isFocus`; reabrir limpa `completedAt`. Use `toggleComplete`, `movePatch` ou o mesmo padrão do `TaskEditor`.
8. O cliente nunca envia `user_id`: o banco preenche com `auth.uid()`.

## Banco de dados

- Todas as tabelas têm RLS: `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
- `supabase/schema.sql` é só referência para projeto novo (começa com `drop table`). **Nunca rode nem peça para rodar no banco atual: ele tem dados reais.**
- Mudança de schema = arquivo novo `supabase/migration_<nome>.sql`, **aditivo e idempotente** (`create table if not exists`, `add column if not exists`, `drop policy if exists` + `create policy`). Atualize também o `schema.sql`.
- O agente não tem acesso ao banco. O dono cola o SQL em `https://supabase.com/dashboard/project/wxcbjwhbaaqmripbdbaz/sql/new`. Entregue o SQL inteiro, pronto para colar.
- **O app precisa funcionar antes e depois da migração.** Veja `columnRepository.list()` e `isMissingTable`: se a tabela não existe, o app cai num modo compatível em vez de quebrar.
- Para conferir se uma migração rodou, sem login: `GET https://wxcbjwhbaaqmripbdbaz.supabase.co/rest/v1/<tabela>?select=id&limit=1` com o header `apikey` da Publishable key. 200 = existe; 404 `PGRST205` = não existe.
- Palavras reservadas do SQL viram outro nome de coluna: `when` → `when_kind`, `interval` → `interval_count`.

## Infraestrutura

- GitHub: `lucasrevide-art/Cerne-` (com hífen no final), branch `main`.
- Vercel: projeto `cernev2`. Todo push em `main` publica em `https://cernev2.vercel.app` em cerca de um minuto.
- Para conferir o que está no ar: baixe o `index.html`, ache `/assets/index-*.js` e procure um texto da mudança nele.
- Supabase: projeto `wxcbjwhbaaqmripbdbaz`. A URL e a Publishable key são públicas e estão em `src/lib/supabase/config.ts`. As variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` do Vercel são opcionais; não peça ao dono para mexer nelas.
- **Nunca** coloque uma chave `sb_secret_...` em código, variável `VITE_` ou commit.
- `GEMINI_API_KEY` (voz) fica só no Vercel, sem prefixo `VITE_`.

## Decisões de produto já tomadas (não desfazer sem o dono pedir)

- **Menu (barra lateral única, `AppSidebar`, igual para dono e cliente):** fundo branco, seleção em azul, grupo de bolinhas coloridas. Itens do dono: Inbox, Agenda, Prioridades, Documentos, Lixeira, Arquivados. Embaixo, as bolinhas são as pastas (áreas); ao entrar numa pasta viram os projetos dela (subprojetos), com "Todas as pastas" para voltar e "Novo subprojeto". Cliente: Inbox, Prioridades, Documentos e os projetos da pasta (sem Lixeira/Arquivados). Concluídas, Ferramentas de foco (só dono), Perfil e conta, Conta e dados e a Aparência (Claro/Escuro) ficam no menu que abre ao clicar no nome do usuário. Recolher para ícones guarda a escolha em `cerne.sidebar`. Prioridades = prioridade 2+ ou em foco (`priorityTasks`).
- **Inbox é o painel central:** reúne todas as áreas e projetos nas seções Atrasadas, Urgentes, Hoje, Próximos 7 dias, Aguardando e Sem área definida. Cada tarefa entra em uma seção só (`sectionOf` em `dashboard.ts`). A tarefa em foco aparece em destaque no topo.
- **Agenda única** com três visões: Lista, Mês e Horários (grade 6h–22h, encaixe de 15 min; bloco de tempo é `startTime` + `durationMinutes` na própria tarefa).
- **Hierarquia Área → Projeto → Tarefa.** Projeto só se cria dentro de uma área. No editor, o campo Projeto depende da Área (`projectsForArea`).
- **Quadro Kanban** existe dentro de área e de projeto (botão Quadro / Lista). É estável: nele só se movem e criam cartões. Colunas são criadas, renomeadas, reordenadas e excluídas em **Configurações → Colunas do quadro**. As colunas são globais do usuário. A coluna `is_done` conclui a tarefa e não pode ser excluída.
- **Calendário de conteúdo** dentro de cada projeto (aba Calendário, só em projeto): grade mensal começando na segunda; cada dia mostra formato (Reels, Estático, Carrossel, Story, Vídeo, Texto) e objetivo, ou "a definir". Clicar abre uma janela com título, formato, situação, data, objetivo, roteiro e legenda; salva ao fechar. Tabela `content_items` (`migration_content_calendar.sql`); sem a migração a aba mostra um aviso. Lógica em `src/lib/content.ts`. **Revisão pelo cliente:** cada conteúdo tem `content_version` (sobe quando o conteúdo muda). O cliente, convidado na área, vê no portal a aba Calendário e responde com Aprovar (verde), Pedir alteração (amarelo, texto obrigatório) ou Reprovar (vermelho), além de comentar; resposta de versão antiga vira "Mudou após a resposta". Respostas ficam em `cerne_private.content_review`, acessadas só pelas RPCs `cerne_content` e `cerne_content_summary` (`migration_content_review.sql`).
- **Compartilhar uma pasta (área) dá acesso a tudo dentro dela** (projetos, tarefas, notas, arquivos, calendários), menos itens arquivados ou na lixeira; não há chave por item. `cerne_private.item_visible` ignora as colunas `shared` (mantidas no banco, sem uso) — `migration_share_whole_area.sql`. O convite é por e-mail: ao entrar com o e-mail convidado o acesso é ligado sozinho (`claim`, `migration_access_by_email.sql`); o link também funciona. Comentários marcados como internos seguem só do dono.
- **Financeiro** não é módulo: é `type: "financial"` na tarefa, com `amount` e `category`.
- **Notas:** cada nota é um registro independente por área; o título é a primeira linha. Estão aprovadas como estão.
- **Voz:** grava WAV no navegador, a função `/api/voice` chama a Gemini, e **sempre** abre a tela de conferência antes de salvar.
- **Senha** se troca dentro do app, em Configurações.
- **Fora de escopo por enquanto:** automações, departamentos, anexos e permissões multiusuário.

## Pendências conhecidas

- A secret key do Supabase apareceu num print e ficou gravada no primeiro deploy do Vercel. O dono ainda não a apagou (Project Settings → API Keys → Secret keys). O app não usa essa chave.
- `GEMINI_API_KEY` ainda não foi cadastrada no Vercel; a voz responde com erro de chave não configurada.
- Subtarefas não podem ser renomeadas nem reordenadas.
- Não há tela para renomear ou excluir áreas e projetos.
- Desfazer a conclusão de uma tarefa recorrente não remove a próxima ocorrência já criada.

## Commits

- Mensagem em português, curta, dizendo o que mudou e por quê.
- Um commit por mudança coerente, com os quatro comandos de verificação passando.
- Depois do push, confira o deploy no ar antes de dizer que está publicado.
