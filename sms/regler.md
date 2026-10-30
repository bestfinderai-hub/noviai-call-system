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

| Situation | Spawna dessa agents |
|---|---|
| Nytt problem / design / arkitektur | **arkitekt** ALLTID FÖRST |
| Innan deploy / launch | **kontrollant** + **sakerhet** |
| UX / prissättning / svenska SME | **psykolog** |
| Kostnad / token-optimering | **token-optimizer** |
| Nyckelord: "dealmaker" / "leads" | arkitekt + kontrollant |
| Nyckelord: "vapi" / "röst" / "tts" | arkitekt + psykolog |
| Nyckelord: "säkerhet" / "gdpr" | sakerhet |
| Nyckelord: "review" / "granska" | kontrollant |
| Beslut om launch | ALLA 4: arkitekt + kontrollant + sakerhet + psykolog |

Agents finns i: C:\claude-pro\.claude\agents\
Spawna via Agent-verktyget i Claude Code.

---

## AGENTS

- **arkitekt** (claude-opus-4-7) — systemdesign, arkitektur, bottlenecks, skalbarhet
- **kontrollant** (claude-sonnet-4-6) — QA, 8-dim analys, blockerare, pre-deploy
- **sakerhet** (claude-sonnet-4-6) — GDPR, OWASP Top 10, credentials, PII
- **psykolog** (claude-sonnet-4-6) — UX, prissättning, svenska SME (1-10 anst.)
- **token-optimizer** (claude-haiku-4-5) — kostnad, effektivitet, prompt-optimering

---

## UNIVERSAL SKILLS

Finns i: C:\claude-pro\.claude\skills\universal\

- **auto-dokumentation** — JSDoc, README, API-docs auto-generering
- **qa-controller** — 6-stegs QA: happy path, edge cases, error handling, regression
- **pre-release-quality-gate** — final checklist innan launch, alla 4 agents godkänner
- **solution-finder** — aldrig "det går inte", alltid 3+ alternativ med trade-offs
- **functionality-validator** — end-to-end validering av alla features
- **vapi-call-quality-monitor** — latens, avbrott, transcript-kvalitet
- **vapi-config-tuner** — modell, röst, timing, prompt-optimering
- **vapi-cost-analyzer** — kostnad per samtal och per månad
- **vapi-script-optimizer** — mänskliga scripts, cold call-struktur, objection handling
- **vapi-voice-ab-tester** — A/B-test röster och scripts

---

## PROJECT SKILLS

Finns i: C:\claude-pro\.claude\skills\projects\

**DealMaker:** backend-debug (500+/dag Playwright), frontend-optimization, dashboard-charts
**Twilio:** sms-workflow, cloudflare-worker-setup
**NovAI:** website-design (F3 guld), website-performance, website-conversion
**Vapi:** voice-personality, mem0-integration, google-sheets-sync

---

## ARBETSFLÖDE

```
Problem rapporteras  →  arkitekt FÖRST  →  kontrollant  →  kod
Ny session           →  läs MEMORY.md + CLAUDE.md
Osäker               →  "Låt mig verifiera" + Glob/Read/Grep
Innan launch         →  pre-release-quality-gate (alla 4 agents)
Klar med task        →  spara till memory + radera gamla filer
```

---

## HOOKS (körs automatiskt i bakgrunden)

- **statusline** — visar modell, context%, 5h window%, git branch live
- **window-guard** — varnar vid >70%, blockerar subagents vid >85% 5h-window
- **security-scan** — blockerar git commit om credentials hittas i staged filer
- **auto-lint** — kör tsc/ruff efter varje .ts/.py-redigering
- **session-save** — sparar git-state automatiskt när session stängs

---

## PROJECT CODES (env vars: KOD_SERVICE_FÄLT)

| Projekt | Kod | | Projekt | Kod |
|---|---|-|---|---|
| NovAI Website | NOVA | | DealMaker V5 | DM |
| Peter Qred Bot | PETER | | DealMaker Web | DMW |
| Twilio Koppling | TWILIO | | B2B Campaign | B2B |
| Artister | ART | | | |

Credentials: `all_credentials.md` (single source of truth)
Architecture: `SYSTEM_ARCHITECTURE_MASTER.md`

---

## GPU-KOMMANDO

"jobba i gpu" / "kör på gpu":
- Skriv `from gpu_utils import gpu` överst i ALLA .py-filer automatiskt
- `gpu.chat(...)` för LLM-anrop
- `gpu.transcribe(...)` för STT/ljud
- Paketet är globalt — behöver inte läggas till i requirements

---

## NAMNKONVENTION

Filer med datum: `filename_vX_YYYY_MM_DD.ext` (ex: kod_v3_2026_10_16.gs)
Env vars: `PROJEKTKOD_SERVICE_FÄLT` (ex: NOVA_VAPI_API_KEY)

---

## VIKTIGA SÖKVÄGAR

| Vad | Sökväg |
|---|---|
| Memory | C:\Users\BestFinder\.claude\projects\C--claude-pro\memory\ |
| Global CLAUDE.md | C:\Users\BestFinder\.claude\CLAUDE.md |
| Agents | C:\claude-pro\.claude\agents\ |
| Skills | C:\claude-pro\.claude\skills\ |
| Hooks | C:\Users\BestFinder\.claude\hooks\ |
| Settings | C:\Users\BestFinder\.claude\settings.json |
| Credentials | C:\Users\BestFinder\.claude\projects\C--claude-pro\memory\all_credentials.md |