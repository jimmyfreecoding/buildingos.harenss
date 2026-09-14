<template>
  <section :class="floating ? 'floor-plan-card' : 'ioc-panel plan-panel'">
    <button v-if="floating" class="card-close icon-button" aria-label="关闭平面图" @click="emit('close')"><Icon name="close"/></button>
    <div v-else class="panel-heading"><Icon name="floors"/><h2>楼层平面图</h2><small>{{ eyebrow }}</small></div>

    <div :class="floating ? null : 'panel-body'">
      <template v-if="floor">
        <span class="eyebrow">FLOOR PLAN · {{ floor.id }}座 · {{ floor.floor }}F</span>
        <h2>{{ floor.id }}座 {{ floor.floor }}F 楼层平面图</h2>
        <span class="building-status"><i class="live-dot"></i> 设备运行正常</span>
        <div class="plan-stage">
          <svg class="plan-svg" viewBox="0 0 300 220" role="img" :aria-label="`${floor.id}座${floor.floor}F楼层平面图`">
            <rect class="plan-wall" x="6" y="6" width="288" height="208"/>
            <rect class="plan-core" x="126" y="86" width="48" height="48"/>
            <g class="plan-rooms">
              <rect x="16" y="16" width="100" height="60"/><rect x="16" y="86" width="100" height="54"/><rect x="16" y="150" width="100" height="54"/>
              <rect x="184" y="16" width="100" height="60"/><rect x="184" y="86" width="100" height="54"/><rect x="184" y="150" width="100" height="54"/>
            </g>
            <g class="plan-corridors"><path d="M116 10 h10 v200 h-10z"/><path d="M174 10 h10 v200 h-10z"/><path d="M10 76 h280"/><path d="M10 140 h280"/></g>
            <text class="plan-label" x="150" y="80">电梯核心筒</text>
            <text class="plan-label" x="66" y="46">办公区 A</text>
            <text class="plan-label" x="66" y="113">会议室</text>
            <text class="plan-label" x="66" y="177">开放办公区</text>
            <text class="plan-label" x="234" y="46">办公区 B</text>
            <text class="plan-label" x="234" y="113">研发区</text>
            <text class="plan-label" x="234" y="177">休闲区</text>
          </svg>
          <button v-for="m in markers" :key="m.id" class="plan-marker" :class="[m.icon,{offline:m.status==='离线'}]" :style="{left:m.x+'%',top:m.y+'%'}" @mouseenter="hover=m" @mouseleave="hover=null" @focus="hover=m" @blur="hover=null">
            <Icon :name="m.icon"/>
            <span v-if="hover===m" class="plan-tooltip"><b>{{ m.name }}</b><small>{{ m.zone }}</small><i :class="{off:m.status==='离线'}">{{ m.status }}</i></span>
          </button>
        </div>
        <div class="plan-legend">
          <span><i class="plan-dot cam"></i>摄像头</span><span><i class="plan-dot door"></i>门禁</span><span><i class="plan-dot smoke"></i>烟感</span><span><i class="plan-dot hydrant"></i>消防栓</span><span><i class="plan-dot lift"></i>电梯</span>
        </div>
      </template>
      <p v-else class="card-hint">{{ empty }}</p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import Icon from '../../widgets/Icon.vue';

// 炸开哪一层也是运行时状态（点了楼层炸开面板才会变），同样从 runtimeProps 进来。
const props = defineProps({
  floating: { type: Boolean, default: false },
  floor: { type: Object, default: null },
  eyebrow: { type: String, default: 'PLAN' },
  empty: { type: String, default: '在楼层面板里选一层，这里显示它的平面图和点位。' },
});
const emit = defineEmits(['close']);
const hover = ref(null);

// 点位的坐标是编出来的，但只要楼层和楼栋一样，每次算出来就一样
function planSeed(id, floorNumber) {
  let h = ((id.charCodeAt(0) * 2654435761) ^ (floorNumber * 40503)) >>> 0;
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
}
function planZone(x, y) {
  const side = x < 42 ? '西侧' : x > 58 ? '东侧' : '中部';
  const row = y < 45 ? '办公区' : y < 65 ? '走廊' : y < 80 ? '会议室' : '开放区';
  return side + ' ' + row;
}
function buildFloorPlan(id, floorNumber) {
  const rnd = planSeed(id, floorNumber);
  const pad = value => String(value).padStart(2, '0');
  const markers = [];
  // 摄像头 6 个、门禁 4 个、烟感 4 个、消防栓 2 个、电梯 2 个 —— 和改造前一致
  for (let i = 0; i < 6; i++) { const x = 10 + rnd() * 80, y = 10 + rnd() * 80; markers.push({ id: 'cam-' + i, icon: 'camera', x, y, name: 'CAM-' + id + pad(floorNumber) + '-0' + (i + 1), zone: planZone(x, y), status: rnd() < .9 ? '在线' : '离线' }); }
  for (let i = 0; i < 4; i++) { const x = 10 + rnd() * 80, y = 10 + rnd() * 80; markers.push({ id: 'door-' + i, icon: 'door', x, y, name: 'AC-' + id + pad(floorNumber) + '-0' + (i + 1), zone: planZone(x, y) + ' 入口', status: rnd() < .95 ? '在线' : '离线' }); }
  for (let i = 0; i < 4; i++) { const x = 10 + rnd() * 80, y = 10 + rnd() * 80; markers.push({ id: 'smoke-' + i, icon: 'smoke', x, y, name: 'SMK-' + id + pad(floorNumber) + '-0' + (i + 1), zone: planZone(x, y) + ' 吊顶', status: '在线' }); }
  for (let i = 0; i < 2; i++) { const x = 15 + rnd() * 70, y = 15 + rnd() * 70; markers.push({ id: 'hyd-' + i, icon: 'hydrant', x, y, name: 'HYD-' + id + pad(floorNumber) + '-0' + (i + 1), zone: planZone(x, y) + ' 墙侧', status: '在线' }); }
  markers.push({ id: 'elv-1', icon: 'elevator', x: 39, y: 50, name: '电梯 1 号', zone: '电梯厅', status: '在线' });
  markers.push({ id: 'elv-2', icon: 'elevator', x: 61, y: 50, name: '电梯 2 号', zone: '电梯厅', status: '在线' });
  return markers;
}
const markers = computed(() => (props.floor ? buildFloorPlan(props.floor.id, props.floor.floor) : []));
</script>
