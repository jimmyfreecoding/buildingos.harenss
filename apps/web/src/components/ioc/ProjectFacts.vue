<template>
  <div class="facts">
    <!-- 底部一条数据带：每个数字一张小白卡 -->
    <div class="facts-strip">
      <div v-for="item in stats" :key="item.label" class="facts-card">
        <span class="facts-label">{{ item.label }}</span>
        <div class="facts-value"><b>{{ item.value }}</b><small v-if="item.unit">{{ item.unit }}</small></div>
        <span v-if="item.note" class="facts-note">{{ item.note }}</span>
      </div>
    </div>
    <p v-if="source" class="facts-source">{{ source }}</p>
  </div>
</template>

<script setup>
defineProps({
  stats: { type: Array, default: () => [] },
  source: { type: String, default: '' },
});
</script>
