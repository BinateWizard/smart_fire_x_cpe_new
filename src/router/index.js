import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/HomeView.vue";
import DeviceDetail from "@/views/DeviceDetail.vue";
import AddDevice from "@/views/AddDevice.vue";
import DeviceDebug from "@/views/DeviceDebug.vue";
import Login from "@/views/Login.vue";
import Settings from "@/views/Settings.vue"
import showMap  from "@/components/showMap.vue";  
import Notification from "@/views/Notifications.vue";

import { auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";

const routes = [
  { path: "/", name: "home", component: Home, meta: { requiresAuth: true } },
  { path: "/device/:deviceId", name: "device-detail", component: DeviceDetail, meta: { requiresAuth: true } },
  { path: "/add-device", name: "add-device", component: AddDevice, meta: { requiresAuth: true } },
  { path: "/debug", name: "device-debug", component: DeviceDebug, meta: { requiresAuth: true } },
  { path: "/login", name: "login", component: Login },
  { path: "/map", name: "map", component: showMap, meta: { requiresAuth: true } },
  { path: "/settings", name: "settings", component: Settings, meta: { requiresAuth: true } },
  { path: "/notifications", name: "notifications", component: Notification, meta: { requiresAuth: true } }, 

];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Helper to get current auth user
function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  
  if (requiresAuth) {
    try {
      const user = await getCurrentUser();
      if (user) {
        next();
      } else {
        next("/login");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      next("/login");
    }
  } else {
    // If going to login but already authenticated, redirect to home
    if (to.path === '/login') {
      const user = auth.currentUser;
      if (user) {
        next('/');
        return;
      }
    }
    next();
  }
});

export default router;
