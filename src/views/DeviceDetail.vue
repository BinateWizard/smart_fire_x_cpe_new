<template>
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
      <!-- Status Circle -->
      <div class="status-section" v-if="latest">
        <div class="status-circle" :class="{ 'alert-circle': latest.status === 'Alert' }">
          <div class="status-icon-container">
            <Bell class="status-bell-icon" />
          </div>
        </div>
        <div class="status-label" :class="{ 'alert-label': latest.status === 'Alert' }">
          {{ latest.status }}
        </div>
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
          <div class="gas-status" :class="{ 'gas-high': latest.gasStatus === 'high' }">
            {{ latest.gasStatus === 'high' ? '⚠️ HIGH' : '✅ NORMAL' }}
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
                <div class="history-status">{{ entry.status }}</div>
                <div class="history-time">
                  {{ formatTime(entry.dateTime) }}, {{ formatDate(entry.dateTime) }}
                </div>
              </div>
            </div>
            <div class="history-temperature" v-if="entry.temperature !== undefined">
              {{ entry.temperature }}°C
            </div>
            <div class="history-temperature" v-else-if="entry.message === 'help requested'">
              🆘 Help
            </div>
            <div class="history-temperature" v-else-if="entry.message === 'alarm has been triggered'">
              🔥 Alarm
            </div>

            <!-- Show Smoke & Gas in History -->
            <div class="history-extra" v-if="entry.smokeAnalog !== undefined">
              Smoke: {{ getSmokeLevel(entry.smokeAnalog) }}%
              <span v-if="entry.gasStatus === 'high'" style="color: #eab308; margin-left: 8px;">⚡ Gas: High</span>
            </div>
          </div>
        </div>
        <div v-else class="no-data">No history available for this device</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import showMap from "@/components/showMap.vue";
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRoute } from "vue-router";
import { 
  collection, query, orderBy, limit, getDocs, where,
  doc, getDoc
} from "firebase/firestore";
import { db } from "@/firebase";
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

function closeMap() {
  showMapModal.value = false;
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
  try {
    const q = query(
      collection(db, "sensors"),
      where("deviceId", "==", deviceId.value),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dateTime: doc.data().createdAt?.toDate?.() || new Date()
    }));

    results.forEach(entry => {
      if (entry.message === "help requested" || entry.message === "alarm has been triggered") {
        entry.status = "Alert";
      } else if (entry.smokeAnalog !== undefined) {
        entry.status = entry.smokeAnalog > 1500 ? "Alert" : "Safe";
      } else {
        entry.status = "Safe";
      }
    });

    latest.value = results[0] || null;
    history.value = results;
    lastUpdated.value = new Date();

    console.log("✅ Device data refreshed at:", lastUpdated.value.toLocaleTimeString());
  } catch (error) {
    console.error("❌ Error fetching device data:", error);
  }
}

onMounted(() => {
  fetchDeviceInfo();
  fetchData();

  const intervalId = setInterval(fetchData, 60000);
  onUnmounted(() => {
    clearInterval(intervalId);
  });
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
.app-container {
  max-width: 400px;
  margin: 0 auto;
  background-color: #fffaf0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
</style>
