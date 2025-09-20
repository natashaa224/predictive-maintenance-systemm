from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from typing import Dict
import uvicorn

app = FastAPI(title="Host PC Dashboard")

# === Load models ===
classifier = joblib.load("models/failure_classifier.pkl")
regressor = joblib.load("models/failure_regressor.pkl")
anomaly_detector = joblib.load("models/anomaly_detector.pkl")

# Store metrics from devices
device_data: Dict[str, dict] = {}

# Mount frontend folder
app.mount("/frontend", StaticFiles(directory="../frontend"), name="frontend")


# === Helper to convert numpy → Python ===
def to_serializable(val):
    """Recursively convert numpy types to native Python types"""
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    elif isinstance(val, (np.integer, int)):
        return int(val)
    elif isinstance(val, (np.floating, float)):
        return float(val)
    elif isinstance(val, (list, tuple, np.ndarray)):
        return [to_serializable(v) for v in val]
    elif isinstance(val, dict):
        return {k: to_serializable(v) for k, v in val.items()}
    return val


# === Pydantic schema ===
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
    # Convert to DataFrame with proper feature names
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

    # Failure probability
    failure_prob = classifier.predict_proba(x_df)[0, 1]

    # Remaining Useful Life (regression output)
    rul_days = regressor.predict(x_df)[0]

    # Anomaly detection (IsolationForest → -1 = anomaly, 1 = normal)
    anomaly_flag = anomaly_detector.predict(x_df)[0] == -1

    # Save latest device state
    device_data[metrics.device_id] = {
        "metrics": metrics.dict(),
        "failure_risk": failure_prob,
        "rul_days": rul_days,
        "anomaly": anomaly_flag,
    }

    response = {
        "status": "ok",
        "failure_risk": failure_prob,
        "rul_days": rul_days,
        "anomaly": anomaly_flag,
    }

    return JSONResponse(content=to_serializable(response))


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    with open("../frontend/index.html", encoding="utf-8") as f:
        return f.read()


@app.get("/device_data")
def get_device_data():
    return JSONResponse(content=to_serializable(device_data))


# === Entry point ===
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
