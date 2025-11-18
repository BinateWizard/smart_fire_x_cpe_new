<template>
  <div id="app">
    <router-view />
    <InstallPrompt />
  </div>
</template>

<script setup>
import InstallPrompt from '@/components/InstallPrompt.vue'
</script>

