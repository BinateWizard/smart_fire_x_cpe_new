<template>
  <div class="settings-container">
    <h1 class="settings-title">Settings</h1>

    <button @click="logout" class="logout-btn">
      Logout
    </button>
  </div>
</template>

<script setup>
import { signOut } from "firebase/auth"
import { auth } from "@/firebase"
import { useRouter } from "vue-router"

const router = useRouter()

async function logout() {
  try {
    await signOut(auth)
    router.push("/login") // redirect to login page
  } catch (err) {
    console.error("Logout failed:", err.message)
  }
}
</script>

<style scoped>
.settings-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 24px;
  font-family: system-ui, sans-serif;
}

.settings-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 20px;
}

.logout-btn {
  background-color: #dc2626;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  width: 100%;
}

.logout-btn:hover {
  background-color: #b91c1c;
}
</style>
