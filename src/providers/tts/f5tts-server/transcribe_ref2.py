from groq import Groq

client = Groq(api_key=os.environ.get('GROQ_API_KEY', ''))
wav_path = r'C:\claude-pro\noviaivapi\src\providers\tts\f5tts-server\reference_new.wav'

with open(wav_path, 'rb') as f:
    result = client.audio.transcriptions.create(
        file=('reference_new.wav', f, 'audio/wav'),
        model='whisper-large-v3',
        language='sv',
        response_format='text'
    )

print('Transkription:')
print(result)
