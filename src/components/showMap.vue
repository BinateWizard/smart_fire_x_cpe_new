<template>
  <div class="map-container">
    <div class="map-header">
      <button class="close-btn" @click="close">Close</button>
    </div>
    <div id="map"></div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { defineEmits } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const emit = defineEmits(['close'])
const router = useRouter()
const route = useRoute()

let map = null

function close() {
  // Notify parent (modal) that it should close
  emit('close')

  // If this component was visited via the /map route, navigate away so Close does something
  if (route.name === 'map' || route.path === '/map') {
    // Prefer going back in history, otherwise push to home
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push({ path: '/' })
    }
  }
}

onMounted(() => {
  // basic leaflet map centered on a default location
  map = L.map('map', { zoomControl: true }).setView([14.5995, 120.9842], 12)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)
})

onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.map-container { display: flex; flex-direction: column; height: 100vh; }
.map-header { height: 48px; display:flex; align-items:center; padding:8px; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.05); z-index: 2000 }
.close-btn { background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer }
#map { flex:1; height: calc(100vh - 48px); width:100% }
</style>
