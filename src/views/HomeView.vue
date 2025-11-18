<template>
  <div class="app-container">
    <!-- Fixed Top Navigation -->
    <div class="top-nav">
      <button @click="toggleMenu" class="nav-btn" aria-label="Menu">
        <Menu class="nav-icon" />
      </button>
      <div class="nav-spacer"></div>
      <button @click="goToNotifications" class="nav-btn" aria-label="Notifications">
        <Bell class="nav-icon" />
      </button>
      <button @click="goToLocation" class="nav-btn" aria-label="Location">
        <MapPin class="nav-icon" />
      </button>
    </div>

    <!-- Side Drawer Menu -->
    <transition name="drawer">
      <div v-if="menuOpen" class="drawer-overlay" @click="toggleMenu">
        <div class="drawer" @click.stop>
          <div class="drawer-header">
            <h2>Menu</h2>
            <button @click="toggleMenu" class="close-btn" aria-label="Close">
              <X class="nav-icon" />
            </button>
          </div>
          <nav class="drawer-nav">
            <a @click="navigateTo('/')" class="drawer-link">
              <Bell class="drawer-icon" /> Devices
            </a>
            <a @click="navigateTo('/notifications')" class="drawer-link">
              <Bell class="drawer-icon" /> Notifications
            </a>
            <a @click="navigateTo('/map')" class="drawer-link">
              <MapPin class="drawer-icon" /> Location
            </a>
            <a @click="navigateTo('/settings')" class="drawer-link">
              <Settings class="drawer-icon" /> Settings
            </a>
          </nav>
        </div>
      </div>
    </transition>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Stats Overview -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ devices.length }}</div>
          <div class="stat-label">Total Devices</div>
        </div>
        <div class="stat-card safe">
          <div class="stat-value">{{ safeDevicesCount }}</div>
          <div class="stat-label">Safe</div>
        </div>
        <div class="stat-card alert">
          <div class="stat-value">{{ alertDevicesCount }}</div>
          <div class="stat-label">Alerts</div>
        </div>
      </div>

      <!-- Add Device Button -->
      <div class="button-row">
        <button @click="$router.push('/add-device')" class="add-device-btn">
          <Plus class="icon" />
          Add New Device
        </button>
        <button @click="$router.push('/debug')" class="debug-btn" title="Test Device Connection">
          🔧
        </button>
      </div>

      <!-- Device List -->
      <div class="devices-section">
        <h2 class="section-title">My Devices</h2>
        
        <div v-if="loading" class="loading">Loading devices...</div>
        
        <div v-else-if="devices.length === 0" class="empty-state">
          <Inbox class="empty-icon" />
          <p>No devices registered yet</p>
          <button @click="$router.push('/add-device')" class="btn-primary-small">
            Add Your First Device
          </button>
        </div>

        <div v-else class="device-list">
          <div 
            v-for="device in devices" 
            :key="device.id" 
            class="device-card"
            @click="$router.push(`/device/${device.id}`)"
          >
            <div class="device-icon" :class="getStatusClass(device.status)">
              <Bell class="icon" />
            </div>
            <div class="device-info">
              <div class="device-name">{{ device.name || device.id }}</div>
              <div class="device-location" v-if="device.location">
                <MapPin class="loc-icon" />
                {{ device.location }}
              </div>
              <div class="device-status">
                Last update: {{ formatRelativeTime(device.updatedAt) }}
              </div>
            </div>
            <div class="device-status-badge" :class="getStatusClass(device.status)">
              {{ device.status || 'Safe' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { ref as dbRef, onValue } from "firebase/database";
import { db, rtdb, auth } from "@/firebase";
import { Bell, MapPin, Plus, Inbox, Menu, X, Settings } from 'lucide-vue-next';

const router = useRouter();

const devices = ref([]);
const loading = ref(true);
const menuOpen = ref(false);

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function navigateTo(path) {
  menuOpen.value = false;
  router.push(path);
}

function goToNotifications() {
  router.push('/notifications');
}

function goToLocation() {
  router.push('/map');
}

function getStatusClass(status) {
  const statusStr = String(status || 'safe');
  return statusStr.toLowerCase();
}

const safeDevicesCount = computed(() => 
  devices.value.filter(d => d.status === 'Safe').length
);

const alertDevicesCount = computed(() => 
  devices.value.filter(d => d.status === 'Alert').length
);

async function fetchDevices() {
  loading.value = true;
  try {
    // Get device list from Firestore (device registry) - accessible by all users
    const q = query(
      collection(db, "devices"),
      orderBy("updatedAt", "desc")
    );
    const snapshot = await getDocs(q);
    
    const deviceList = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      status: 'Loading...', // Will be updated from Realtime DB
      updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
    }));

    devices.value = deviceList;

    // Fetch live status from Realtime Database for each device
    deviceList.forEach(device => {
      const deviceDataRef = dbRef(rtdb, `devices/${device.id}`);
      onValue(deviceDataRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const deviceIndex = devices.value.findIndex(d => d.id === device.id);
          if (deviceIndex !== -1) {
            // Extract status as a clean string
            devices.value[deviceIndex].status = determineStatus(data);
            // Use lastSeen or timestamp for update time
            const timestamp = data.lastSeen || data.timestamp;
            devices.value[deviceIndex].updatedAt = timestamp ? new Date(timestamp) : new Date();
            // Store gas status for display
            devices.value[deviceIndex].gasStatus = data.gasStatus || 'normal';
            devices.value[deviceIndex].lastType = data.lastType || 'normal';
          }
        } else {
          // Device not sending data yet
          const deviceIndex = devices.value.findIndex(d => d.id === device.id);
          if (deviceIndex !== -1) {
            devices.value[deviceIndex].status = 'Offline';
          }
        }
      });
    });

    console.log("✅ Devices loaded:", devices.value.length);
  } catch (error) {
    console.error("❌ Error fetching devices:", error);
  } finally {
    loading.value = false;
  }
}

function determineStatus(data) {
  // Always return a string, never an object
  if (!data || typeof data !== 'object') return 'Safe';
  
  // Check for sensor error
  if (data.sensorError === true) return 'Alert';
  
  // Check lastType field
  if (data.lastType === 'alarm') return 'Alert';
  
  // Check for critical gas status
  if (data.gasStatus === 'critical' || data.gasStatus === 'detected') return 'Alert';
  
  // Check messages
  if (data.message === 'help requested' || data.message === 'alarm has been triggered') {
    return 'Alert';
  }
  
  // Check smoke levels
  if (data.smokeLevel !== undefined || data.smoke !== undefined || data.smokeAnalog !== undefined) {
    const smokeValue = data.smokeLevel || data.smoke || data.smokeAnalog || 0;
    if (typeof smokeValue === 'number' && smokeValue > 1500) return 'Alert';
  }
  
  // Fallback to normal
  return 'Safe';
}

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

onMounted(() => {
  fetchDevices(); // Real-time listeners are set up inside
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

/* Fixed Top Navigation */
.top-nav {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  max-width: 400px;
  width: 100%;
  background-color: #dc2626;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.nav-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.2s;
}

.nav-btn:active {
  background: rgba(255, 255, 255, 0.15);
}

.nav-icon {
  width: 24px;
  height: 24px;
}

.nav-spacer {
  flex: 1;
}

/* Drawer Menu */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
}

.drawer {
  width: 280px;
  background: white;
  height: 100vh;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  background: #dc2626;
  color: white;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  display: flex;
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  color: #374151;
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.drawer-link:hover {
  background: #f3f4f6;
}

.drawer-icon {
  width: 20px;
  height: 20px;
  color: #6b7280;
}

/* Drawer Animation */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.3s;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(-100%);
}

.main-content {
  padding: 84px 20px 24px 20px;
  flex: 1;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}

.stat-card.safe {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
}

.stat-card.alert {
  background: linear-gradient(135deg, #fee2e2 0%, #fca5a5 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}

.button-row {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
}

.add-device-btn {
  flex: 1;
  padding: 14px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;
}

.add-device-btn:hover {
  background: #b91c1c;
}

.add-device-btn .icon {
  width: 20px;
  height: 20px;
}

.debug-btn {
  width: 52px;
  height: 52px;
  padding: 0;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 24px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.debug-btn:hover {
  background: #4b5563;
}

.devices-section {
  margin-top: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #374151;
  margin: 0 0 16px 0;
}

.loading {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #d1d5db;
  margin: 0 auto 16px;
}

.empty-state p {
  font-size: 16px;
  color: #6b7280;
  margin: 0 0 20px 0;
}

.btn-primary-small {
  padding: 10px 20px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.device-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.device-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.device-icon.safe {
  background: #dcfce7;
}

.device-icon.alert {
  background: #fee2e2;
}

.device-icon .icon {
  width: 24px;
  height: 24px;
  color: #374151;
}

.device-info {
  flex: 1;
}

.device-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.device-location {
  font-size: 13px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.loc-icon {
  width: 12px;
  height: 12px;
}

.device-status {
  font-size: 12px;
  color: #9ca3af;
}

.device-status-badge {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.device-status-badge.safe {
  background: #dcfce7;
  color: #166534;
}

.device-status-badge.alert {
  background: #fee2e2;
  color: #991b1b;
}
</style>
