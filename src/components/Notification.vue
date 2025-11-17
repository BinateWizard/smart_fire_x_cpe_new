<template>
  <div class="app-container">
    <!-- Header -->
    <div class="header">
      <div class="header-content">
        <ChevronLeft class="back-icon" /> //when pressed, it should navigate back to the previous page
        <h1 class="header-title">Event History</h1>
      </div>
    </div>

    <!-- Event List -->
    <div class="event-list">
      <!-- Safe Event 1 -->
      <div class="event-card">
        <div class="event-content">
          <div class="event-left">
            <div class="status-icon safe">
              <Check class="icon" />
            </div>
            <div class="event-info">
              <div class="event-date">2025-04-14</div>
              <div class="event-status">Safe</div>
            </div>
          </div>
          <div class="event-right">
            <div class="event-time">10:04 AM</div>
            <div class="temperature">20°C</div>
          </div>
        </div>
      </div>

      <!-- Safe Event 2 -->
      <div class="event-card">
        <div class="event-content">
          <div class="event-left">
            <div class="status-icon safe">
              <Check class="icon" />
            </div>
            <div class="event-info">
              <div class="event-date">2025-04-13</div>
              <div class="event-status">Safe</div>
            </div>
          </div>
          <div class="event-right">
            <div class="event-time">7:22 PM</div>
            <div class="temperature">25°C</div>
          </div>
        </div>
      </div>

      <!-- Alert Event -->
      <div class="event-card">
        <div class="event-content">
          <div class="event-left">
            <div class="status-icon alert">
              <AlertTriangle class="icon" />
            </div>
            <div class="event-info">
              <div class="event-date">2025-04-13</div>
              <div class="event-status">Alert</div>
            </div>
          </div>
          <div class="event-right">
            <div class="event-time">7:22 PM</div>
            <div class="temperature">70°C</div>
          </div>
        </div>
      </div>

      <!-- Alarm Triggered Event -->
      <div class="event-card detailed">
        <div class="event-content">
          <div class="event-left">
            <div class="status-icon alarm">
              <Bell class="icon" />
            </div>
            <div class="event-info">
              <div class="event-date">2025-04-14</div>
              <div class="event-status">[ALARM TRIGGERED]</div>
            </div>
          </div>
          <div class="event-right">
            <div class="event-time">08:23 AM</div>
          </div>
        </div>
        <div class="event-details">
          <div class="detail-item">
            <span class="detail-label">Location:</span> Store 102, Bansud Public Market
          </div>
          <div class="detail-item">
            <span class="detail-label">Initiated by:</span> Fire Alarm Button
          </div>
          <div class="detail-item">
            <span class="detail-label">Status:</span> Fire alarm activated
          </div>
        </div>
      </div>

      <!-- Reset Initiated Event 1 -->
      <div class="event-card detailed">
        <div class="event-content">
          <div class="event-left">
            <div class="status-icon safe">
              <Check class="icon" />
            </div>
            <div class="event-info">
              <div class="event-date">2025-03-21</div>
              <div class="event-status">[RESET INITIATED]</div>
            </div>
          </div>
          <div class="event-right">
            <div class="event-time">07:16 PM</div>
          </div>
        </div>
        <div class="event-details">
          <div class="detail-item">
            <span class="detail-label">Reset performed by:</span> Admin (ID: 10234)
          </div>
          <div class="detail-item">
            <span class="detail-label">Remarks:</span> False alarm - accidentally pressed
          </div>
        </div>
      </div>

      <!-- Reset Initiated Event 2 -->
      <div class="event-card detailed">
        <div class="event-content">
          <div class="event-left">
            <div class="status-icon alert">
              <AlertTriangle class="icon" />
            </div>
            <div class="event-info">
              <div class="event-date">2025-03-02</div>
              <div class="event-status">[RESET INITIATED]</div>
            </div>
          </div>
          <div class="event-right">
            <div class="event-time">07:16 PM</div>
          </div>
        </div>
        <div class="event-details">
          <div class="detail-item">
            <span class="detail-label">Reset performed by:</span> Admin (ID: 10234)
          </div>
          <div class="detail-item">
            <span class="detail-label">Remarks:</span> False alarm - accidentally pressed
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation -->
    <div class="bottom-nav">
      <button class="nav-item active">
        <Home class="nav-icon" />
        <span class="nav-label">home</span>
      </button>
      <button class="nav-item">
        <MapPin class="nav-icon" />
        <span class="nav-label">location</span>
      </button>
      <button class="nav-item">
        <Bell class="nav-icon" />
        <span class="nav-label">notification</span>
      </button>
      <button class="nav-item">
        <Settings class="nav-icon" />
        <span class="nav-label">settings</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { 
  ChevronLeft, 
  Check, 
  AlertTriangle, 
  Bell, 
  Home, 
  MapPin, 
  Settings 
} from 'lucide-vue-next'
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

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 400px;
  background: white;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-item.active .nav-icon {
  color: #dc2626;
}

.nav-item.active .nav-label {
  color: #dc2626;
}

.nav-icon {
  width: 24px;
  height: 24px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.nav-label {
  font-size: 12px;
  color: #9ca3af;
}

.nav-item:hover .nav-icon,
.nav-item:hover .nav-label {
  color: #6b7280;
}
</style>