# HANDOFF — NovAI Vapi + Voice Cloning
_Sparad: 2026-10-28_

## Vad vi undersökte
Kan vi använda röstkloning (VoiceStudio/Cartesia) i noviaivapi-bygget?

## Vad som redan finns i bygget

**Cartesia är REDAN implementerat** — `src/providers/tts/cartesia.js`:
- WebSocket-streaming, ~60ms first chunk
- Använder `CARTESIA_VOICE_ID` env var (default: Barbra multilingual)
- Språk: `process.env.CALL_LANGUAGE || 'sv'` — svenska som default
- Pipeline: Cartesia MP3 → ffmpeg → mulaw 8kHz → Telnyx WS

**ElevenLabs** är också implementerat — `src/providers/tts/elevenlabs.js`

**F5-TTS** finns som lokal provider — `src/providers/tts/f5tts.js` + Python server

## Cartesia har svenska röster
- **Vidar** (man) och **Freja** (kvinna) — nativa svenska röster
- Rankat #1 i Speech Arena 2026
- Vapis default TTS-provider

## Röstkloning — hur det funkar med Cartesia
1. Spela in ~10 sek ren svenska audio (du eller valfri röst)
2. Ladda upp till Cartesia Playground → får ett `voice_id`
3. Sätt `CARTESIA_VOICE_ID=<ditt_voice_id>` i `.env`
4. Klart — systemet använder din klonade röst automatiskt

## Röstkloning — gratis alternativ (VoiceStudio)
- VoiceStudio (voicestudio.sh) är open source, kör lokalt
- Kan klona röst → men har INGEN API för live-samtal
- Kan användas för att **förbereda** en röst, exportera audio-fil
- Inte direkt integrerbart i Vapi/Telnyx-pipeline

## Nästa steg
1. Skapa Cartesia-konto: https://play.cartesia.ai/sign-up
2. Testa svenska röster Vidar/Freja i Playground
3. Klona en röst om du vill (10 sek klipp)
4. Sätt env var: `CARTESIA_VOICE_ID=<id>` + `CARTESIA_API_KEY=<key>`
5. Se till att `TTS_PROVIDER=cartesia` är satt i .env

## NÄSTA UPPGIFT — Öppen fråga att undersöka
Användaren har sett en ny open source repo på Instagram som:
- Tar en bild/foto (t.ex. person i kontorsmiljö)
- Tar en textprompt (ton, miljö, stil + text att säga)
- Genererar en **talande video** där personen säger texten
- Kan användas som reklam/marknadsföring

**Sök brett:** GitHub trending, HuggingFace, Reddit r/LocalLLaMA, Instagram AI-konton
Sökord: "talking avatar open source", "talking head video generation github 2026", "portrait animation text to video open source"
Kända kommersiella: HeyGen, D-ID, Synthesia — leta open source-alternativ

## Relevanta filer
- `src/providers/tts/cartesia.js` — redan klar, bara sätt env vars
- `src/services/tts.js` — väljer provider baserat på TTS_PROVIDER env var
- `.env` / `.env.local` — lägg till CARTESIA_API_KEY + CARTESIA_VOICE_ID
