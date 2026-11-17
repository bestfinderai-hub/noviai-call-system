import urllib.request, json

api_key = os.environ.get('GROQ_API_KEY', '')
wav_path = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_new.wav'

with open(wav_path, 'rb') as f:
    wav_data = f.read()

boundary = 'GroqBoundary12345'
CRLF = b'\r\n'

parts = []
parts.append(('--' + boundary).encode() + CRLF)
parts.append(b'Content-Disposition: form-data; name="file"; filename="ref.wav"' + CRLF)
parts.append(b'Content-Type: audio/wav' + CRLF + CRLF)
parts.append(wav_data + CRLF)
parts.append(('--' + boundary).encode() + CRLF)
parts.append(b'Content-Disposition: form-data; name="model"' + CRLF + CRLF)
parts.append(b'whisper-large-v3' + CRLF)
parts.append(('--' + boundary).encode() + CRLF)
parts.append(b'Content-Disposition: form-data; name="language"' + CRLF + CRLF)
parts.append(b'sv' + CRLF)
parts.append(('--' + boundary + '--').encode() + CRLF)

body = b''.join(parts)

req = urllib.request.Request(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    data=body,
    headers={
        'Authorization': 'Bearer ' + api_key,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
    }
)
resp = urllib.request.urlopen(req, timeout=30)
result = json.loads(resp.read())
print('Transkription:')
print(result.get('text', '?'))
