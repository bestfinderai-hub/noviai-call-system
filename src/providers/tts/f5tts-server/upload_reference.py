import urllib.request, json, base64

import os
HF_TOKEN = os.environ.get('HF_TOKEN', '')
REPO = 'bestfinderai/f5tts-swedish-male'
wav_path = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_new.wav'

with open(wav_path, 'rb') as f:
    wav_bytes = f.read()

b64 = base64.b64encode(wav_bytes).decode()

payload = json.dumps({
    'message': 'Update reference audio: cleaner 15s segment (F0=116Hz, flatness=0.0136, voiced=81%)',
    'content': b64,
    'encoding': 'base64'
}).encode('utf-8')

req = urllib.request.Request(
    f'https://huggingface.co/api/repos/{REPO}/upload/main/reference.wav',
    data=payload,
    headers={
        'Authorization': 'Bearer ' + HF_TOKEN,
        'Content-Type': 'application/json'
    },
    method='POST'
)
# Actually use the correct HF upload endpoint
req2 = urllib.request.Request(
    f'https://huggingface.co/api/{REPO}/upload/main',
    data=wav_bytes,
    headers={
        'Authorization': 'Bearer ' + HF_TOKEN,
        'Content-Type': 'audio/wav',
        'X-Filename': 'reference.wav'
    },
    method='POST'
)

try:
    resp = urllib.request.urlopen(req2, timeout=30)
    result = json.loads(resp.read())
    print('Upload OK:', result)
except Exception as e:
    print('Error:', e)
    # Try alternate endpoint
    try:
        from urllib.request import urlopen
        # Use the HF datasets/models file upload API
        req3 = urllib.request.Request(
            f'https://huggingface.co/api/models/{REPO}/upload/reference.wav',
            data=wav_bytes,
            headers={
                'Authorization': 'Bearer ' + HF_TOKEN,
            },
            method='PUT'
        )
        resp3 = urlopen(req3, timeout=30)
        print('Alt upload:', resp3.status)
    except Exception as e2:
        print('Alt error:', e2)
