<template>
  <div v-if="showInstallPrompt" class="install-prompt">
    <div class="install-content">
      <div class="install-icon">📱</div>
      <div class="install-text">
        <div class="install-title">Install FireTap</div>
        <div class="install-description">Add to your home screen for quick access</div>
      </div>
      <div class="install-actions">
        <button @click="install" class="install-btn">Install</button>
        <button @click="dismiss" class="dismiss-btn">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showInstallPrompt = ref(false)
let deferredPrompt = null

onMounted(() => {
  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault()
    // Stash the event so it can be triggered later
    deferredPrompt = e
    // Show install prompt
    showInstallPrompt.value = true
  })

  // Hide prompt if already installed
  window.addEventListener('appinstalled', () => {
    showInstallPrompt.value = false
    console.log('✅ PWA was installed')
  })
})

async function install() {
  if (!deferredPrompt) {
    return
  }

  // Show the install prompt
  deferredPrompt.prompt()

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice
  
  if (outcome === 'accepted') {
    console.log('✅ User accepted the install prompt')
  } else {
    console.log('❌ User dismissed the install prompt')
  }

  // Clear the deferredPrompt
  deferredPrompt = null
  showInstallPrompt.value = false
}

function dismiss() {
  showInstallPrompt.value = false
  // Remember user dismissed (optional - you can save to localStorage)
  localStorage.setItem('installPromptDismissed', Date.now())
}
</script>

<style scoped>
.install-prompt {
  position: fixed;
  bottom: 80px;
  left: 16px;
  right: 16px;
  z-index: 1000;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.install-content {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
}

.install-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.install-text {
  flex: 1;
  color: white;
}

.install-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 2px;
}

.install-description {
  font-size: 13px;
  opacity: 0.9;
}

.install-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.install-btn {
  background-color: white;
  color: #dc2626;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.2s;
}

.install-btn:active {
  transform: scale(0.95);
}

.dismiss-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
