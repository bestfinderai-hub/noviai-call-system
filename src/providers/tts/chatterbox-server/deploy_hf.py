"""
Deployer Chatterbox TTS till HuggingFace Spaces.
Kör: python deploy_hf.py
"""
import os, sys, time, urllib.request, json

HF_TOKEN = os.getenv("HF_TOKEN", "")
OWNER    = "Bestfinderai"
SPACE    = "chatterbox-tts"
REPO_ID  = f"{OWNER}/{SPACE}"

HERE = os.path.dirname(os.path.abspath(__file__))

def log(msg): print(f"[deploy] {msg}", flush=True)

def main():
    from huggingface_hub import HfApi, SpaceHardware
    api = HfApi(token=HF_TOKEN)

    # 1. Skapa Space (hoppa över om den redan finns)
    log(f"Skapar Space {REPO_ID} ...")
    try:
        api.create_repo(
            repo_id=REPO_ID,
            repo_type="space",
            space_sdk="docker",
            private=False,
            exist_ok=True,
        )
        log("Space skapad (eller existerar redan)")
    except Exception as e:
        log(f"VARNING vid skapande: {e}")

    # 2. Ladda upp filer
    files = {
        "Dockerfile":    os.path.join(HERE, "Dockerfile.hf"),
        "server.py":     os.path.join(HERE, "server.py"),
        "reference.wav": os.path.join(HERE, "reference.wav"),
    }
    # README.md krävs för HF Spaces metadata
    readme = (
        "---\n"
        "title: Chatterbox TTS\n"
        "emoji: 🔊\n"
        "colorFrom: blue\n"
        "colorTo: purple\n"
        "sdk: docker\n"
        "pinned: false\n"
        "---\n"
        "# Chatterbox TTS - NovAI\n"
        "Swedish voice TTS server. POST /tts - mulaw 8kHz.\n"
    )
    readme_path = os.path.join(HERE, "_README.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme)
    files["README.md"] = readme_path

    for dest, src in files.items():
        if not os.path.exists(src):
            log(f"SAKNAS: {src} — hoppar över")
            continue
        log(f"Laddar upp {dest} ({os.path.getsize(src):,} bytes)...")
        api.upload_file(
            path_or_fileobj=src,
            path_in_repo=dest,
            repo_id=REPO_ID,
            repo_type="space",
        )
    try:
        os.unlink(readme_path)
    except OSError:
        pass

    log("Alla filer uppladdade. Space bygger (~3-5 min)...")

    # 3. Vänta tills Space är Running
    space_url = f"https://{OWNER}-{SPACE}.hf.space"
    health_url = f"{space_url}/health"
    log(f"Väntar på {health_url} ...")

    deadline = time.time() + 600  # max 10 min
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health_url, timeout=10) as r:
                body = json.loads(r.read())
                if body.get("status") == "ok":
                    break
        except Exception:
            pass
        elapsed = int(time.time() - (deadline - 600))
        print(f"\r  {elapsed}s förflutit...", end="", flush=True)
        time.sleep(15)
    else:
        log("\nTimeout — Space tar längre tid. Kolla https://huggingface.co/spaces/" + REPO_ID)
        print_env(space_url)
        return

    print()
    log(f"Space är LIVE: {space_url}")
    print_env(space_url)

    # 4. Uppdatera .env automatiskt
    env_path = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".env"))
    update_env(env_path, space_url)


def print_env(url):
    print("\n" + "="*60)
    print(f"  CHATTERBOX_SERVER_URL={url}")
    print(f"  TTS_PROVIDER=chatterbox")
    print("="*60)
    print()


def update_env(env_path, url):
    if not os.path.exists(env_path):
        print(f"[deploy] .env hittades inte på {env_path} — uppdatera manuellt")
        return
    with open(env_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Sätt TTS_PROVIDER=chatterbox och CHATTERBOX_SERVER_URL
    import re
    content = re.sub(r"^TTS_PROVIDER=.*$", "TTS_PROVIDER=chatterbox", content, flags=re.MULTILINE)
    content = re.sub(
        r"^#?\s*CHATTERBOX_SERVER_URL=.*$",
        f"CHATTERBOX_SERVER_URL={url}",
        content, flags=re.MULTILINE
    )

    with open(env_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[deploy] .env uppdaterad automatiskt: {env_path}")


if __name__ == "__main__":
    main()
