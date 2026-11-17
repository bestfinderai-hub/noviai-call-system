import librosa, numpy as np, soundfile as sf

mp3 = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\lars_rolander_raw.mp3'
print('Laddar full fil (780s)...')
y, sr = librosa.load(mp3, sr=22050)
print(f'Laddad: {len(y)/sr:.1f}s')

hop = int(sr * 0.010)
print('Analyserar F0...')
f0, _, _ = librosa.pyin(y, fmin=70, fmax=300, sr=sr, hop_length=hop)
rms = librosa.feature.rms(y=y, frame_length=int(sr*0.025), hop_length=hop)[0]
flat = librosa.feature.spectral_flatness(y=y, hop_length=hop)[0]

# Score every 15s window
window = int(15.0 * sr / hop)
results = []
for i in range(0, len(f0) - window, window // 4):
    seg_f0 = f0[i:i+window]
    seg_rms = rms[i:min(i+window, len(rms))]
    seg_flat = flat[i:min(i+window, len(flat))]

    voiced = seg_f0[~np.isnan(seg_f0)]
    if len(voiced) < window * 0.55:  # Minst 55% tal
        continue

    median_f0 = float(np.median(voiced))
    if median_f0 > 180:  # Uteslut kvinnliga röster
        continue

    mean_rms = float(np.mean(seg_rms))
    mean_flat = float(np.mean(seg_flat))
    voiced_pct = len(voiced) / window

    # Score: belöna djup röst, hög voiced%, låg flatness, god energi
    # Undviker för svaga segment (bakgrundsljud)
    if mean_rms < 0.02:
        continue

    score = (1/median_f0) * 1000 + voiced_pct * 50 - mean_flat * 100
    t_start = i * hop / sr
    results.append((score, t_start, median_f0, mean_flat, voiced_pct, mean_rms))

results.sort(reverse=True)
print(f'\nTop 10 segment (djup + ren + mycket tal):')
print('  Score  Tid(s)  F0(Hz)  Flatness  Voiced%  RMS')
for sc, t, f, fl, v, r in results[:10]:
    print(f'  {sc:5.1f}  {t:5.1f}s  {f:6.1f}  {fl:.4f}   {v*100:.0f}%    {r:.4f}')

best = results[0]
best_t = best[1]
print(f'\nVinnare: {best_t:.1f}s (F0={best[2]:.0f}Hz, flat={best[3]:.4f}, voiced={best[4]*100:.0f}%)')

# Spara bästa segmentet
y_seg, sr2 = librosa.load(mp3, sr=22050, offset=best_t, duration=15.0)
out = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_new.wav'
sf.write(out, y_seg, sr2)
print(f'Sparat: {out}')
print(f'Storlek: {len(y_seg)/sr2:.1f}s @ {sr2}Hz')
