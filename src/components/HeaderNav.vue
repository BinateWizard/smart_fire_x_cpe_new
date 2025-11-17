<template>
  <header class="header-nav" role="banner">
    <div class="container">
      <div class="brand">FireTap</div>
      <nav class="nav-links" role="navigation" aria-label="Desktop navigation">
        <router-link to="/" class="link" :class="{ active: route.name === 'home' }">Home</router-link>
        <router-link to="/map" class="link" :class="{ active: route.name === 'map' }">Location</router-link>
        <router-link to="/notifications" class="link" :class="{ active: route.name === 'notifications' }">Notifications</router-link>
        <router-link to="/settings" class="link" :class="{ active: route.name === 'settings' }">Settings</router-link>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<style scoped>
.header-nav {
  display: none; /* hidden by default (mobile-first) */
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 8px rgba(0,0,0,0.04);
  position: sticky;
  top: 0;
  z-index: 60;
}
.header-nav .container {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
}
.brand { font-weight: 700; color: #dc2626; }
.nav-links { display:flex; gap: 18px; }
.link { color:#6b7280; text-decoration:none; font-weight:600 }
.link.active { color:#111827 }

/* Show header nav on desktop widths */
@media (min-width: 768px) {
  .header-nav { display: block }
}
</style>
