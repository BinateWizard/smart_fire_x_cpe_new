import { createApp } from 'vue'
import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import { Home, User } from 'lucide-vue-next'
import "leaflet/dist/leaflet.css";

// Firebase imports
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

// Create app instance once
const app = createApp(App)

// Register Lucide icons globally
app.component('LucideHome', Home)
app.component('LucideUser', User)

// Wait until Firebase resolves auth state before mounting
let appMounted = false
onAuthStateChanged(auth, () => {
  if (!appMounted) {
    app.use(router).mount('#app')
    appMounted = true
  }
})
