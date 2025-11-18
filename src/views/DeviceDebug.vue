<template>
  <div class="debug-container">
    <div class="debug-header">
      <h1>🔧 Device Debug Tool</h1>
      <button @click="$router.back()" class="btn-back">Back</button>
    </div>

    <div class="debug-section">
      <h2>Check Device in RTDB</h2>
      <input 
        v-model="testDeviceId" 
        placeholder="Enter Device ID (e.g., DEVICE_001)"
        class="debug-input"
      />
      <button @click="checkDevice" class="btn-check" :disabled="checking">
        {{ checking ? 'Checking...' : 'Check Device' }}
      </button>

      <div v-if="result" class="result-box" :class="result.exists ? 'success' : 'error'">
        <h3>{{ result.exists ? '✅ Device Found!' : '❌ Device Not Found' }}</h3>
        <p>{{ result.message }}</p>
        <div v-if="result.data" class="data-preview">
          <strong>RTDB Data:</strong>
          <pre>{{ JSON.stringify(result.data, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <div class="debug-section">
      <h2>Registered Devices</h2>
      <button @click="loadDevices" class="btn-check">Refresh List</button>
      <div v-if="devices.length > 0" class="device-list">
        <div v-for="dev in devices" :key="dev.id" class="device-item">
          <strong>{{ dev.name }}</strong> ({{ dev.id }})
          <button @click="testDeviceId = dev.id; checkDevice()" class="btn-small">Test</button>
        </div>
      </div>
      <div v-else class="empty">No devices registered yet</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import { ref as dbRef, get } from 'firebase/database'
import { db, rtdb } from '@/firebase'

const testDeviceId = ref('DEVICE_001')
const checking = ref(false)
const result = ref(null)
const devices = ref([])

async function checkDevice() {
  if (!testDeviceId.value.trim()) return
  
  checking.value = true
  result.value = null

  try {
    const deviceRef = dbRef(rtdb, `devices/${testDeviceId.value.trim()}`)
    const snapshot = await get(deviceRef)

    if (snapshot.exists()) {
      result.value = {
        exists: true,
        message: `Device "${testDeviceId.value}" is sending data to RTDB!`,
        data: snapshot.val()
      }
    } else {
      result.value = {
        exists: false,
        message: `Device "${testDeviceId.value}" not found in RTDB. Check:\n• ESP32 is powered on\n• WiFi connected\n• Device ID matches exactly\n• ESP32 Serial Monitor shows "Sent periodic reading"`
      }
    }
  } catch (error) {
    result.value = {
      exists: false,
      message: `Error: ${error.message}`
    }
  } finally {
    checking.value = false
  }
}

async function loadDevices() {
  try {
    const snap = await getDocs(collection(db, 'devices'))
    devices.value = snap.docs.map(d => ({
      id: d.id,
      name: d.data().name || d.id
    }))
  } catch (error) {
    console.error('Error loading devices:', error)
  }
}

loadDevices()
</script>

<style scoped>
.debug-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
  background: #fffaf0;
  min-height: 100vh;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.debug-header h1 {
  margin: 0;
  font-size: 24px;
}

.btn-back {
  padding: 8px 16px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.debug-section {
  background: white;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.debug-section h2 {
  margin-top: 0;
  font-size: 18px;
  color: #374151;
}

.debug-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  margin-bottom: 12px;
}

.btn-check {
  width: 100%;
  padding: 12px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn-check:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-box {
  margin-top: 16px;
  padding: 16px;
  border-radius: 8px;
}

.result-box.success {
  background: #d1fae5;
  border: 2px solid #22c55e;
}

.result-box.error {
  background: #fee2e2;
  border: 2px solid #ef4444;
}

.result-box h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
}

.result-box p {
  margin: 0 0 12px 0;
  white-space: pre-line;
  color: #374151;
}

.data-preview {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 6px;
  margin-top: 12px;
}

.data-preview pre {
  margin: 8px 0 0 0;
  font-size: 12px;
  overflow-x: auto;
}

.device-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.btn-small {
  padding: 6px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.empty {
  text-align: center;
  color: #9ca3af;
  padding: 24px;
}
</style>
