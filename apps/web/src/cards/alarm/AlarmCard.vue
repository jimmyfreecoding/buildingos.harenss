<template>
  <section class="ioc-panel alarm-panel">
    <div class="panel-heading"><Icon name="bell"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small><span class="alarm-count">{{ pending }} 待处理</span></div>
    <div class="panel-body alert-list"><button v-for="(alarm,i) in alarms" :key="alarm.id" class="alert-row" :class="{resolved:alarm.resolved}" @click="emit('open-alarm',alarm)"><div class="alert-thumb"><img v-if="snapshots[i%2]" :src="snapshots[i%2]" alt="报警点位预览"/><Icon :name="alarm.resolved?'check':'camera'"/></div><div><div class="alert-title"><b>{{ alarm.location }}</b><time>{{ alarm.time }}</time></div><p>{{ alarm.description }}<span :class="alarm.resolved?'resolved-tag':'alert-level'">{{ alarm.resolved?'已处理':alarm.level }}</span></p></div></button></div>
    <button class="all-alerts" @click="emit('detail','alerts')">查看全部事件 <Icon name="arrow"/></button>
  </section>
</template>

<script setup>
import Icon from '../../widgets/Icon.vue';

defineProps({
  title: { type: String, default: '视频报警信息' },
  eyebrow: { type: String, default: 'ALERTS' },
  // 告警的“已处理”状态存在浏览器里，由页面统一管，所以这里用 props 传进来
  alarms: { type: Array, default: () => [] },
  pending: { type: Number, default: 0 },
  snapshots: { type: Array, default: () => [] },
});
const emit = defineEmits(['open-alarm', 'detail']);
</script>
