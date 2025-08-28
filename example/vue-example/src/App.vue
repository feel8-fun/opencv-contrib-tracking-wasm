<script setup>
import { onMounted, ref } from 'vue';
</script>

<template>
  <nav>
    <RouterLink to="/">Home</RouterLink>
    <RouterLink to="/opticalflow">Optical Flow</RouterLink>
    <RouterLink to="/buildinfo">Build Info</RouterLink>
  </nav>
  <main>
    <RouterView />
  </main>
</template>

<style scoped>
nav {
  background-color: #333;
  color: white;
  padding: 12px 16px;
}

nav a {
  color: white;
  text-decoration: none;
  margin: 0 12px;
}

nav a:hover {
  text-decoration: underline;
}

main {
  padding: 16px;
}
</style>
