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

// Mount app first
let appMounted = false

// Wait until Firebase resolves auth state before mounting
onAuthStateChanged(auth, (user) => {
  console.log('🔐 Auth state changed:', user ? user.email : 'No user');
  
  if (!appMounted) {
    console.log('📱 Mounting app...');
    app.use(router).mount('#app')
    appMounted = true
    
    // Handle redirect result after app is mounted
    console.log('🔄 Checking for redirect result...');
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          console.log('✅ User signed in via redirect:', result.user.email)
          // Navigate to home after successful login
          setTimeout(() => {
            console.log('🏠 Navigating to home...');
            router.push('/').catch(err => console.log('Navigation error:', err))
          }, 100)
        } else {
          console.log('ℹ️ No redirect result (normal page load)');
        }
      })
      .catch((error) => {
        console.error('❌ Redirect sign-in error:', error)
        alert('Sign-in failed: ' + error.message)
      })
  } else if (user) {
    // User is already signed in, redirect to home if on login page
    console.log('👤 User already signed in, checking route...');
    if (router.currentRoute.value.path === '/login') {
      console.log('↪️ Redirecting from login to home...');
      router.push('/')
    }
  }
})
