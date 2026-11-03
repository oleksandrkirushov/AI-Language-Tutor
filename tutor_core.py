"""
Speech recognition and conversation logic shared by the console app and the server.

Keep this module free of terminal, microphone and speaker dependencies.
"""

import numpy as np
import requests
from faster_whisper import WhisperModel


SAMPLE_RATE = 16000  # Whisper prefers 16kHz
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"


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


def is_ollama_available() -> bool:
    """Checks whether the Ollama server responds."""
    try:
        requests.get(OLLAMA_TAGS_URL, timeout=2).raise_for_status()
    except requests.exceptions.RequestException:
        return False
    return True
