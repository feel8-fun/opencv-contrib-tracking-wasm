<script setup>
import { onMounted, ref } from 'vue';
</script>

<template>
  <nav>
    <RouterLink to="/">BuildInfo</RouterLink>
    <!-- <RouterLink to="/buildinfo">BuildInfo</RouterLink> -->
  </nav>
  <main>
    <RouterView />
  </main>
</template>

<style scoped></style>
