<template>
  <div class="container">
    <!-- Header -->
    <div class="header">
      
      <h1 class="text-3xl font-bold text-gray-800">Welcome to <br>FireTap🔥</h1>
    </div>

    <!-- Login Button -->
    <button @click="loginWithGoogle" class="google-btn">
      <img
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        alt="Google logo"
      />
      <span>Sign in with Google</span>
    </button>
  </div>
</template>

<script setup>
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/firebase";
import { useRouter } from "vue-router";

const router = useRouter();

async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("User:", user.email, user.displayName);

    // Redirect to home page
    router.push("/");
  } catch (error) {
    console.error("Login failed:", error.message);
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column; /* Stack header & button */
  align-items: center;
  justify-content: center;
  gap: 2rem; /* space between header and button */
  text-align: center;
  padding-top: 80px; /* push content down from very top */
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.google-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #ddd;
  padding: 12px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  font-weight: 500;
  color: #444;
  transition: background 0.2s;
}

.google-btn:hover {
  background: #f5f5f5;
}

.google-btn img {
  width: 20px;
  height: 20px;
}
</style>
