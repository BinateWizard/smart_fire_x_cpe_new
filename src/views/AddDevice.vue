<template>
  <div class="app-container">
    <!-- Header -->
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <ChevronLeft class="back-icon" />
      </button>
      <h1 class="header-title">Add New Device</h1>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="form-card">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="deviceId">Device ID *</label>
            <input 
              type="text" 
              id="deviceId" 
              v-model="formData.deviceId" 
              placeholder="e.g., dev-abc123"
              required
            />
            <small>Enter the unique device identifier</small>
          </div>

          <div class="form-group">
            <label for="deviceName">Device Name *</label>
            <input 
              type="text" 
              id="deviceName" 
              v-model="formData.name" 
              placeholder="e.g., Public Market Device"
              required
            />
          </div>

          <div class="form-group">
            <label for="location">Location</label>
            <input 
              type="text" 
              id="location" 
              v-model="formData.location" 
              placeholder="e.g., Store 102, Bansud Market"
            />
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea 
              id="description" 
              v-model="formData.description" 
              placeholder="Optional notes about this device"
              rows="3"
            ></textarea>
          </div>

          <div class="form-actions">
            <button type="button" @click="$router.back()" class="btn-secondary">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? 'Adding...' : 'Add Device' }}
            </button>
          </div>
        </form>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          Device added successfully!
        </div>
      </div>

      <div class="info-card">
        <h3>How to get Device ID?</h3>
        <p>Each fire alarm device has a unique identifier. You can find it:</p>
        <ul>
          <li>On the device label or QR code</li>
          <li>In the device setup documentation</li>
          <li>From your system administrator</li>
        </ul>
      </div>
    </div>

    <!-- Error Modal -->
    <div v-if="showErrorModal" class="modal-overlay" @click="showErrorModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-icon">⚠️</div>
        <h3 class="modal-title">Device Not Found</h3>
        <p class="modal-message">{{ errorModalMessage }}</p>
        <button @click="showErrorModal = false" class="modal-btn">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref as dbRef, get } from 'firebase/database';
import { db, rtdb, auth } from '@/firebase';
import { ChevronLeft } from 'lucide-vue-next';

const router = useRouter();

const formData = ref({
  deviceId: '',
  name: '',
  location: '',
  description: ''
});

const isSubmitting = ref(false);
const error = ref('');
const success = ref(false);
const showErrorModal = ref(false);
const errorModalMessage = ref('');

async function handleSubmit() {
  error.value = '';
  success.value = false;
  isSubmitting.value = true;

  try {
    const deviceId = formData.value.deviceId.trim();
    
    if (!deviceId) {
      error.value = 'Device ID is required';
      isSubmitting.value = false;
      return;
    }

    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      error.value = 'You must be logged in to add devices';
      isSubmitting.value = false;
      return;
    }

    // Check if THIS USER already added this device
    const userDeviceRef = doc(db, 'devices', `${currentUser.uid}_${deviceId}`);
    const docSnap = await getDoc(userDeviceRef);

    console.log('📝 Checking document ID:', `${currentUser.uid}_${deviceId}`);

    if (docSnap.exists()) {
      error.value = 'You have already registered this device';
      isSubmitting.value = false;
      return;
    }

    // Verify device exists in Realtime Database (ESP32 is sending data)
    const rtdbDeviceRef = dbRef(rtdb, `devices/${deviceId}`);
    const rtdbSnapshot = await get(rtdbDeviceRef);
    
    if (!rtdbSnapshot.exists()) {
      errorModalMessage.value = `Device "${deviceId}" doesn't exist in active devices. If this is a mistake, please contact the administrator.`;
      showErrorModal.value = true;
      isSubmitting.value = false;
      return;
    }

    console.log('✅ Device found in RTDB:', rtdbSnapshot.val());

    // Add device to Firestore with user-specific document ID
    console.log('💾 Saving to Firestore with composite ID:', `${currentUser.uid}_${deviceId}`);
    
    await setDoc(userDeviceRef, {
      deviceId: deviceId,
      name: formData.value.name.trim() || deviceId,
      location: formData.value.location.trim() || '',
      description: formData.value.description.trim() || '',
      status: 'Safe',
      addedBy: currentUser.uid,
      addedByEmail: currentUser.email || 'unknown',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Device added successfully to Firestore!');
    success.value = true;

    // Redirect to home after 1.5 seconds
    setTimeout(() => {
      router.push('/');
    }, 1500);

  } catch (err) {
    console.error('❌ Error adding device:', err);
    error.value = 'Failed to add device. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}
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

* {
  box-sizing: border-box;
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
  padding: 20px 16px;
  padding-bottom: 40px;
  flex: 1;
}

.form-card {
  background: white;
  border-radius: 12px;
  padding: 20px 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  font-family: inherit;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #dc2626;
}

.form-group small {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.form-group textarea {
  resize: vertical;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background-color: #dc2626;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #b91c1c;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background-color: #e5e7eb;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background-color: #fee2e2;
  color: #991b1b;
  border-radius: 8px;
  font-size: 14px;
}

.success-message {
  margin-top: 16px;
  padding: 12px;
  background-color: #d1fae5;
  color: #065f46;
  border-radius: 8px;
  font-size: 14px;
}

.info-card {
  background: #f0f9ff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #bae6fd;
}

.info-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: #0c4a6e;
  margin: 0 0 12px 0;
}

.info-card p {
  font-size: 14px;
  color: #0369a1;
  margin: 0 0 8px 0;
}

.info-card ul {
  margin: 0;
  padding-left: 20px;
}

.info-card li {
  font-size: 14px;
  color: #0369a1;
  margin-bottom: 4px;
}

/* Error Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 32px 24px;
  max-width: 320px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 12px 0;
}

.modal-message {
  font-size: 15px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0 0 24px 0;
}

.modal-btn {
  width: 100%;
  padding: 12px;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.modal-btn:hover {
  background-color: #b91c1c;
}
</style>
