<template>
  <div class="page-wrapper">
  <div class="app-container">
    <!-- Header with back button -->
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <ChevronLeft class="back-icon" />
      </button>
      <h1 class="header-title">{{ deviceName }}</h1>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-section">
        <div class="loading-spinner">⏳</div>
        <div class="loading-text">Connecting to device...</div>
      </div>

      <!-- No Data State -->
      <div v-else-if="noData" class="no-data-section">
        <div class="no-data-icon">📡</div>
        <div class="no-data-title">Device Offline</div>
        <div class="no-data-text">{{ deviceName }} is not sending data to Realtime Database.</div>
        <div class="no-data-hint">Check: /devices/{{ deviceId }}</div>
      </div>

      <!-- Device Dashboard (when data available) -->
      <div v-else :key="deviceId">
      <!-- Status Circle -->
      <div class="status-section" v-if="latest && typeof latest === 'object' && latest.status">
        <div class="status-circle" :class="{ 'alert-circle': latest.status === 'Alert' }">
          <div class="status-icon-container">
            <Bell class="status-bell-icon" />
          </div>
        </div>
        <div class="status-label" :class="{ 'alert-label': latest.status === 'Alert' }">
          {{ latest.status }}
        </div>
      </div>

      <!-- Sensor Error Warning -->
      <div v-if="latest && latest.sensorError === true" class="error-banner">
        ⚠️ <strong>Sensor Error Detected</strong><br>
        DHT11 sensor is not responding. Check wiring and power.
      </div>

      <!-- Alarm Alert -->
      <div v-if="latest && latest.lastType === 'alarm'" class="alert-banner">
        🔥 <strong>Alarm Triggered!</strong><br>
        Device detected critical condition at {{ formatTime(latest.dateTime) }}
      </div>

      <!-- Gas Alert -->
      <div v-if="latest && (latest.gasStatus === 'detected' || latest.gasStatus === 'critical')" class="warning-banner">
        ⚠️ <strong>Gas Detected!</strong><br>
        Critical gas levels detected. Take immediate action.
      </div>

      <!-- Time and Date -->
      <div class="time-section" v-if="latest">
        <div class="current-time">{{ formatTime(latest.dateTime) }}</div>
        <div class="current-date">{{ formatDate(latest.dateTime) }}</div>
      </div>

      <!-- Location -->
      <div class="location-section" v-if="deviceLocation">
        <MapPin class="location-icon" />
        <span class="location-text">{{ deviceLocation }}</span>
      </div>

      <!-- Smoke & Gas Indicators -->
      <div class="sensor-section" v-if="latest">
        <div class="sensor-item">
          <label>SMOKE LEVEL</label>
          <div class="smoke-bar-container">
            <div 
              class="smoke-bar" 
              :style="{ width: smokePercentage + '%', backgroundColor: getSmokeColor(smokePercentage) }"
            ></div>
            <span class="smoke-value">{{ smokePercentage }}%</span>
          </div>
        </div>

        <div class="sensor-item">
          <label>GAS STATUS</label>
          <div class="gas-status" :class="{ 'gas-high': latest.gasStatus === 'detected' || latest.gasStatus === 'critical' || latest.gasStatus === 'high' }">
            <span v-if="latest.gasStatus === 'detected' || latest.gasStatus === 'critical'">⚠️ DETECTED</span>
            <span v-else-if="latest.gasStatus === 'high'">⚠️ HIGH</span>
            <span v-else>✅ NORMAL</span>
          </div>
        </div>
      </div>

      <showMap v-if="showMapModal" @close="closeMap" />

      <!-- Recent Status History -->
      <div class="history-section">
        <h2 class="history-title">RECENT STATUS HISTORY</h2>
        <div class="history-list" v-if="history.length > 0">
          <div 
            v-for="entry in history" 
            :key="entry.id" 
            class="history-item"
          >
            <div class="history-left">
              <div 
                class="history-icon" 
                :class="entry.status === 'Safe' ? 'safe' : 'alert'"
              >
                <component :is="entry.status === 'Safe' ? Check : AlertTriangle" class="icon" />
              </div>
              <div class="history-info">
                <div class="history-status">
                  <span v-if="entry.lastType === 'alarm'">🔥 Alarm Triggered</span>
                  <span v-else-if="entry.sensorError">⚠️ Sensor Error</span>
                  <span v-else-if="entry.gasStatus === 'detected' || entry.gasStatus === 'critical'">⚠️ Gas Detected</span>
                  <span v-else>{{ (entry.status === 'Alert' || entry.status === 'Safe') ? entry.status : 'Safe' }}</span>
                </div>
                <div class="history-time">
                  {{ formatTime(entry.dateTime) }}, {{ formatDate(entry.dateTime) }}
                </div>
              </div>
            </div>
              <!-- Metrics as labeled badges for clarity -->
              <div class="history-metrics">
                <span 
                  v-if="entry.smokeAnalog !== undefined && !entry.sensorError"
                  class="badge"
                  :class="getSmokeBadgeClass(getSmokeLevel(entry.smokeAnalog))">
                  Smoke: {{ getSmokeLevel(entry.smokeAnalog) }}%
                </span>
                <span v-if="entry.temperature !== undefined && !entry.sensorError" class="badge temp">
                  Temp: {{ entry.temperature }}°C
                </span>
                <span v-if="entry.humidity !== undefined && !entry.sensorError" class="badge humidity">
                  Humidity: {{ entry.humidity }}%
                </span>
                <span v-if="entry.gasStatus && entry.gasStatus !== 'normal'" class="badge gas-alert">
                  Gas: Detected
                </span>
                <span v-else-if="entry.gasStatus" class="badge gas-normal">
                  Gas: Normal
                </span>
                <span v-if="entry.sensorError" class="badge error">Sensor Error</span>
                <span v-if="entry.message === 'help requested'" class="badge help">Help Requested</span>
                <span v-if="entry.message === 'alarm has been triggered'" class="badge alarm">Alarm</span>
              </div>
          </div>
        </div>
        <div v-else class="no-data">No history available for this device</div>
      </div>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup>
import showMap from "@/components/showMap.vue";
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRoute } from "vue-router";
import { doc, getDoc } from "firebase/firestore";
import { ref as dbRef, onValue, query, orderByChild, limitToLast } from "firebase/database";
import { db, rtdb } from "@/firebase";
import { 
  Bell, 
  MapPin, 
  Check, 
  AlertTriangle,
  ChevronLeft
} from 'lucide-vue-next'

const route = useRoute();
const deviceId = computed(() => route.params.deviceId);
const deviceName = ref('Loading...');
const deviceLocation = ref('');

const latest = ref(null);
const history = ref([]);
const lastUpdated = ref(new Date());
const showMapModal = ref(false);
const loading = ref(true);
const noData = ref(false);

function closeMap() {
  showMapModal.value = false;
}

// Defensive: remove any accidental JSON blobs rendered by extensions/old cache
function scrubDebugJSON() {
  try {
    const root = document.querySelector('.app-container');
    if (!root) return;
    const suspiciousKeys = [ '"gasStatus"', '"lastSeen"', '"lastType"', '"sensorError"' ];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const toHide = new Set();
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent?.trim();
      if (!t || t.length < 10) continue;
      if (t.startsWith('{') && t.endsWith('}') && suspiciousKeys.every(k => t.includes(k))) {
        if (n.parentElement) toHide.add(n.parentElement);
      }
    }
    toHide.forEach(el => {
      el.style.display = 'none';
    });
  } catch (_) {
    /* no-op */
  }
}

// Calculate smoke percentage from analog value (0–4095 → 0–100%)
function getSmokePercentage(analogValue) {
  const max = 4095;
  const min = 0;
  let percent = ((analogValue - min) / (max - min)) * 100;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

function getSmokeLevel(analogValue) {
  return getSmokePercentage(analogValue);
}

function getSmokeColor(percentage) {
  if (percentage > 80) return '#dc2626';
  if (percentage > 60) return '#eab308';
  return '#22c55e';
}

function getSmokeBadgeClass(percentage) {
  if (percentage > 80) return 'smoke-high';
  if (percentage > 60) return 'smoke-med';
  return 'smoke-low';
}

async function fetchDeviceInfo() {
  try {
    const deviceRef = doc(db, "devices", deviceId.value);
    const docSnap = await getDoc(deviceRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      deviceName.value = data.name || data.deviceId || deviceId.value;
      if (data.location && typeof data.location === 'string') {
        deviceLocation.value = data.location;
      } else if (data.location && data.location.lat) {
        deviceLocation.value = `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`;
      }
    } else {
      deviceName.value = deviceId.value;
    }
  } catch (error) {
    console.error("❌ Error fetching device info:", error);
    deviceName.value = deviceId.value;
  }
}

async function fetchData() {
  loading.value = true;
  noData.value = false;
  
  try {
    // Listen to live data from Realtime Database at /devices/{deviceId}
    const deviceDataRef = dbRef(rtdb, `devices/${deviceId.value}`);
    
    onValue(deviceDataRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        // Process current/latest data
        const currentData = {
          id: Date.now(),
          dateTime: data.lastSeen ? new Date(data.lastSeen) : (data.timestamp ? new Date(data.timestamp) : new Date()),
          smokeAnalog: data.smokeLevel || data.smoke || data.smokeAnalog || 0,
          gasStatus: data.gasStatus || 'normal',
          temperature: data.temperature,
          humidity: data.humidity,
          message: data.message || (data.sensorError ? 'Sensor Error' : ''),
          sensorError: data.sensorError || false,
          lastType: data.lastType,
          status: determineStatus(data)
        };
        
        latest.value = currentData;
        loading.value = false;
        noData.value = false;
        // Clean up any stray JSON blobs possibly injected by cache/extensions
        scrubDebugJSON();
        
        // Build history from readings if available
        if (data.readings && typeof data.readings === 'object') {
          const readingsArray = Object.entries(data.readings)
            .map(([key, value]) => ({
              id: key,
              dateTime: value.lastSeen ? new Date(value.lastSeen) : (value.timestamp ? new Date(value.timestamp) : new Date()),
              smokeAnalog: value.smokeLevel || value.smoke || value.smokeAnalog || 0,
              gasStatus: value.gasStatus || 'normal',
              temperature: value.temperature,
              humidity: value.humidity,
              message: value.message || (value.sensorError ? 'Sensor Error' : ''),
              sensorError: value.sensorError || false,
              status: determineStatus(value)
            }))
            .sort((a, b) => b.dateTime - a.dateTime)
            .slice(0, 10);
          
          history.value = readingsArray;
        } else {
          // If no history, just show current reading
          history.value = [currentData];
        }
        scrubDebugJSON();
        
        lastUpdated.value = new Date();
        console.log("✅ Device data updated at:", lastUpdated.value.toLocaleTimeString());
      } else {
        console.warn("⚠️ No data found for device:", deviceId.value);
        loading.value = false;
        noData.value = true;
        latest.value = null;
        history.value = [];
      }
    }, (error) => {
      console.error("❌ Error fetching device data:", error);
      loading.value = false;
      noData.value = true;
    });
  } catch (error) {
    console.error("❌ Error setting up data listener:", error);
  }
}

function determineStatus(data) {
  if (!data || typeof data !== 'object') return 'Safe';

  const toStr = (v) => String(v || '').toLowerCase();

  // Hard alert conditions
  if (data.sensorError === true) return 'Alert';
  if (data.message === 'help requested' || data.message === 'alarm has been triggered') return 'Alert';
  if (data.lastType === 'alarm') return 'Alert';
  if (['critical','detected','high'].includes(toStr(data.gasStatus))) return 'Alert';

  // If status is a string, normalize only if it's a known label
  if (typeof data.status === 'string') {
    const s = toStr(data.status).trim();
    if (s === 'alert' || s === 'unsafe') return 'Alert';
    if (s === 'safe' || s === 'normal') return 'Safe';
    // If it's JSON-like, try to parse and re-evaluate
    if (s.startsWith('{')) {
      try {
        const parsed = JSON.parse(data.status);
        return determineStatus(parsed);
      } catch (_) { /* ignore */ }
    }
  }

  // Smoke threshold check
  const smokeValue = data.smokeLevel ?? data.smoke ?? data.smokeAnalog ?? 0;
  if (typeof smokeValue === 'number' && smokeValue > 1500) return 'Alert';

  return 'Safe';
}

onMounted(() => {
  fetchDeviceInfo();
  fetchData(); // Sets up real-time listener
});

// Format helpers
function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true
  }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

const smokePercentage = computed(() => {
  return latest.value ? getSmokePercentage(latest.value.smokeAnalog) : 0;
});
</script>

<style scoped>
/* Defensive: Hide any accidental debug output */
pre, code {
  display: none !important;
}

.page-wrapper {
  width: 100%;
  min-height: 100vh;
  background-color: #fffaf0;
  position: relative;
  overflow: hidden;
}

.page-wrapper * {
  box-sizing: border-box;
}

.app-container {
  max-width: 400px;
  margin: 0 auto;
  background-color: #fffaf0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
}

.header {
  background-color: #dc2626;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
}

.back-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
}

.back-icon {
  width: 24px;
  height: 24px;
}

.header-title {
  color: white;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.main-content {
  padding: 24px 20px;
  padding-bottom: 88px;
  flex: 1;
}

.error-banner {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border: 2px solid #ef4444;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: center;
  color: #991b1b;
  font-size: 14px;
  line-height: 1.6;
}

.alert-banner {
  background: linear-gradient(135deg, #fed7aa 0%, #fdba74 100%);
  border: 2px solid #f97316;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: center;
  color: #7c2d12;
  font-size: 14px;
  line-height: 1.6;
}

.warning-banner {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #eab308;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: center;
  color: #713f12;
  font-size: 14px;
  line-height: 1.6;
}

.error-banner strong {
  font-size: 16px;
  display: block;
  margin-bottom: 4px;
}

.status-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}

.status-circle {
  width: 140px;
  height: 140px;
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  position: relative;
}

.status-circle.alert-circle {
  background: linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%);
}

.status-circle::before {
  content: '';
  position: absolute;
  width: 100px;
  height: 100px;
  background-color: #22c55e;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.status-circle.alert-circle::before {
  background-color: #ef4444;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.status-icon-container {
  position: relative;
  z-index: 1;
}

.status-bell-icon {
  width: 40px;
  height: 40px;
  color: white;
}

.status-label {
  background-color: #bbf7d0;
  color: #166534;
  font-size: 18px;
  font-weight: 700;
  padding: 8px 24px;
  border-radius: 6px;
  letter-spacing: 1px;
}

.status-label.alert-label {
  background-color: #fca5a5;
  color: #7f1d1d;
}

.time-section {
  text-align: center;
  margin-bottom: 24px;
}

.current-time {
  font-size: 48px;
  font-weight: 300;
  color: #111827;
  margin-bottom: 4px;
}

.current-date {
  font-size: 16px;
  color: #6b7280;
  font-weight: 500;
}

.location-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 40px;
}

.location-icon {
  width: 20px;
  height: 20px;
  color: #374151;
}

.location-text {
  font-size: 16px;
  color: #374151;
  font-weight: 500;
}

.sensor-section {
  margin: 32px 0;
  padding: 16px;
  background-color: #f3f4f6;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.sensor-item {
  margin-bottom: 16px;
}

.sensor-item:last-child {
  margin-bottom: 0;
}

.sensor-item label {
  display: block;
  font-size: 14px;
  color: #6b7280;
  font-weight: 600;
  margin-bottom: 6px;
}

.smoke-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.smoke-bar {
  flex-grow: 1;
  height: 12px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.smoke-value {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  min-width: 40px;
  text-align: right;
}

.gas-status {
  font-size: 16px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  background-color: #d1fae5;
  color: #065f46;
}

.gas-status.gas-high {
  background-color: #fef3c7;
  color: #92400e;
}

.history-section {
  margin-top: 32px;
}

.history-title {
  font-size: 16px;
  font-weight: 700;
  color: #374151;
  margin: 0 0 20px 0;
  letter-spacing: 0.5px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.history-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.history-icon.safe {
  background-color: #22c55e;
}

.history-icon.alert {
  background-color: #eab308;
}

.icon {
  width: 14px;
  height: 14px;
  color: white;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-status {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.history-time {
  font-size: 13px;
  color: #6b7280;
}

.history-temperature {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.history-extra {
  font-size: 13px;
  color: #6b7280;
  margin-top: 6px;
  padding-left: 36px;
}

.no-data {
  text-align: center;
  color: #9ca3af;
  padding: 40px 20px;
  font-size: 15px;
}

.loading-section,
.no-data-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.loading-spinner {
  font-size: 48px;
  margin-bottom: 16px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 16px;
  color: #6b7280;
}

.no-data-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-data-title {
  font-size: 20px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.no-data-text {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 12px;
}

.no-data-hint {
  font-size: 12px;
  color: #9ca3af;
  font-family: monospace;
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 6px;
}
</style>
