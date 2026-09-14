<template>
  <div class="steps">
    <header class="steps-head">
      <b>{{ title }}</b>
      <span v-if="subtitle">{{ subtitle }}</span>
    </header>

    <ol class="steps-list">
      <li v-for="(s, i) in steps" :key="s">
        <em>{{ String(i + 1).padStart(2, '0') }}</em>
        <p>{{ s }}</p>
      </li>
    </ol>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  steps: { type: Array, default: () => [] },
});
</script>
