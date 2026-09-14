<template>
  <section class="ioc-panel strategy-panel" :style="themeVars">
    <div class="panel-heading"><Icon name="layers"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small></div>
    <div class="panel-body">
      <div v-for="(block, index) in blocks" :key="index" class="map-block" :class="'map-' + block.kind">
        <div v-if="block.label" class="map-label">{{ block.label }}<small v-if="block.sub">{{ block.sub }}</small></div>
        <div class="map-body">
          <template v-if="block.kind === 'band'">
            <div class="map-band">{{ block.text }}</div>
            <span v-if="block.meta" class="map-meta">{{ block.meta }}</span>
          </template>

          <template v-else-if="block.kind === 'chips'">
            <span v-for="item in block.items || []" :key="item" class="map-chip">{{ item }}</span>
          </template>

          <template v-else-if="block.kind === 'columns'">
            <div v-for="column in block.items || []" :key="column.title" class="map-column">
              <b>{{ column.title }}</b>
              <span v-for="item in column.items || []" :key="item"><i></i>{{ item }}</span>
            </div>
          </template>

          <template v-else-if="block.kind === 'grid'">
            <div
              v-for="item in block.items || []"
              :key="item.title"
              class="map-cell"
              :style="{ '--cells': block.columns || 2 }">
              <b>{{ item.title }}</b>
              <small v-if="item.desc">{{ item.desc }}</small>
            </div>
          </template>

          <template v-else>
            <div v-for="item in block.items || []" :key="item" class="map-row">{{ item }}</div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '../../widgets/Icon.vue';

const props = defineProps({
  theme: { type: String, default: 'orange' },
  title: { type: String, default: '战略地图' },
  eyebrow: { type: String, default: 'STRATEGY' },
  blocks: { type: Array, default: () => [] },
});

// 和参考布局里那四个色一样
const THEMES = {
  // primary 是强调色（细线、圆点、边框），secondary 是卡片的浅底，不填实心
  green: { primary: '#28a745', secondary: '#f1f9f3', border: 'rgba(40,167,69,.22)' },
  blue: { primary: '#0d6efd', secondary: '#f0f6ff', border: 'rgba(13,110,253,.22)' },
  orange: { primary: '#ff6b00', secondary: '#f7f9fb', border: 'none' },
  purple: { primary: '#6f42c1', secondary: '#f7f2fd', border: 'rgba(111,66,193,.22)' },
};
const themeVars = computed(() => {
  const picked = THEMES[props.theme] || THEMES.orange;
  return {
    '--map-primary': picked.primary,
    '--map-secondary': picked.secondary,
    '--map-line': picked.border,
  };
});
</script>
