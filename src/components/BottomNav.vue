<template>
  <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
    <router-link
      to="/"
      class="nav-item"
      :class="{ active: route.name === 'home' }"
      aria-label="Home"
    >
      <Bell class="nav-icon" />
      <span class="nav-label">Home</span>
    </router-link>

    <router-link
      to="/map"
      class="nav-item map-action"
      :class="{ active: route.name === 'map' }"
      aria-label="Map"
    >
      <MapPin class="nav-icon" />
      <span class="nav-label">Location</span>
    </router-link>

    <router-link
      to="/notifications"
      class="nav-item"
      :class="{ active: route.name === 'notifications' }"
      aria-label="Notifications"
    >
      <div class="nav-icon-container">
        <Bell class="nav-icon" />
        <div v-if="unreadCount > 0" class="notification-badge">{{ unreadCount }}</div>
      </div>
      <span class="nav-label">Notifications</span>
    </router-link>

    <router-link
      to="/settings"
      class="nav-item"
      :class="{ active: route.name === 'settings' }"
      aria-label="Settings"
    >
      <Settings class="nav-icon" />
      <span class="nav-label">Settings</span>
    </router-link>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { Bell, MapPin, Settings } from 'lucide-vue-next'
import { ref } from 'vue'

const route = useRoute()

// Placeholder: unread notifications count. In future this can be provided via Vuex/Pinia or props.
const unreadCount = ref(0)
</script>

<style scoped>
/* Mobile-first: show bottom nav on small viewports only */
.bottom-nav {
  /* Fixed to viewport bottom, centered to match app-container width exactly */
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 400px;
  height: 72px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: #f37021; /* nav background: orange */
  border-top: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 -8px 24px rgba(0,0,0,0.12);
  z-index: 999;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ffffff; /* white text/icons on orange */
  text-decoration: none;
  font-size: 12px;
  padding: 6px 8px;
}
.nav-item .nav-icon {
  width: 22px;
  height: 22px;
}
.nav-item.active {
  color: #dc2626;
}
.notification-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #ffffff;
  color: #f37021;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
}
.nav-icon-container { position: relative; }
.map-action { transform: translateY(-6px); }

/* Desktop: keep the same bottom-flush behavior */
@media (min-width: 768px) {
  .bottom-nav {
    /* Keep bottom: 0, same width, just match desktop styling */
    height: 72px;
  }
}

</style>
