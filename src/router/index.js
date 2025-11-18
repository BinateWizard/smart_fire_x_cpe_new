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

router.beforeEach((to, from, next) => {
  const user = auth.currentUser;
  if (to.meta.requiresAuth && !user) {
    next("/login");
  } else {
    next();
  }
});

export default router;
