# train_failure_model.py
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib

# -----------------------------
# 1. Simulate system metrics
# -----------------------------
np.random.seed(42)
num_samples = 5000

# Features
cpu_usage = np.random.uniform(10, 100, num_samples)
memory_usage = np.random.uniform(20, 100, num_samples)
disk_usage = np.random.uniform(10, 100, num_samples)
net_io = np.random.uniform(50, 500, num_samples)
cpu_mean_5 = cpu_usage + np.random.normal(0, 5, num_samples)
cpu_std_5 = np.random.uniform(1, 10, num_samples)
mem_mean_5 = memory_usage + np.random.normal(0, 5, num_samples)
net_rate = net_io + np.random.normal(0, 20, num_samples)

# -----------------------------
# 2. Generate failure labels
# -----------------------------
# High CPU/memory/disk usage increases failure probability
failure_prob = (
    0.002 * cpu_usage +
    0.002 * memory_usage +
    0.001 * disk_usage +
    0.0005 * net_io
)
failure = (np.random.rand(num_samples) < failure_prob).astype(int)

# -----------------------------
# 3. Prepare DataFrame
# -----------------------------
df = pd.DataFrame({
    "cpu_usage": cpu_usage,
    "memory_usage": memory_usage,
    "disk_usage": disk_usage,
    "net_io": net_io,
    "cpu_mean_5": cpu_mean_5,
    "cpu_std_5": cpu_std_5,
    "mem_mean_5": mem_mean_5,
    "net_rate": net_rate,
    "failure": failure
})

# -----------------------------
# 4. Split data
# -----------------------------
X = df.drop("failure", axis=1)
y = df["failure"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# -----------------------------
# 5. Train XGBoost model
# -----------------------------
model = XGBClassifier(use_label_encoder=False, eval_metric='logloss')
model.fit(X_train, y_train)

# -----------------------------
# 6. Evaluate model
# -----------------------------
y_pred = model.predict(X_test)
print("Classification Report:\n", classification_report(y_test, y_pred))
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))

# -----------------------------
# 7. Save the trained model
# -----------------------------
joblib.dump(model, "models/failure_model.pkl")
print("Model saved as 'models/failure_model.pkl'.")
