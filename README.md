# Voice Language Tutor (local)

You speak out loud in the language you are learning → the AI hears you, replies by voice
and politely corrects your mistakes. Everything runs locally on your computer.

Works on macOS and Linux. Windows isn't supported: keyboard input relies on the
Unix-only `termios` module.

## What it's made of

- **faster-whisper** — recognizes your speech (speech-to-text), locally, no internet
- **Ollama** — a local language model that holds the conversation and corrects mistakes
- **say** (macOS) / **pyttsx3** (Linux) — reads the reply aloud (text-to-speech), using the system voice

## Step 1. Install Python

If it isn't installed yet, download it from [python.org](https://www.python.org/downloads/)
(version 3.10 or newer).

Check in the terminal:
```
python --version
```

## Step 2. Install Ollama and download a model

1. Download Ollama from [ollama.com](https://ollama.com) and install it.
2. Open a terminal and download the model:
   ```
   ollama pull llama3.1
   ```
   (this is ~4.7 GB and downloads once). If your computer is less powerful, you can use
   a smaller model, for example `ollama pull llama3.2` (~2 GB).
3. Make sure Ollama is running — it usually starts automatically
   after installation. You can check with:
   ```
   ollama list
   ```

## Step 3. Install the project dependencies

Open a terminal in the project folder and run:

```
python -m venv venv
```

Activating the virtual environment:
```
source venv/bin/activate
```

Installing the libraries:
```
pip install -r requirements.txt
```

> The first run of `main.py` will also automatically download the Whisper model
> (the size depends on the `--whisper-size` parameter, "small" by default,
> ~500 MB) — this happens once.

## Step 4. Run it

```
python main.py --target English --native Ukrainian
```

Parameters (all optional):
- `--target` — the language you are learning (default "English")
- `--native` — your native language (default "Ukrainian")
- `--model` — Ollama model name (default "llama3.1")
- `--whisper-size` — tiny / base / small / medium / large-v3 (accuracy vs speed)
- `--silence` — how many seconds of silence end the recording (default 2)
- `--max-duration` — maximum recording length in seconds (default 60)
- `--threshold` — voice loudness threshold (determined automatically from background noise by default)

Run it in a regular terminal, since the program reads keys directly from the keyboard.
At startup it listens to background noise for half a second to set the loudness
threshold, so stay quiet during that moment.

In the program:
1. Press **Space** and speak. You don't need to hold the key.
2. Recording stops after a pause, or right away if you press **Space** again.
   If you say nothing for 8 seconds, the recording is cancelled.
3. The program recognizes your speech and replies in text and by voice.

To quit, press `q`.

## Common problems

**"Could not connect to Ollama"**
→ Make sure Ollama is running. You can start it manually: `ollama serve` in a separate
terminal, and leave it open.

**No sound / the voice doesn't read the reply (Linux)**
→ pyttsx3 on Linux uses `espeak`. Install it:
```
sudo apt install espeak
```

**The microphone doesn't record / sounddevice error**
→ Check that the operating system has given the program (terminal/Python)
access to the microphone in the privacy settings.

**Recording cuts off while you're thinking**
→ Allow a longer pause, for example `--silence 3`.

**Recording doesn't stop, or a quiet voice isn't picked up**
→ Set the threshold manually. Raise it if background noise keeps the recording going
(for example `--threshold 800`), and lower it if your voice isn't detected.

**Whisper is slow**
→ Use a smaller size: `--whisper-size tiny` or `--whisper-size base`.
If you have an NVIDIA graphics card with CUDA, you can speed it up by changing
`device="cpu"` to `device="cuda"` in the code (requires the CUDA toolkit to be installed).

## What could be improved next

- More reliable end-of-phrase detection using real voice activity detection (VAD)
  instead of a loudness threshold
- A better voice using a local neural TTS (for example Piper) instead of
  the system voice
- Windows support
- Saving conversation history to a file to see your progress
- Highlighting corrections in a separate color in the output
