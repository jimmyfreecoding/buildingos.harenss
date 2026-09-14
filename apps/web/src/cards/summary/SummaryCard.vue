<template>
  <section class="ioc-panel summary-panel">
    <div class="panel-heading"><Icon name="layers"/><h2>{{ meta.title || '专题视图' }}</h2><small>{{ eyebrow }}</small></div>
    <div class="panel-body">
      <p class="summary-desc">{{ meta.description }}</p>
      <div class="summary-metrics">
        <div v-for="metric in metrics" :key="metric.label">
          <strong>{{ metric.value }}</strong>
          <span>{{ metric.label }}</span>
        </div>
      </div>
      <button v-if="viewId" class="summary-link" @click="emit('detail', viewId)">
        {{ detailLabel }} <Icon name="arrow"/>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '../../widgets/Icon.vue';
import { useIocContext } from '../../core/context.js';

defineProps({
  eyebrow: { type: String, default: '专题视图' },
  detailLabel: { type: String, default: '查看专题详情' },
});
const emit = defineEmits(['detail']);

const { spec } = useIocContext();

// 当前态势。卡片本来就是「这一页现在在看哪个态势」的表达，所以直接从配置里取。
const currentView = computed(() => {
  const value = spec.value || {};
  const views = value.views || [];
  const active = value.navigation && value.navigation.active;
  return views.find(view => view.id === active) || views[0] || {};
});
const viewId = computed(() => currentView.value.id || '');
const meta = computed(() => ({
  title: currentView.value.title || '',
  description: currentView.value.description || '',
}));
const metrics = computed(() => (currentView.value.metrics || []).slice(0, 3));
</script>
