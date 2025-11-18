import { createApp } from 'vue'
import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import { Home, User } from 'lucide-vue-next'
import "leaflet/dist/leaflet.css";

// Firebase imports
import { auth } from './firebase'
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth'

// Create app instance once
const app = createApp(App)

// Register Lucide icons globally
app.component('LucideHome', Home)
app.component('LucideUser', User)

// Handle redirect result from Google Sign-In
getRedirectResult(auth)
  .then((result) => {
    if (result) {
      console.log('✅ User signed in:', result.user.email)
      // Redirect to home after successful login
      router.push('/')
    }
  })
  .catch((error) => {
    console.error('❌ Redirect sign-in error:', error)
  })

// Wait until Firebase resolves auth state before mounting
let appMounted = false
onAuthStateChanged(auth, () => {
  if (!appMounted) {
    app.use(router).mount('#app')
    appMounted = true
  }
})
