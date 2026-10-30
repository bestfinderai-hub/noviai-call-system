# NovAI SMS Gateway

Gratis SMS via Android-telefon med flatrate-abonnemang. Telnyx som fallback.

---

## Arkitektur

```
Dashboard / API
     │
     ▼
POST /sms/send
     │
     ├─── Android gateway (primär) ──► SIM-kort ──► Gratis via flatrate
     │         http://192.168.x.x:8080
     │
     └─── Telnyx API (fallback) ──────────────────► $0.033/SMS (Sverige)
```

Inkommande SMS flödar åt andra hållet:
```
Android-telefon ──► POST /sms/webhook ──► DB + auto opt-out vid STOPP
Telnyx          ──► POST /webhooks/telnyx (message.received) ──► DB
```

---

## Filer

| Fil | Beskrivning |
|-----|-------------|
| `src/services/sms.js` | Kärnan — send, retry, opt-out, sanitize |
| `src/routes/sms.js` | REST API routes |
| `src/routes/dashboard.js` | SMS-paneler i webbdashboard |
| `src/db.js` | `novai_sms` + `novai_sms_opted_out` tabeller |
| `src/server.js` | `/sms` router monterad + GDPR retention |
| `src/webhooks.js` | Telnyx `message.received` → `saveIncomingSms()` |

---

## Env vars

Lägg till i `.env`:

```env
# Android gateway (primär)
ANDROID_GATEWAY_URL=http://192.168.1.100:8080
ANDROID_GATEWAY_USER=user
ANDROID_GATEWAY_PASS=ditt-losenord

# Webhook från Android-appen (OBLIGATORISK)
ANDROID_WEBHOOK_SECRET=slumpa-en-lång-sträng

# Telnyx (fallback)
SMS_FROM_NUMBER=+46851791777

# Routing: auto | android | telnyx  (default: auto)
SMS_PROVIDER=auto

# GDPR: radera SMS äldre än X dagar (default: 90, sätt 0 för att stänga av)
SMS_RETENTION_DAYS=90
```

---

## Android-app setup

1. Ladda ner APK från https://github.com/capcom6/android-sms-gateway/releases
2. Installera på Android-telefon med aktivt SIM-kort
3. Öppna appen → **Local Server** → aktivera
4. Notera IP:port (t.ex. `192.168.1.100:8080`)
5. Sätt `ANDROID_GATEWAY_URL` i `.env`
6. Ställ in Webhook i appen: `POST https://din-server.se/sms/webhook` + header `X-SMS-Secret: ditt-secret`

**Cloud-läge** (telefonen är inte på samma nätverk):
- Skapa konto på https://sms-gate.app
- Använd `ANDROID_GATEWAY_URL=https://api.sms-gate.app`

---

## API reference

Alla endpoints kräver `Authorization: Bearer NOVA_ADMIN_TOKEN` utom webhook.

### Skicka SMS
```http
POST /sms/send
Content-Type: application/json

{
  "to": "+46701234567",
  "message": "Hej från NovAI!",
  "provider": "auto"   // optional: auto | android | telnyx
}
```

### Loggar
```http
GET /sms/logs?limit=50&offset=0&direction=out&phone=+46701234567
```

### Statistik
```http
GET /sms/stats
```

Svar:
```json
{
  "total_out": 142,
  "total_in": 23,
  "today_out": 8,
  "today_in": 2,
  "total_failed": 1,
  "via_android": 130,
  "via_telnyx": 12
}
```

### Enhetsstatus
```http
GET /sms/device
```

### GDPR — opt-out
```http
GET    /sms/opted-out           # lista blockerade nummer
POST   /sms/opted-out           # blockera { "phone": "+46...", "reason": "manual" }
DELETE /sms/opted-out/+46701234567   # häv blockering
```

### Inkommande webhook (från Android-appen)
```http
POST /sms/webhook
X-SMS-Secret: ditt-secret
Content-Type: application/json

{
  "from": "+46701234567",
  "message": "STOPP"
}
```

---

## GDPR

- **Opt-out:** Svarar mottagaren "STOPP" (eller stop/avregistrera/unsubscribe/quit/avsluta) blockeras de automatiskt
- **Blocklist:** `novai_sms_opted_out` tabell — kontrolleras INNAN varje utskick
- **Retention:** SMS raderas automatiskt efter `SMS_RETENTION_DAYS` dagar (default 90)
- **Marknadsföringslagen 19 §:** Alltid inkludera avregistreringsinstruktion i marknadsmeddelanden

---

## Alphanumerisk avsändare ("NovAI" istället för nummer)

Android-gatewayen **kan inte** skicka alphanumerisk avsändare — det styrs av operatörens SMSC.

För att använda "NovAI" som avsändare:
- Använd Telnyx (redan integrerat) — kräver Level 2-kontoverifiering
- Ändra `from` i `sendViaTelnyx()` i `src/services/sms.js`
- OBS: Alphanumerisk = **envägs** — mottagare kan inte svara. Lägg STOPP-URL i meddelandet.

---

## Dashboard

SMS-sektionen nås via sidebar i `/dashboard`:
- **Skicka SMS** — enhetsstatus, meddelandeformulär, provider-val
- **SMS Logg** — statistikkort + tabell (in/ut, provider, status)

Teckensräknaren visar GSM-7 (160 tecken/segment) vs Unicode/emoji (70 tecken/segment).
