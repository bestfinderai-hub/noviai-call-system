import librosa, soundfile as sf, numpy as np

mp3 = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\lars_rolander_raw.mp3'
print('Laddar Lars Rolander MP3...')
y, sr = librosa.load(mp3, sr=None, duration=120.0)
print(f'Laddad: {len(y)/sr:.1f}s at {sr}Hz')

hop = int(sr * 0.010)
f0, voiced_flag, _ = librosa.pyin(y, fmin=60, fmax=400, sr=sr, hop_length=hop)

# Analyze full F0 distribution
voiced_f0 = f0[~np.isnan(f0)]
print(f'\nRöstkaraktäristik (120s):')
print(f'  Median F0:  {np.median(voiced_f0):.1f} Hz')
print(f'  Mean F0:    {np.mean(voiced_f0):.1f} Hz')
print(f'  Min F0:     {np.min(voiced_f0):.1f} Hz')
print(f'  Max F0:     {np.max(voiced_f0):.1f} Hz')
print(f'  Voiced%:    {len(voiced_f0)/len(f0)*100:.0f}%')
print(f'  Genus (uppskattning): {"MAN" if np.median(voiced_f0) < 180 else "KVINNA"}')

# Find best 15s clean segments (high voiced%, low F0, steady)
window = int(15.0 * sr / hop)
results = []
for i in range(0, len(f0) - window, window // 3):
    seg_f0 = f0[i:i+window]
    voiced = seg_f0[~np.isnan(seg_f0)]
    if len(voiced) < window * 0.5:
        continue
    median_f0 = float(np.median(voiced))
    std_f0 = float(np.std(voiced))
    t_start = i * hop / sr
    results.append((t_start, median_f0, std_f0, len(voiced)/window))

# Sort: deepest voice + stable (low std) + lots of voiced content
results.sort(key=lambda x: (x[1] + x[2]*0.5))
print('\nTop 5 bästa 15s-segment (djup + stabil röst):')
print('  Tid(s)   F0(Hz)  Stab(std)  Voiced%')
for t, f, s, v in results[:5]:
    print(f'  {t:5.1f}s  {f:6.1f}   {s:5.1f}      {v*100:.0f}%')

best_t = results[0][0] if results else 0.0
print(f'\nBästa start: {best_t:.1f}s')

# Save best 15s as new reference
y_full, sr2 = librosa.load(mp3, sr=22050, offset=best_t, duration=15.0)
out = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_lars_15s.wav'
sf.write(out, y_full, sr2)
print(f'Sparad: {out}')
