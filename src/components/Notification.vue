<template>
  <div class="app-container">
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <button class="back-btn" @click="$router.back()" aria-label="Back">
          <ChevronLeft class="back-icon" />
        </button>
        <h1 class="header-title">Event History</h1>
      </div>
    </div>

    <div class="event-list">
      <div v-if="loading" class="empty">Loading events…</div>
      <div v-else-if="events.length === 0" class="empty">No notifications yet</div>

      <div v-else class="event-items">
        <div v-for="e in events" :key="e.id" class="event-card" :class="{ detailed: e.type !== 'safe' }">
          <div class="event-content">
            <div class="event-left">
              <div class="status-icon" :class="e.type">
                <component :is="iconFor(e.type)" class="icon" />
              </div>
              <div class="event-info">
                <div class="event-date">{{ formatDate(e.dateTime) }}</div>
                <div class="event-status">{{ e.title }}</div>
                <div class="event-device">{{ e.deviceName }}</div>
              </div>
            </div>
            <div class="event-right">
              <div class="event-time">{{ formatTime(e.dateTime) }}</div>
              <div v-if="e.temperature !== undefined" class="temperature">{{ e.temperature }}°C</div>
            </div>
          </div>
          <div v-if="e.details" class="event-details">
            <div v-for="(val, key) in e.details" :key="key" class="detail-item">
              <span class="detail-label">{{ key }}:</span> {{ val }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronLeft, Check, AlertTriangle, Bell } from 'lucide-vue-next'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { ref as dbRef, onValue } from 'firebase/database'
import { db, rtdb } from '@/firebase'

const loading = ref(true)
const events = ref([])
let detachFns = []

function iconFor(type) {
  if (type === 'alarm') return Bell
  if (type === 'alert') return AlertTriangle
  return Check
}

function formatTime(date) {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(date)
  } catch { return '' }
}
function formatDate(date) {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
  } catch { return '' }
}

function classify(entry) {
  if (!entry) return { type: 'safe', title: 'Safe' }
  if (entry.message === 'help requested') return { type: 'alert', title: 'Help Requested' }
  if (entry.message === 'alarm has been triggered') return { type: 'alarm', title: 'Alarm Triggered' }
  const smoke = entry.smokeLevel ?? entry.smoke ?? 0
  if (typeof smoke === 'number' && smoke > 1500) return { type: 'alert', title: 'High Smoke' }
  if (entry.status === 'Alert') return { type: 'alert', title: 'Alert' }
  return { type: 'safe', title: 'Safe' }
}

async function buildListeners() {
  loading.value = true
  events.value = []
  detachFns.forEach(off => off())
  detachFns = []

  // Get devices registry
  const snap = await getDocs(collection(db, 'devices'))
  const docs = snap.docs
  if (docs.length === 0) {
    loading.value = false
    return
  }

  // For each device, read metadata (name) and subscribe to readings + current node
  for (const d of docs) {
    const id = d.id
    let name = d.data().name || id
    try {
      // refresh name from Firestore doc (in case)
      const meta = await getDoc(doc(db, 'devices', id))
      if (meta.exists()) name = meta.data().name || name
    } catch {}

    // Listen to current snapshot
    const curRef = dbRef(rtdb, `devices/${id}`)
    const offCur = onValue(curRef, (s) => {
      const val = s.val()
      if (!val) return
      const dt = val.timestamp ? new Date(val.timestamp) : new Date()
      const cls = classify(val)
      // Only push non-safe items as notifications
      if (cls.type !== 'safe') {
        events.value.unshift({
          id: `${id}-current-${dt.getTime()}`,
          deviceId: id,
          deviceName: name,
          dateTime: dt,
          temperature: val.temperature,
          details: val.gasStatus ? { Gas: val.gasStatus } : null,
          type: cls.type,
          title: cls.title
        })
        // keep list reasonable
        events.value = events.value
          .sort((a,b) => b.dateTime - a.dateTime)
          .slice(0, 50)
      }
    })
    detachFns.push(() => offCur())

    // Listen to history if exists
    const histRef = dbRef(rtdb, `devices/${id}/readings`)
    const offHist = onValue(histRef, (s) => {
      const obj = s.val()
      if (!obj) return
      const list = Object.entries(obj).map(([key, v]) => {
        const dt = v.timestamp ? new Date(v.timestamp) : new Date()
        const cls = classify(v)
        return {
          id: `${id}-hist-${key}`,
          deviceId: id,
          deviceName: name,
          dateTime: dt,
          temperature: v.temperature,
          details: v.gasStatus ? { Gas: v.gasStatus } : null,
          type: cls.type,
          title: cls.title
        }
      })
      // Only keep alert/alarm/help entries
      const filtered = list.filter(e => e.type !== 'safe')
      // Merge with current events (dedupe by id)
      const map = new Map(events.value.map(e => [e.id, e]))
      filtered.forEach(e => map.set(e.id, e))
      events.value = Array.from(map.values()).sort((a,b) => b.dateTime - a.dateTime).slice(0, 100)
    })
    detachFns.push(() => offHist())
  }

  loading.value = false
}

onMounted(() => {
  buildListeners()
})
onUnmounted(() => {
  detachFns.forEach(off => off())
  detachFns = []
})
</script>

<style scoped>
.app-container {
  max-width: 400px;
  margin: 0 auto;
  background-color: #f5f5f5;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  background-color: #dc2626;
  height: 80px;
  display: flex;
  align-items: flex-end;
  padding-bottom: 16px;
}

.header-content {
  display: flex;
  align-items: center;
  padding: 0 16px;
  color: white;
}

.back-icon {
  width: 24px;
  height: 24px;
  margin-right: 8px;
  cursor: pointer;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.event-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 100px;
}

.event-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.event-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.event-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.status-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-icon.safe {
  background-color: #22c55e;
}

.status-icon.alert {
  background-color: #eab308;
}

.status-icon.alarm {
  background-color: #ef4444;
}

.icon {
  width: 18px;
  height: 18px;
  color: white;
}

.event-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-date {
  font-size: 13px;
  color: #6b7280;
}

.event-status {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.event-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-time {
  font-size: 13px;
  color: #6b7280;
}

.temperature {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.event-details {
  margin-top: 16px;
  margin-left: 44px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-item {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.4;
}

.detail-label {
  font-weight: 600;
  color: #374151;
}

.back-btn { background: none; border: none; color: white; display: flex; align-items: center; }
</style>