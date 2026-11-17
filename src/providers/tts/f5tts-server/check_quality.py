import librosa, numpy as np, soundfile as sf

def analyze_quality(path, label):
    y, sr = librosa.load(path, sr=None)
    print(f'\n=== {label} ===')
    print(f'  Längd: {len(y)/sr:.1f}s, {sr}Hz')

    # F0
    hop = int(sr * 0.010)
    f0, _, _ = librosa.pyin(y, fmin=60, fmax=400, sr=sr, hop_length=hop)
    voiced = f0[~np.isnan(f0)]
    if len(voiced):
        print(f'  F0 median: {np.median(voiced):.0f} Hz (djupare = mer pondus)')

    # SNR proxy: RMS of voiced vs unvoiced
    rms = librosa.feature.rms(y=y, frame_length=int(sr*0.025), hop_length=hop)[0]
    print(f'  RMS (energi): {np.mean(rms):.4f}, max {np.max(rms):.4f}')

    # Spectral flatness (nær 0=tonalt/röst, nær 1=brus/musik)
    flat = librosa.feature.spectral_flatness(y=y, hop_length=hop)[0]
    print(f'  Spectral flatness: {np.mean(flat):.4f} (0=ren röst, 1=brus)')

    # Zero-crossing rate (hög = mer konsonanter/brus)
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=hop)[0]
    print(f'  ZCR mean: {np.mean(zcr):.4f}')

    # Dynamic range
    db = librosa.amplitude_to_db(np.abs(y) + 1e-9)
    print(f'  Dynamisk omfång: {np.max(db) - np.percentile(db, 5):.0f} dB')

files = [
    (r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_lars_15s.wav', 'Lars Rolander 75-90s (bästa seg)'),
    (r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_male_sv_10s.wav', 'Nuvarande referens (10s)'),
    (r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_male_sv.wav', 'Nuvarande referens (30s)'),
]
for path, label in files:
    try:
        analyze_quality(path, label)
    except Exception as e:
        print(f'\n=== {label} === FEL: {e}')
