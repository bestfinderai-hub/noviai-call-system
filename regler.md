# REGLER — LÄST OCH FÖRSTÅTT

När du läser detta, svara: "Regler laddade. Redo."
Sedan kör du direkt utan att fråga om tillstånd.

---

## ABSOLUTA REGLER — BRYTS ALDRIG

1. **Aldrig gissa** — verifiera med Glob/Read/Grep innan du påstår något
2. **Aldrig ljuga** — vet du inte? Säg "Låt mig verifiera" och kolla
3. **Aldrig hoppa över** — finns inget svar direkt? Sök tills du hittar lösningen
4. **Aldrig fråga om tillåtelse** att läsa filer, köra Bash/PowerShell/MCP — kör direkt
5. **Alltid hitta bästa lösningen** — lista alternativ, jämför, välj bäst
6. **Alltid använda rätt agent** — se AGENT-TRIGGERS nedan, spawna automatiskt
7. **Radera felaktigt** — ny version bekräftad? Radera gamla versioner direkt

---

## FULL AUTONOMY (alltid aktiv)

✅ Kör direkt: Bash, PowerShell, git commit/push/branch, Vercel deploy, npm install/build,
   läsa/skriva/editera filer, alla MCP-verktyg, DB migrations, webhooks, API routes

❌ Fråga alltid först: git reset --hard, force push till main,
   prod secrets rotation, radering av user-data

---

## AGENT-TRIGGERS — SPAWNA AUTOMATISKT

| Situation | Spawna |
|---|---|
| Nytt problem / design / arkitektur | **arkitekt** ALLTID FÖRST |
| Innan deploy / launch | **kontrollant** + **sakerhet** |
| UX / prissättning / svenska SME | **psykolog** |
| Kostnad / token-optimering | **token-optimizer** |
| Next.js / App Router / RSC | **next-expert** |
| Supabase / RLS / migration | **supabase-expert** |
| Python / FastAPI / scraping | **python-expert** |
| B2B / mejl / outreach / copy | **b2b-sales** |
| "vapi" / "röst" / "tts" | arkitekt + **voice-ai** + psykolog |
| "säkerhet" / "gdpr" | **sakerhet** |
| "review" / "granska" | **kontrollant** |
| Beslut om launch | ALLA 4: arkitekt + kontrollant + sakerhet + psykolog |

Agents: C:\claude-pro\.claude\agents\ och C:\Users\BestFinder\.claude\agents\

---

## AGENTS (10 st)

| Agent | Modell | Specialitet |
|---|---|---|
| **arkitekt** | claude-opus-4-7 | systemdesign, arkitektur, bottlenecks, skalbarhet |
| **kontrollant** | claude-sonnet-4-6 | QA, 8-dim analys, blockerare, pre-deploy |
| **sakerhet** | claude-sonnet-4-6 | GDPR, OWASP Top 10, credentials, PII |
| **psykolog** | claude-sonnet-4-6 | UX, prissättning, svenska SME (1-10 anst.) |
| **token-optimizer** | claude-haiku-4-5 | kostnad, effektivitet, prompt-optimering |
| **next-expert** | claude-sonnet-4-6 | Next.js 15+, App Router, RSC, Turbopack |
| **supabase-expert** | claude-sonnet-4-6 | RLS, migrations, Edge Functions, PostgreSQL |
| **python-expert** | claude-sonnet-4-6 | FastAPI, async, scraping, Pydantic v2 |
| **b2b-sales** | claude-sonnet-4-6 | kalla mejl, outreach, svensk SME-copy |
| **voice-ai** | claude-sonnet-4-6 | Vapi, TTS/STT, latens, Telnyx/Twilio |

---

## HOOKS (körs automatiskt)

| Hook | Trigger | Funktion |
|---|---|---|
| **security-scan** | Bash: git commit | Blockerar om credentials i staged filer |
| **auto-lint** | Edit/Write | Kör tsc/ruff efter .ts/.py-redigering |
| **prompt-memory-inject** | Varje prompt "hej/hi" | Påminner om MEMORY.md vid sessionsstart |
| **session-save** | Stop | Sparar git-state när session stängs |
| **post-tool-batch** | PostToolBatch | Batch-actions efter tool-körningar |
| **window-guard** | Prompt/Task | Varnar >70% context, blockerar >85% 5h-window |
| **statusline** | Alltid | Visar modell, context%, git branch live |
| **codebase-memory** | Grep/Glob/Read | Augmenterar med kodgraf automatiskt |
| **permission-denied** | Nekad åtgärd | Loggar och eskalerar nekade permissions |

Hooks: C:\Users\BestFinder\.claude\hooks\

---

## MCP-SERVRAR (aktiva)

| Server | Används för |
|---|---|
| **playwright** | Visuella tester, skärmdumpar, UI-validering |
| **vercel** | Deploy, logs, env vars, domains (200+ verktyg) |
| **vapi** | Voice assistants, calls, tools |
| **github** | PR-hantering, issues, kodsökning |
| **firecrawl** | Webscraping, research, konkurrentanalys |
| **codebase-memory** | Kodarkitektur, call chains, impact analysis |
| **claude-docs** | Living docs, collaboration |

---

## PATH-SCOPED RULES

Laddas automatiskt vid redigering av matchande filer (C:\claude-pro\.claude\rules\):

| Filer | Regel | Vad den täcker |
|---|---|---|
| `**/*.py` | 01-python-gpu.md | gpu_utils import, ruff, type hints |
| `**/*.ts`, `**/*.tsx` | 02-nextjs-typescript.md | Tailwind v4, RSC, env prefix |
| `**/api/**`, `**/*auth*` | 03-api-security.md | OWASP, RLS, webhooks, GDPR |
| `**/vapi*`, `**/voice*` | 04-vapi-voice.md | TTS priority, latens, STT-config |

---

## SKILLS

Universal (C:\claude-pro\.claude\skills\):
- **qa-controller** — 6-stegs QA: happy path, edge cases, error handling, regression
- **pre-release-quality-gate** — final checklist, alla 4 agents godkänner
- **solution-finder** — aldrig "det går inte", alltid 3+ alternativ med trade-offs
- **functionality-validator** — end-to-end validering av alla features
- **auto-dokumentation** — JSDoc, README, API-docs auto-generering

---

## ARBETSFLÖDE

```
Problem rapporteras  →  arkitekt FÖRST  →  kontrollant  →  kod
Ny session           →  läs MEMORY.md + CLAUDE.md
Osäker               →  "Låt mig verifiera" + Glob/Read/Grep
Innan launch         →  kontrollant + sakerhet (alla 4 vid launch)
Klar med task        →  spara till memory + radera gamla filer
```

---

## PROJECT CODES (env vars: KOD_SERVICE_FÄLT)

| Projekt | Kod | | Projekt | Kod |
|---|---|-|---|---|
| NovAI Website | NOVA | | DealMaker V5 | DM |
| Peter Qred Bot | PETER | | DealMaker Web | DMW |
| Twilio Koppling | TWILIO | | B2B Campaign | B2B |
| Artister | ART | | | |

Credentials: `all_credentials.md` (single source of truth)

---

## GPU-KOMMANDO

"jobba i gpu" / "kör på gpu":
- `from gpu_utils import gpu` överst i ALLA .py-filer automatiskt
- `gpu.chat(...)` för LLM-anrop, `gpu.transcribe(...)` för STT
- Paketet är globalt — behöver inte läggas till i requirements

---

## NAMNKONVENTION

Filer med datum: `filename_vX_YYYY_MM_DD.ext`
Env vars: `PROJEKTKOD_SERVICE_FÄLT` (ex: NOVA_VAPI_API_KEY)

---

## VIKTIGA SÖKVÄGAR

| Vad | Sökväg |
|---|---|
| **Regler (global)** | C:\Users\BestFinder\.claude\regler.md |
| Global CLAUDE.md | C:\Users\BestFinder\.claude\CLAUDE.md |
| Memory | C:\Users\BestFinder\.claude\projects\C--claude-pro\memory\ |
| Agents (global) | C:\Users\BestFinder\.claude\agents\ |
| Agents (workspace) | C:\claude-pro\.claude\agents\ |
| Rules | C:\claude-pro\.claude\rules\ |
| Skills | C:\claude-pro\.claude\skills\ |
| Hooks | C:\Users\BestFinder\.claude\hooks\ |
| Settings | C:\Users\BestFinder\.claude\settings.json |
| Credentials | C:\Users\BestFinder\.claude\projects\C--claude-pro\memory\all_credentials.md |
