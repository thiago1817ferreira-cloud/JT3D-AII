
import os
import tempfile
from pathlib import Path
from typing import List

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

TRIPO_API_KEY = os.getenv("TRIPO_API_KEY", "").strip()
TRIPO_BASE_URL = os.getenv("TRIPO_BASE_URL", "https://openapi.tripo3d.ai/v3").rstrip("/")
TRIPO_MODEL = os.getenv("TRIPO_MODEL", "v3.1-20260211")

app = FastAPI(title="JT3D AI API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def headers():
    if not TRIPO_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="TRIPO_API_KEY não configurada no servidor."
        )
    return {"Authorization": f"Bearer {TRIPO_API_KEY}"}

@app.get("/health")
async def health():
    return {"ok": True, "tripo_configured": bool(TRIPO_API_KEY)}

async def upload_to_tripo(file: UploadFile) -> str:
    data = await file.read()
    if not data:
        raise HTTPException(400, f"Arquivo vazio: {file.filename}")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(413, f"Arquivo acima de 20 MB: {file.filename}")

    content_type = file.content_type or "image/jpeg"
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{TRIPO_BASE_URL}/files",
            headers=headers(),
            files={"file": (file.filename or "image.jpg", data, content_type)},
        )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Tripo upload: {r.text}")
    payload = r.json()
    if payload.get("code") != 0:
        raise HTTPException(502, payload)
    token = payload.get("data", {}).get("file_token") or payload.get("data", {}).get("token")
    if not token:
        raise HTTPException(502, f"Resposta de upload sem file_token: {payload}")
    return token

@app.post("/api/gerar-3d")
async def gerar_3d(
    images: List[UploadFile] = File(...),
    style: str = Form("realista"),
    instructions: str = Form(""),
    use_multiview: bool = Form(True),
):
    if not images:
        raise HTTPException(400, "Envie pelo menos uma imagem.")
    if len(images) > 4:
        raise HTTPException(400, "Máximo de 4 imagens.")

    tokens = []
    for image in images:
        tokens.append(await upload_to_tripo(image))

    # Com 2+ imagens usamos multiview; com uma imagem usamos image-to-model.
    async with httpx.AsyncClient(timeout=120) as client:
        if use_multiview and len(tokens) >= 2:
            views = [{"front": tokens[0]}]
            if len(tokens) >= 2:
                views.append({"back": tokens[1]})
            if len(tokens) >= 3:
                views.append({"right": tokens[2]})
            if len(tokens) >= 4:
                views.append({"left": tokens[3]})

            body = {
                "inputs": views,
                "model": TRIPO_MODEL,
                "texture": True,
                "pbr": True,
            }
            endpoint = f"{TRIPO_BASE_URL}/generation/multiview-to-model"
        else:
            body = {
                "input": tokens[0],
                "model": TRIPO_MODEL,
                "texture": True,
                "pbr": True,
                "enable_image_autofix": True,
            }
            endpoint = f"{TRIPO_BASE_URL}/generation/image-to-model"

        r = await client.post(endpoint, headers={**headers(), "Content-Type": "application/json"}, json=body)

    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"Tripo generation: {r.text}")

    payload = r.json()
    if payload.get("code") != 0:
        raise HTTPException(502, payload)

    task_id = payload.get("data", {}).get("task_id")
    if not task_id:
        raise HTTPException(502, f"Tripo não retornou task_id: {payload}")

    return {
        "ok": True,
        "provider": "Tripo",
        "task_id": task_id,
        "style": style,
        "instructions": instructions,
        "message": "Modelo enviado para processamento."
    }

@app.get("/api/tarefa/{task_id}")
async def tarefa(task_id: str):
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(
            f"{TRIPO_BASE_URL}/tasks/{task_id}",
            headers=headers()
        )
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text)

    payload = r.json()
    if payload.get("code") != 0:
        raise HTTPException(502, payload)

    data = payload.get("data", {})
    output = data.get("output") or {}

    return {
        "ok": True,
        "task_id": task_id,
        "status": data.get("status"),
        "progress": data.get("progress", 0),
        "model_url": output.get("model_url"),
        "preview_url": output.get("rendered_image_url"),
        "credits_consumed": data.get("credits_consumed"),
    }
