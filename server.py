"""
Local HTTP server for the voice language tutor: the API and the built web page.

Build the page with `npm run build` in the web folder, then run `python server.py`.
It listens only on 127.0.0.1, so it isn't reachable from the network.
"""

import contextlib
import io
import wave
from pathlib import Path
from typing import Literal

import numpy as np
import requests
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from faster_whisper import WhisperModel
from pydantic import BaseModel

from tutor_core import (
    SAMPLE_RATE,
    build_system_prompt,
    chat_with_tutor,
    is_ollama_available,
    transcribe,
)


HOST = "127.0.0.1"
PORT = 8000
WHISPER_SIZE = "small"
OLLAMA_MODEL = "llama3.1"
WEB_DIST = Path(__file__).parent / "web" / "dist"


class ChatMessage(BaseModel):
    # No "system" role: the server sets the system prompt itself
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    target: str = "English"
    native: str = "Ukrainian"


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    print("⏳ Loading the Whisper model (the first time may take a minute)...")
    app.state.whisper_model = WhisperModel(WHISPER_SIZE, device="cpu", compute_type="int8")
    if WEB_DIST.is_dir():
        print(f"✅ Ready! Open http://{HOST}:{PORT}")
    else:
        print("⚠️  The web page isn't built yet. Run `npm install` and `npm run build` in the web folder.")
    yield


app = FastAPI(title="Voice language tutor", lifespan=lifespan)


def read_wav(body: bytes) -> np.ndarray:
    """Returns the samples of a 16 kHz, mono, 16-bit WAV; responds with 400 for anything else."""
    try:
        with wave.open(io.BytesIO(body)) as wav:
            is_expected_format = (
                wav.getframerate() == SAMPLE_RATE
                and wav.getnchannels() == 1
                and wav.getsampwidth() == 2
            )
            if not is_expected_format:
                raise HTTPException(status_code=400, detail="Expected a 16 kHz, mono, 16-bit WAV")
            frames = wav.readframes(wav.getnframes())
    except (wave.Error, EOFError) as error:
        raise HTTPException(status_code=400, detail="The request body is not a valid WAV") from error

    if not frames:
        raise HTTPException(status_code=400, detail="The WAV contains no audio")
    return np.frombuffer(frames, dtype="<i2")


@app.get("/api/health")
def health() -> dict:
    return {"ollama": is_ollama_available()}


@app.post("/api/transcribe")
async def transcribe_audio(request: Request) -> dict:
    audio = read_wav(await request.body())
    text = await run_in_threadpool(transcribe, request.app.state.whisper_model, audio)
    return {"text": text}


@app.post("/api/chat")
async def chat(chat_request: ChatRequest) -> dict:
    system_prompt = build_system_prompt(chat_request.target, chat_request.native)
    history = [{"role": "system", "content": system_prompt}]
    history += [message.model_dump() for message in chat_request.messages]

    try:
        reply = await run_in_threadpool(chat_with_tutor, history, OLLAMA_MODEL)
    except requests.exceptions.RequestException as error:
        raise HTTPException(
            status_code=503,
            detail="Could not get a reply from Ollama. Make sure it is running "
            "(the 'ollama serve' command or just the open Ollama app).",
        ) from error
    return {"reply": reply}


# Mounted after the API routes, so they take priority over the page's files
if WEB_DIST.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
