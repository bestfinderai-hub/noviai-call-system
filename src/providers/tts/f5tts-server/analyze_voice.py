import librosa, soundfile as sf, numpy as np, urllib.request

url = 'https://mhdownload.riksdagen.se/VOD1/HD/2442611100058341721_aud.mp3'
outmp3 = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\utrikes_sample.mp3'
print('Downloading first 4MB...')
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=60) as resp:
    data = resp.read(4 * 1024 * 1024)
with open(outmp3, 'wb') as f:
    f.write(data)
print(f'Got {len(data)//1024}KB')

y, sr = librosa.load(outmp3, sr=None, duration=90.0)
print(f'Loaded: {len(y)/sr:.1f}s at {sr}Hz')

hop = int(sr * 0.010)
f0, voiced_flag, _ = librosa.pyin(y, fmin=60, fmax=400, sr=sr, hop_length=hop)

window = int(10.0 * sr / hop)
results = []
for i in range(0, len(f0) - window, window // 2):
    seg_f0 = f0[i:i+window]
    voiced = seg_f0[~np.isnan(seg_f0)]
    if len(voiced) < window * 0.3:
        continue
    median_f0 = float(np.median(voiced))
    t_start = i * hop / sr
    results.append((t_start, median_f0, len(voiced)/window))

results.sort(key=lambda x: x[1])
print('\nTop 10 deepest voice windows (10s):')
print('  Time(s)  F0(Hz)  Voiced%  Gender?')
for t, f, v in results[:10]:
    gender = 'MALE' if f < 180 else 'FEMALE'
    print(f'  {t:5.1f}s  {f:6.1f}  {v*100:.0f}%  {gender}')
