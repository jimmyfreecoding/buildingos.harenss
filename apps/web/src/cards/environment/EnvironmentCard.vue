<template>
  <section class="ioc-panel environment-panel">
    <div class="panel-heading"><Icon name="tree"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small><span class="quality-tag">{{ env.grade }}</span></div>
    <div class="panel-body environment-metrics">
      <div><Icon name="temp"/><span>温度 <small>{{ env.temperature.unit }}</small></span><strong>{{ env.temperature.value }}<em>{{ env.temperature.decimal }}</em></strong></div>
      <div><Icon name="drop"/><span>湿度 <small>{{ env.humidity.unit }}</small></span><strong>{{ humidity }}<em>{{ env.humidity.decimal }}</em></strong></div>
      <div><Icon name="wind"/><span>CO₂ <small>{{ env.co2.unit }}</small></span><strong>{{ env.co2.value }}<em>{{ env.co2.decimal }}</em></strong></div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '../../widgets/Icon.vue';
import { useDataSlot } from '../../data/dataContext.js';

const props = defineProps({
  title: { type: String, default: '办公环境质量' },
  eyebrow: { type: String, default: 'ENVIRONMENT' },
  weather: { type: String, default: 'sunny' },
});

const env = useDataSlot('env.quality', null, { grade: '', temperature: {}, humidity: { byWeather: {} }, co2: {} });
// 湿度按当前天气取，这是展示规则，所以留在卡片里算
const humidity = computed(() => {
  const map = env.value.humidity.byWeather || {};
  return map[props.weather] || map.default || '';
});
</script>
