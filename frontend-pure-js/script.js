// script.js
const API_BASE_URL = 'http://10.206.212.90:8000'; // Change to your backend IP if needed

// Get elements from the DOM
const homeButton = document.getElementById('home-button');
const goToFilesButton = document.getElementById('go-to-files-button');
const deviceCountSpan = document.getElementById('device-count');
const healthyCountSpan = document.getElementById('healthy-count');
const warningCountSpan = document.getElementById('warning-count');
const criticalCountSpan = document.getElementById('critical-count');
const deviceListContainer = document.getElementById('device-list');
const healthyCard = document.querySelector('.healthy-card');
const warningCard = document.querySelector('.warning-card');
const criticalCard = document.querySelector('.critical-card');
const allStatCards = [healthyCard, warningCard, criticalCard];
const homeView = document.getElementById('home-view');
const deviceView = document.getElementById('device-view');
const fileSharingView = document.getElementById('file-sharing-view');
const deviceNameHeader = document.getElementById('device-name');
const deviceStatusSpan = document.getElementById('device-status');
const deviceRiskP = document.getElementById('device-risk');
const deviceCpuP = document.getElementById('device-cpu');
const deviceMemoryP = document.getElementById('device-memory');
const deviceDiskP = document.getElementById('device-disk');
const deviceNetIoP = document.getElementById('device-netio');
const usageChartCanvas = document.getElementById('usage-chart');
const riskLineChartCanvas = document.getElementById('risk-line-chart');
const modalOverlay = document.getElementById('modal-overlay');
const deviceListModal = document.getElementById('device-list-modal');
const modalTitle = document.getElementById('modal-title');
const modalDeviceList = document.getElementById('modal-device-list');
const modalCloseButton = document.getElementById('modal-close-button');
const deviceSelect = document.getElementById('device-select');
const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');
const uploadStatus = document.getElementById('upload-status');

// State variables
let usageChart, riskLineChart, healthDonutChart, deviceDetailsInterval, selectedDeviceId, allHistoricalData = null;
let currentSelectedRange = 10;
let allDevices = [];

// Update the health donut chart on the home page
function updateHealthDonutChart(healthy, warning, critical) {
    const ctx = document.getElementById('health-donut-chart').getContext('2d');
    if (healthDonutChart) {
        healthDonutChart.destroy();
    }
    healthDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Healthy', 'Warning', 'Critical'],
            datasets: [{
                label: 'Device Status',
                data: [healthy, warning, critical],
                backgroundColor: ['#22c55e', '#ffc107', '#ef4444'],
                borderColor: '#312e81',
                borderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#e0e7ff', font: { size: 14 } }
                }
            },
            cutout: '70%'
        }
    });
}

// Show the modal with a filtered list of devices
function showDevicesInModal(status) {
    const filteredDevices = allDevices.filter(d => d.status === status);
    modalTitle.textContent = `${status} Devices (${filteredDevices.length})`;
    modalDeviceList.innerHTML = '';

    if (filteredDevices.length === 0) {
        modalDeviceList.innerHTML = `<p class="error-text">No devices in this category.</p>`;
    } else {
        // MODIFIED: Create list items with name and percentage
        filteredDevices.forEach(device => {
            const item = document.createElement('div');
            item.className = 'modal-device-item';
            item.onclick = () => {
                modalOverlay.classList.remove('active');
                showDeviceDetails(device.device_id);
            };

            const nameSpan = document.createElement('span');
            nameSpan.className = 'modal-device-name';
            nameSpan.textContent = device.name;

            const probSpan = document.createElement('span');
            probSpan.className = 'modal-device-prob';
            probSpan.textContent = `${(device.failure_probability * 100).toFixed(1)}%`;
            
            item.appendChild(nameSpan);
            item.appendChild(probSpan);
            modalDeviceList.appendChild(item);
        });
    }

    modalOverlay.classList.add('active');
}

// Fetch all device data and update the UI
async function fetchAndRenderDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/devices`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const devices = await response.json();
        
        allDevices = devices;

        let healthyCount = 0, warningCount = 0, criticalCount = 0;
        devices.forEach(device => {
            if (device.status === 'Healthy') healthyCount++;
            else if (device.status === 'Warning') warningCount++;
            else if (device.status === 'Critical') criticalCount++;
        });

        healthyCountSpan.textContent = healthyCount;
        warningCountSpan.textContent = warningCount;
        criticalCountSpan.textContent = criticalCount;
        updateHealthDonutChart(healthyCount, warningCount, criticalCount);
        
        deviceCountSpan.textContent = devices.length;

        deviceListContainer.innerHTML = '';
        devices.forEach(device => {
            const deviceItem = document.createElement('div');
            deviceItem.className = 'device-item';
            deviceItem.textContent = device.name;
            deviceItem.onclick = () => showDeviceDetails(device.device_id);
            deviceListContainer.appendChild(deviceItem);
        });

        if (selectedDeviceId) {
            fetchDeviceDetails(selectedDeviceId);
        }
    } catch (error) {
        console.error('Error fetching devices:', error);
        deviceCountSpan.textContent = '0';
        healthyCountSpan.textContent = '0';
        warningCountSpan.textContent = '0';
        criticalCountSpan.textContent = '0';
        deviceListContainer.innerHTML = '<p class="error-text">Failed to load devices.</p>';
    }
}

// ... (The rest of your script.js file is unchanged)
// Fetch and display detailed view of a single device
async function fetchDeviceDetails(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/device/${deviceId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        deviceNameHeader.textContent = data.name;
        deviceStatusSpan.textContent = data.status;
        deviceStatusSpan.className = `status-badge status-${data.status.toLowerCase()}`;
        deviceRiskP.textContent = `${(data.failure_risk * 100).toFixed(1)}%`;
        deviceCpuP.textContent = `${data.cpu_usage}%`;
        deviceMemoryP.textContent = `${data.memory_usage}%`;
        deviceDiskP.textContent = `${data.disk_usage}%`;
        deviceNetIoP.textContent = `${(data.net_io / (1024*1024)).toFixed(2)} MB`;
        
        const historyResponse = await fetch(`${API_BASE_URL}/device/${deviceId}/history`);
        allHistoricalData = await historyResponse.json();
        updateCharts(data, allHistoricalData, currentSelectedRange);
    } catch (error) {
        console.error('Error fetching device details:', error);
    }
}

function showDeviceDetails(deviceId) {
    homeView.classList.remove('active');
    fileSharingView.classList.remove('active');
    deviceView.classList.add('active');
    selectedDeviceId = deviceId;
    clearInterval(deviceDetailsInterval);
    fetchDeviceDetails(deviceId);
    deviceDetailsInterval = setInterval(() => fetchDeviceDetails(deviceId), 5000);
}

function filterDataByTimeRange(data, minutes) {
    const now = Date.now();
    const startTime = now - minutes * 60 * 1000;
    return data.filter(d => d.timestamp * 1000 >= startTime);
}

function updateCharts(currentData, historicalData, minutes) {
    const filteredData = filterDataByTimeRange(historicalData, minutes);
    
    if (usageChart) usageChart.destroy();
    if (riskLineChart) riskLineChart.destroy();

    const chartOptions = {
        layout: { padding: { left: 10, right: 20, top: 10, bottom: 10 } },
        scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: 'Percentage (%)', color: 'white' }, grid: { color: 'rgba(255, 255, 255, 0.2)' }, ticks: { color: 'white', padding: 5 } },
            x: { grid: { color: 'rgba(255, 255, 255, 0.2)' }, ticks: { color: 'white' } }
        },
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'white' } } }
    };

    const labels = filteredData.map(d => new Date(d.timestamp * 1000).toLocaleTimeString());
    
    usageChart = new Chart(usageChartCanvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'CPU Usage', data: filteredData.map(d => d.cpu_usage), borderColor: '#4ade80', backgroundColor: 'rgba(74, 222, 128, 0.2)', tension: 0.4, pointRadius: 1 },
                { label: 'Memory Usage', data: filteredData.map(d => d.memory_usage), borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.2)', tension: 0.4, pointRadius: 1 }
            ]
        },
        options: chartOptions
    });

    riskLineChart = new Chart(riskLineChartCanvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Failure Probability', data: filteredData.map(d => d.failure_probability * 100), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', tension: 0.4, pointRadius: 1 }]
        },
        options: chartOptions
    });
}

function showHomeView() {
    deviceView.classList.remove('active');
    fileSharingView.classList.remove('active');
    homeView.classList.add('active');
    selectedDeviceId = null;
    clearInterval(deviceDetailsInterval);
}

async function showFileSharingView() {
    homeView.classList.remove('active');
    deviceView.classList.remove('active');
    fileSharingView.classList.add('active');
    selectedDeviceId = null;
    clearInterval(deviceDetailsInterval);

    try {
        const response = await fetch(`${API_BASE_URL}/devices`);
        const devices = await response.json();
        deviceSelect.innerHTML = '<option value="">-- Please choose a device --</option>';
        if (devices.length > 0) {
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.device_id;
                option.textContent = device.name;
                deviceSelect.appendChild(option);
            });
        } else {
            deviceSelect.innerHTML = '<option value="">-- No active devices found --</option>';
        }
    } catch (error) {
        console.error('Failed to load devices for dropdown:', error);
        deviceSelect.innerHTML = '<option value="">-- Error loading devices --</option>';
    }
}

async function uploadFile() {
    const selectedFile = fileInput.files[0];
    const selectedDevice = deviceSelect.value;

    if (!selectedFile) {
        uploadStatus.textContent = '⚠️ Please select a file first.';
        uploadStatus.className = 'status-warning';
        return;
    }
    if (!selectedDevice) {
        uploadStatus.textContent = '⚠️ Please select a target device.';
        uploadStatus.className = 'status-warning';
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    uploadStatus.textContent = `Uploading ${selectedFile.name}...`;
    uploadStatus.className = '';

    try {
        const response = await fetch(`${API_BASE_URL}/files/upload/${selectedDevice}`, { method: 'POST', body: formData });
        if (response.ok) {
            const result = await response.json();
            uploadStatus.textContent = `✅ ${result.message}`;
            uploadStatus.className = 'status-success';
            fileInput.value = '';
        } else {
            const error = await response.json();
            uploadStatus.textContent = `❌ Error: ${error.detail || 'Upload failed'}`;
            uploadStatus.className = 'status-error';
        }
    } catch (error) {
        uploadStatus.textContent = '❌ Network Error: Could not connect to the server.';
        uploadStatus.className = 'status-error';
    }
}

// --- Event Listeners ---
homeButton.addEventListener('click', showHomeView);
goToFilesButton.addEventListener('click', showFileSharingView);
uploadButton.addEventListener('click', uploadFile);

healthyCard.addEventListener('click', () => showDevicesInModal('Healthy'));
warningCard.addEventListener('click', () => showDevicesInModal('Warning'));
criticalCard.addEventListener('click', () => showDevicesInModal('Critical'));

modalCloseButton.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
        modalOverlay.classList.remove('active');
    }
});

document.querySelectorAll('.time-range-buttons').forEach(container => {
    container.querySelectorAll('.time-range-button').forEach(button => {
        button.addEventListener('click', (e) => {
            container.querySelectorAll('.time-range-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentSelectedRange = parseInt(e.target.dataset.minutes);
            if (selectedDeviceId && allHistoricalData) {
                const latestData = {}; // Just a placeholder
                updateCharts(latestData, allHistoricalData, currentSelectedRange);
            }
        });
    });
});

// Initial load
fetchAndRenderDevices();
setInterval(fetchAndRenderDevices, 5000);