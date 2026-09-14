<template>
  <section class="ioc-panel topology-panel">
    <div class="panel-heading"><Icon name="grid"/><h2>{{ root }}</h2><small>{{ eyebrow }}</small></div>
    <div class="panel-body">
      <div class="topo">
        <div class="topo-root">{{ root }}</div>
        <i class="topo-stem"></i>
        <div class="topo-hub">{{ hub }}</div>
        <i class="topo-stem"></i>
        <i class="topo-bus"></i>
        <div class="topo-grid" :style="{ '--cols': Math.max(groups.length, 1) }">
          <div v-for="group in groups" :key="group.title" class="topo-column">
            <i class="topo-drop"></i>
            <div class="topo-head">{{ group.title }}</div>
            <div class="topo-items">
              <div v-for="item in group.items || []" :key="item" class="topo-item" :title="item">{{ item }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import Icon from '../../widgets/Icon.vue';

defineProps({
  root: { type: String, default: 'IOC 智慧运营中心' },
  hub: { type: String, default: '数字孪生' },
  eyebrow: { type: String, default: 'ARCHITECTURE' },
  // [{ title, items: [名称, ...] }]
  groups: { type: Array, default: () => [] },
});
</script>
