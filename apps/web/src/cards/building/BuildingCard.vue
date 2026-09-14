<template>
  <section :class="floating ? 'building-card' : 'ioc-panel building-panel'">
    <button v-if="floating" class="card-close icon-button" aria-label="关闭楼栋详情" @click="emit('close')"><Icon name="close"/></button>
    <div v-else class="panel-heading"><Icon name="building"/><h2>楼栋档案</h2><small>{{ eyebrow }}</small></div>

    <div :class="floating ? null : 'panel-body'">
      <template v-if="building">
        <span class="eyebrow">BUILDING {{ building.id }} · 建筑档案</span>
        <h2>{{ building.name }}</h2>
        <span class="building-status"><i class="live-dot"></i> 正常运行</span>
        <div class="building-stats">
          <div><b>{{ building.floors }}</b><span>建筑层数</span></div>
          <div><b>{{ building.people }}</b><span>当前在园</span></div>
          <div><b>{{ building.equipment }}</b><span>接入设备</span></div>
        </div>
        <p>建筑面积 <strong>{{ building.area }} m²</strong></p>
        <button class="detail-link" @click="emit('detail', 'building')">查看楼栋运行信息 <Icon name="arrow"/></button>
      </template>
      <p v-else class="card-hint">{{ empty }}</p>
    </div>
  </section>
</template>

<script setup>
import Icon from '../../widgets/Icon.vue';

// 楼栋是运行时状态（点了三维里的哪栋楼），所以从 runtimeProps 传进来，
// 不写进配置 —— 配置说的是「这一页有没有这块档案」，不是「现在选的是哪栋」。
defineProps({
  floating: { type: Boolean, default: false },
  building: { type: Object, default: null },
  eyebrow: { type: String, default: 'ARCHIVE' },
  empty: { type: String, default: '点三维场景里的楼栋，这里显示它的建筑档案。' },
});
const emit = defineEmits(['close', 'detail']);
</script>
