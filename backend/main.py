# main.py

import os
import shutil
import time
from collections import deque
from pathlib import Path
from typing import Dict, List

import joblib
import pandas as pd
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="Host PC Dashboard")

# Add CORS middleware to allow connections from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Load Machine Learning Model ===
try:
    model = joblib.load("models/failure_model.pkl")
    print("✅ Machine learning model loaded successfully.")
except Exception as e:
    print(f"⚠️ Warning: Could not load model 'failure_model.pkl'. Failure probability will be 0. Error: {e}")
    model = None

# === Setup for File Sharing ===
UPLOAD_DIRECTORY = "file_uploads"
Path(UPLOAD_DIRECTORY).mkdir(exist_ok=True)
files_for_devices: Dict[str, list] = {}

# === In-memory Data Storage ===
device_data: Dict[str, dict] = {}
history_data: Dict[str, deque] = {}
HISTORY_LIMIT = 8640

# === Pydantic Data Schema ===
class Metrics(BaseModel):
    device_id: str
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    net_io: float
    cpu_mean_5: float
    cpu_std_5: float
    mem_mean_5: float
    net_rate: float


# === API Endpoints ===
@app.post("/send_metrics")
def receive_metrics(metrics: Metrics):
    features = {
        "cpu_usage": metrics.cpu_usage,
        "memory_usage": metrics.memory_usage,
        "disk_usage": metrics.disk_usage,
        "net_io": metrics.net_io,
        "cpu_mean_5": metrics.cpu_mean_5,
        "cpu_std_5": metrics.cpu_std_5,
        "mem_mean_5": metrics.mem_mean_5,
        "net_rate": metrics.net_rate,
    }
    x_df = pd.DataFrame([features])

    failure_prob = 0.0
    if model:
        try:
            failure_prob = float(model.predict_proba(x_df)[0, 1])
        except Exception as e:
            print(f"Error during prediction: {e}")
            failure_prob = 0.0

    device_data[metrics.device_id] = {
        "device_id": metrics.device_id,
        "name": metrics.device_id,
        "cpu_usage": metrics.cpu_usage,
        "memory_usage": metrics.memory_usage,
        "disk_usage": metrics.disk_usage,
        "net_io": metrics.net_io,
        "failure_risk": failure_prob,
        "status": "Healthy" if failure_prob < 0.5 else "Warning" if failure_prob < 0.9 else "Critical",
        "last_seen": time.time(),
    }

    if metrics.device_id not in history_data:
        history_data[metrics.device_id] = deque(maxlen=HISTORY_LIMIT)

    current_timestamp = int(time.time())
    history_data[metrics.device_id].append({
        "timestamp": current_timestamp,
        "cpu_usage": metrics.cpu_usage,
        "memory_usage": metrics.memory_usage,
        "failure_probability": failure_prob
    })

    return {"status": "ok", "failure_risk": failure_prob}


@app.get("/devices")
def get_devices():
    recent_devices = []
    current_time = time.time()
    for device_id, d in device_data.items():
        if current_time - d.get("last_seen", 0) < 15:
            recent_devices.append({
                "device_id": d["device_id"],
                "name": d["name"],
                "status": d["status"],
                "failure_probability": d["failure_risk"]
            })
    return recent_devices


@app.get("/device/{device_id}")
def get_device_details(device_id: str):
    return device_data.get(device_id, {})


@app.get("/device/{device_id}/history")
def get_device_history(device_id: str):
    history = history_data.get(device_id, deque())
    return list(history)


# === File Sharing Endpoints ===
@app.post("/files/upload/{device_id}")
async def upload_file_for_device(device_id: str, file: UploadFile = File(...)):
    try:
        device_upload_path = Path(UPLOAD_DIRECTORY) / device_id
        device_upload_path.mkdir(exist_ok=True)
        file_location = device_upload_path / file.filename
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)

        if device_id not in files_for_devices:
            files_for_devices[device_id] = []
        if file.filename not in files_for_devices[device_id]:
            files_for_devices[device_id].append(file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not upload file: {e}")
    return {"message": f"File '{file.filename}' uploaded for device '{device_id}'"}


@app.post("/files/upload/all")
async def upload_file_to_all(file: UploadFile = File(...)):
    active_devices = []
    current_time = time.time()
    for device_id, d in device_data.items():
        if current_time - d.get("last_seen", 0) < 15:
            active_devices.append(device_id)

    if not active_devices:
        raise HTTPException(status_code=404, detail="No active devices found to send the file to.")

    try:
        file_content = await file.read()
        for device_id in active_devices:
            device_upload_path = Path(UPLOAD_DIRECTORY) / device_id
            device_upload_path.mkdir(exist_ok=True)
            file_location = device_upload_path / file.filename
            
            with open(file_location, "wb+") as file_object:
                file_object.write(file_content)

            if device_id not in files_for_devices:
                files_for_devices[device_id] = []
            if file.filename not in files_for_devices[device_id]:
                files_for_devices[device_id].append(file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not upload file: {e}")

    return {"message": f"File '{file.filename}' sent to {len(active_devices)} active device(s)."}


@app.get("/files/check/{device_id}")
async def check_for_files(device_id: str):
    pending_files = files_for_devices.get(device_id, [])
    return {"files_to_download": pending_files}


@app.get("/files/download/{device_id}/{filename}")
async def download_file_for_device(device_id: str, filename: str):
    file_path = Path(UPLOAD_DIRECTORY) / device_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if device_id in files_for_devices and filename in files_for_devices[device_id]:
        files_for_devices[device_id].remove(filename)
    return FileResponse(path=file_path, media_type="application/octet-stream", filename=filename)


# === Entry point ===
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)