import { createRouter, createWebHistory } from "vue-router";
import Home from "@/views/HomeView.vue";
import Login from "@/views/Login.vue";
import Settings from "@/views/Settings.vue"
import showMap  from "@/components/showMap.vue";  
import Notification from "@/views/Notifications.vue";

import { auth } from "@/firebase";

const routes = [
  { path: "/", name: "home", component: Home, meta: { requiresAuth: true } },
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
