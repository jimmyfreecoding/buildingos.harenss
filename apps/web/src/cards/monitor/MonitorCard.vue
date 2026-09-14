<template>
  <section class="ioc-panel monitor-panel">
    <div class="panel-heading"><Icon name="camera"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small><span class="tiny-online">{{ points.online }} / {{ points.total }}</span></div>
    <div class="panel-body monitor-grid"><button v-for="(point,i) in points.points" :key="point.id" @click="emit('open-monitor',i,point.title)"><img v-if="snapshots[i]" :src="snapshots[i]" :alt="point.name+'三维预览'"/><div v-else class="camera-placeholder"><Icon name="camera"/></div><span class="camera-id">CAM 0{{ i+1 }} <i></i></span><span class="camera-caption">{{ point.name }}<Icon name="expand"/></span><span class="monitor-play"><Icon name="play"/></span></button></div>
  </section>
</template>

<script setup>
import Icon from '../../widgets/Icon.vue';
import { useDataSlot } from '../../data/dataContext.js';

defineProps({
  title: { type: String, default: '重点监控区域' },
  eyebrow: { type: String, default: 'MONITORING' },
  snapshots: { type: Array, default: () => [] },
});
const emit = defineEmits(['open-monitor']);

const points = useDataSlot('monitor.points', null, { online: 0, total: 0, points: [] });
</script>
