<template>
  <button @click="logout" class="text-red-500">Logout</button>
</template>

<script setup>
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";
import { useRouter } from "vue-router";

const router = useRouter();

async function logout() {
  await signOut(auth);
  router.push("/login");
}
</script>
