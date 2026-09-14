<template>
  <div class="cover-page">
    <i class="cover-sweep" aria-hidden="true"></i>

    <div class="cover-brand"><img :src="logo" alt="吉利控股集团"/></div>

    <h1 class="cover-title">{{ title }}</h1>

    <ul class="cover-meta">
      <li v-for="line in bullets" :key="line">{{ line }}</li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  bullets: { type: Array, default: () => [] },
});

// 封页和封底共用的集团 logo
const logo = '/brand/geely-logo.png';
</script>