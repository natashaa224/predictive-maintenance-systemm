# AI-Powered Predictive System Monitor

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)
![Python](https://img.shields.io/badge/python-3.10+-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)

This project is a full-stack application for real-time system health monitoring and predictive failure analysis. It collects performance metrics from multiple client devices, uses an ML model to forecast issues, and presents the data in a live web dashboard.

[Dashboard Preview]<img width="1823" height="897" alt="Screenshot 2025-09-20 121825" src="https://github.com/user-attachments/assets/547dd05a-928c-4cbb-ab76-6bc69e2bcf6e" />
 
---

###  Core Features

| Feature                  | Description                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Real-Time Dashboard** | A dynamic web UI built with vanilla JavaScript and Chart.js that visualizes live metrics, device status, and historical data without needing a page refresh.   |
| **ML-Powered Predictions**| Utilizes an XGBoost model to analyze incoming metrics and calculate a real-time failure probability score for each connected device. |
| **Multi-Device Monitoring** | A centralized FastAPI server collects data from any number of remote agents running on different machines (Windows, macOS, Linux).         |
| **Remote File Transfer** | Includes a utility to send files from the host dashboard to a specific client device or broadcast a file to all connected devices at once. |

---

### Technology Overview

This project integrates several key technologies:

* **Backend:** Built with **Python** and the **FastAPI** framework, serving a REST API for data ingestion and retrieval.
* **Frontend:** A lightweight and responsive interface created with pure **JavaScript**, **HTML5**, and **CSS3**. Data visualization is powered by **Chart.js**.
* **Agent:** A cross-platform Python script using the `psutil` library to gather system metrics.
* **Machine Learning:** The predictive model is trained using **Scikit-learn** and **XGBoost**.

---

###  Quickstart

For experienced users, get up and running with these commands from the project root.

```bash
# 1. Setup environment and install dependencies
git clone [https://github.com/natashaa224/predictive-maintenance-systemm.git](https://github.com/natashaa224/predictive-maintenance-systemm.git)
cd predictive-maintenance-systemm
python -m venv .venv && .\.venv\Scripts\Activate
pip install -r backend/requirements.txt

# 2. Train the ML model
python backend/train_failure_model.py

# 3. Configure IP addresses in `backend/monitor.py` and `frontend-pure-js/script.js`

# 4. Run the system (each in a separate terminal)
# Terminal A: Backend Server
python backend/main.py
# Terminal B: Frontend Server
cd frontend-pure-js && python -m http.server 8001
# Terminal C: Agent
python backend/monitor.py
