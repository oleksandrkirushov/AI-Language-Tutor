"""
Voice language tutor powered by local AI.

How it works:
1. You press Space and speak into the microphone. Recording stops on its own
   after a pause (2 seconds of silence by default) or right away if you press Space again.
2. faster-whisper (locally, no internet) turns your speech into text.
3. The text is sent to a local model through Ollama, which replies in the
   language you are learning and politely corrects your mistakes.
4. The reply is read aloud in the system voice (say on macOS, pyttsx3 elsewhere).

Everything runs locally on your computer, except the call to Ollama,
which is also local (http://localhost:11434) if you set it up that way.
"""

import argparse
import contextlib
import os
import queue
import select
import subprocess
import sys
import termios
import tty

import numpy as np
import requests
import sounddevice as sd
from faster_whisper import WhisperModel
import pyttsx3


SAMPLE_RATE = 16000  # Whisper prefers 16kHz
OLLAMA_URL = "http://localhost:11434/api/chat"

BLOCK_SECONDS = 0.1  # size of the audio chunk we measure loudness on
NOISE_MULTIPLIER = 3.0  # how many times louder than the background a voice must be
MIN_THRESHOLD = 200.0  # lower bound of the threshold (for int16), so rustling is ignored
NO_SPEECH_TIMEOUT = 8.0  # if nothing is said after pressing Space, cancel the recording


@contextlib.contextmanager
def single_key_mode():
    """Switches the terminal to a mode where keys are read immediately, without Enter."""
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    tty.setcbreak(fd)
    try:
        yield
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)


def read_keys(timeout: float | None) -> str:
    """Returns the pressed keys; an empty string if nothing was pressed within timeout."""
    fd = sys.stdin.fileno()
    ready, _, _ = select.select([fd], [], [], timeout)
    if not ready:
        return ""
    return os.read(fd, 32).decode(errors="ignore")


def wait_for_start() -> bool:
    """Waits for Space (True) or q (False). Also works on the Ukrainian keyboard layout."""
    termios.tcflush(sys.stdin.fileno(), termios.TCIFLUSH)  # ignore anything pressed earlier
    while True:
        keys = read_keys(None).lower()
        if "q" in keys or "й" in keys:
            return False
        if " " in keys:
            return True


def rms(block: np.ndarray) -> float:
    return float(np.sqrt(np.mean(block.astype(np.float64) ** 2)))


def calibrate_threshold(samplerate: int = SAMPLE_RATE) -> float:
    """Listens to background noise for half a second and returns the voice loudness threshold."""
    noise = sd.rec(int(0.5 * samplerate), samplerate=samplerate, channels=1, dtype="int16")
    sd.wait()
    return max(rms(noise) * NOISE_MULTIPLIER, MIN_THRESHOLD)


def record_until_silence(
    threshold: float,
    silence_seconds: float,
    max_seconds: float,
    samplerate: int = SAMPLE_RATE,
) -> np.ndarray | None:
    """Records from the microphone until there is a pause or Space is pressed.

    Returns None if no voice was ever heard.
    """
    print("🎙️  Speak... (pause or Space to finish)")
    blocks: queue.Queue = queue.Queue()

    def on_audio(indata, _frames, _time, _status):
        blocks.put(indata.copy())

    chunks = []
    heard_speech = False
    silent_for = 0.0
    recorded = 0.0

    with sd.InputStream(
        samplerate=samplerate,
        channels=1,
        dtype="int16",
        blocksize=int(BLOCK_SECONDS * samplerate),
        callback=on_audio,
    ):
        while recorded < max_seconds:
            if " " in read_keys(0):
                break
            try:
                block = blocks.get(timeout=BLOCK_SECONDS)
            except queue.Empty:
                continue

            chunks.append(block)
            seconds = len(block) / samplerate
            recorded += seconds

            if rms(block) >= threshold:
                heard_speech = True
                silent_for = 0.0
            else:
                silent_for += seconds

            if heard_speech and silent_for >= silence_seconds:
                break
            if not heard_speech and silent_for >= NO_SPEECH_TIMEOUT:
                break

    print("⏹️  Recording finished.")
    if not heard_speech:
        return None
    return np.concatenate(chunks)


def transcribe(model: WhisperModel, audio: np.ndarray, samplerate: int = SAMPLE_RATE) -> str:
    """Turns speech into text, passing the audio directly as a numpy array.

    faster-whisper expects float32 in the range [-1, 1] at 16kHz,
    so we convert int16 -> float32. This way we bypass decoding through PyAV.
    """
    samples = audio.flatten().astype(np.float32) / 32768.0
    segments, _info = model.transcribe(samples, beam_size=5)
    text = " ".join(segment.text.strip() for segment in segments)

    return text.strip()


def build_system_prompt(target_lang: str, native_lang: str) -> str:
    return (
        f"You are a friendly {target_lang} language tutor for a native {native_lang} speaker. "
        f"Hold the conversation mainly in {target_lang}, adapting to the learner's level. "
        "If the learner makes a grammar, vocabulary or pronunciation (judging by the transcript) mistake, "
        f"first give a short, friendly reply on the substance of the conversation in {target_lang}, "
        "then gently correct the mistake in one sentence and briefly explain why "
        f"(you may give the explanation in {native_lang} to make it easier to understand). "
        "Don't overload the reply: 2-4 sentences at most, plus the correction. "
        "Ask follow-up questions to keep the conversation going."
    )


def chat_with_tutor(history: list, model_name: str) -> str:
    """Sends the conversation history to Ollama and returns the reply text."""
    response = requests.post(
        OLLAMA_URL,
        json={"model": model_name, "messages": history, "stream": False},
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return data["message"]["content"].strip()


def speak(engine: "pyttsx3.Engine | None", text: str) -> None:
    """Reads text aloud. On macOS (engine=None) it uses the system say command:
    pyttsx3 there silently skips lines now and then on repeated calls."""
    if engine is None:
        subprocess.run(["say"], input=text, text=True)  # text via stdin
        return
    engine.say(text)
    engine.runAndWait()


def main():
    parser = argparse.ArgumentParser(description="Voice language tutor")
    parser.add_argument("--target", default="English", help="The language you are learning")
    parser.add_argument("--native", default="Ukrainian", help="Your native language")
    parser.add_argument("--model", default="llama3.1", help="Model name in Ollama")
    parser.add_argument(
        "--whisper-size",
        default="small",
        choices=["tiny", "base", "small", "medium", "large-v3"],
        help="Whisper model size (smaller = faster, larger = more accurate)",
    )
    parser.add_argument(
        "--silence", type=float, default=2.0, help="How many seconds of silence end the recording"
    )
    parser.add_argument(
        "--max-duration", type=float, default=60.0, help="Maximum recording length in seconds"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Voice loudness threshold (determined automatically from background noise by default)",
    )
    args = parser.parse_args()

    if not sys.stdin.isatty():
        sys.exit("❌ Run the program in a regular terminal: it needs a keyboard.")

    print("⏳ Loading the Whisper model (the first time may take a minute)...")
    whisper_model = WhisperModel(args.whisper_size, device="cpu", compute_type="int8")

    print("⏳ Preparing the voice engine...")
    tts_engine = None if sys.platform == "darwin" else pyttsx3.init()

    history = [{"role": "system", "content": build_system_prompt(args.target, args.native)}]

    threshold = args.threshold
    if threshold is None:
        print("🤫 Measuring background noise, stay quiet for half a second...")
        threshold = calibrate_threshold()

    print("\n✅ Ready! Press Space to start speaking, or q to quit.\n")

    with single_key_mode():
        while True:
            print("Space = speak, q = quit")
            if not wait_for_start():
                print("See you! 👋")
                break

            audio = record_until_silence(threshold, args.silence, args.max_duration)
            user_text = transcribe(whisper_model, audio) if audio is not None else ""

            if not user_text:
                print("🤔 Didn't catch anything clear, please try again.")
                continue

            print(f"🗣️  You said: {user_text}")
            history.append({"role": "user", "content": user_text})

            try:
                reply = chat_with_tutor(history, args.model)
            except requests.exceptions.ConnectionError:
                print(
                    "❌ Could not connect to Ollama. Make sure it is running "
                    "(the 'ollama serve' command or just the open Ollama app)."
                )
                history.pop()  # remove the user's message, since there will be no reply
                continue

            history.append({"role": "assistant", "content": reply})

            print(f"🤖 Tutor: {reply}\n")
            speak(tts_engine, reply)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSee you! 👋")
        sys.exit(0)
