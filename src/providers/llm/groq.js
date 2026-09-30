'use strict';

// Groq LLM provider — qwen/qwen3.8-27b or llama-3.1-8b-instant (~200-300ms)
// Requires: GROQ_API_KEY

const Groq = require('groq-sdk');
const fs   = require('fs');

let _groq;
function groq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

const MODEL      = () => process.env.GROQ_LLM_MODEL || 'qwen/qwen3.8-27b';
const MAX_TOKENS = () => parseInt(process.env.MAX_TOKENS_LLM || '150', 10);

let _cachedPrompt = null;

// Call this whenever SYSTEM_PROMPT env var changes at runtime (e.g. via admin API).
function clearPromptCache() {
  _cachedPrompt = null;
}

function loadSystemPrompt() {
  if (_cachedPrompt) return _cachedPrompt;
  const file = process.env.SYSTEM_PROMPT_FILE;
  if (file && fs.existsSync(file)) {
    _cachedPrompt = fs.readFileSync(file, 'utf-8').trim();
    return _cachedPrompt;
  }
  if (process.env.SYSTEM_PROMPT) {
    _cachedPrompt = process.env.SYSTEM_PROMPT.trim();
    return _cachedPrompt;
  }
  _cachedPrompt = DEFAULT_SYSTEM_PROMPT;
  return _cachedPrompt;
}

async function chat(history, systemPromptOverride) {
  const start = Date.now();
  const systemPrompt = systemPromptOverride || loadSystemPrompt();
  const messages = [{ role: 'system', content: systemPrompt }, ...history];

  const response = await groq().chat.completions.create({
    model: MODEL(), messages, max_tokens: MAX_TOKENS(), temperature: 0.7, stream: false,
  });

  const text = (response.choices[0]?.message?.content || '').trim();
  console.log(`[LLM:groq] ${Date.now() - start}ms → "${text.slice(0, 80)}"`);
  return text;
}

async function* chatStream(history, systemPromptOverride) {
  const systemPrompt = systemPromptOverride || loadSystemPrompt();
  const messages = [{ role: 'system', content: systemPrompt }, ...history];
  const start = Date.now();

  const stream = await groq().chat.completions.create({
    model: MODEL(), messages, max_tokens: MAX_TOKENS(), temperature: 0.7, stream: true,
  });

  let buf = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || '';
    if (!token) continue;
    buf += token;
    let match;
    while ((match = /^(.*?[.!?])\s+/.exec(buf)) !== null) {
      const sentence = match[1].trim();
      if (sentence) yield sentence;
      buf = buf.slice(match[0].length);
    }
  }
  const tail = buf.trim();
  if (tail) yield tail;
  console.log(`[LLM:groq] stream ${Date.now() - start}ms`);
}

const DEFAULT_SYSTEM_PROMPT = `Du är Sofia, NovAI AI-Telefonist för svenska småföretag.

IDENTITET
Du pratar i telefon. Du är varm, professionell och hjälpsam — aldrig robotlik.
Säg ALDRIG att du är en AI om kunden inte frågar direkt.

RÖST OCH STIL
- Max 2 meningar per svar — kortare är bättre
- Naturliga pauser och bekräftelser: "mm", "ja", "okej", "absolut"
- Tvekan är mänsklig: "eh", "alltså", "du vet"
- Vänta alltid tills kunden är klar — avbryt aldrig

HÄLSNING (säg exakt detta vid samtalets start):
"NovAI, det här är Sofia, hur kan jag hjälpa dig?"

HANTERING
- Boka tid: fråga datum och tid, bekräfta tillbaka
- Fel nummer: be dem kontakta rätt företag, avsluta artigt
- Fråga om det är AI: "Jag är en digital assistent — men jag hjälper dig gärna!"
- Kunden lägger på: avsluta omedelbart utan kommentar
- Tystnad > 5 sekunder: "Är du kvar?" — om inget svar, avsluta

GUARDRAILS
- Prata ALDRIG med en maskin, IVR eller röstbrevlåda — avsluta omedelbart
- Gissa aldrig fakta — säg "Jag kontrollerar det åt dig"
- Pressa aldrig en kund som sagt nej`;

module.exports = { chat, chatStream, clearPromptCache, loadSystemPrompt };
