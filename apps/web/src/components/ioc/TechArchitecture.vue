<template>
  <div class="tech-arch">
    <header class="ta-head">
      <b class="ta-title">{{ title }}</b>
      <div class="ta-features">
        <button v-for="item in feature" :key="item.name" type="button" @click="open(item)">{{ item.name }}</button>
      </div>
    </header>

    <div class="ta-flow">
      <!-- 云端和边缘之间的连接线：从云的右下出发，往右再往下，插进边缘框的顶边 -->
      <svg class="ta-link" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="41,41 56,41 56,54" vector-effect="non-scaling-stroke" />
        <polygon points="56.6,48.6 59.4,48.6 58,50.8" />
      </svg>
      <span class="ta-link-label">复制数据到边缘平台</span>
      <!-- 一、云端：集团侧。实底 + 蓝色边框，和下面的边缘区分开 -->
      <section class="ta-cloud">
        <b class="ta-cloudtag">云端 · 集团</b>
        <div class="ta-row">
          <b class="ta-label">服务前端</b>
          <div class="ta-icons">
            <div v-for="item in frontend" :key="item.name" class="ta-icon">
              <span><Icon :name="item.icon || 'grid'"/></span>
              <small>{{ item.name }}</small>
            </div>
          </div>
        </div>
        <div class="ta-row">
          <b class="ta-label">{{ business.title || '业务中台' }}</b>
          <div class="ta-chips">
            <span v-for="mod in business.modules || []" :key="mod.name">{{ mod.name }}</span>
          </div>
        </div>
        <div class="ta-row ta-split">
          <div class="ta-half">
            <b class="ta-label">{{ tech.title || '技术中台' }}</b>
            <div class="ta-cards">
              <div v-for="c in tech.components || []" :key="c.name" class="ta-card">
                <b>{{ c.name }}</b><small>{{ c.desc }}</small>
              </div>
            </div>
          </div>
          <div class="ta-half ta-half-narrow">
            <b class="ta-label">{{ infra.title || '基建层' }}</b>
            <div class="ta-cards">
              <div v-for="i in infra.items || []" :key="i.name" class="ta-card ta-card-flat">
                <b>{{ i.name }}</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 二、边缘：Smart 园区。整块透明虚线框，中间留空 —— 三维模型就从这里透出来 -->
      <section class="ta-edge">
        <b class="ta-edgetag">边缘 · Smart 园区<b>当前模型就是这一层</b></b>

        <div class="ta-edge-top">
          <span class="ta-sublabel">{{ edge.title || '边缘平台' }}</span>
          <div class="ta-buildings">
            <div v-for="b in edge.buildings || []" :key="b.name" class="ta-building">
              <b>{{ b.name }}</b>
              <i v-for="g in b.gateways || []" :key="g.name">{{ g.name }}</i>
            </div>
          </div>
        </div>

        <!-- 这块是空的：模型从这里透出来 -->
        <div class="ta-edge-gap"></div>

        <div class="ta-edge-bottom">
          <div class="ta-dev-row">
            <span class="ta-dev-label">边缘网关</span>
            <div class="ta-chips">
              <span v-for="g in devices.gateway || []" :key="g">{{ g }}</span>
            </div>
          </div>
          <div class="ta-dev-row">
            <span class="ta-dev-label">设备</span>
            <div class="ta-chips">
              <span v-for="d in devices.infrastructure || []" :key="'i' + d">{{ d }}</span>
              <span v-for="d in devices.smart || []" :key="'s' + d">{{ d }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <div v-if="featureOpen" class="ta-modal" @click.self="featureOpen = null">
        <section class="ta-sheet" role="dialog" aria-modal="true" :aria-label="featureOpen.name">
          <header>
            <h2>{{ featureOpen.name }}</h2>
            <button type="button" class="ta-close" aria-label="关闭" @click="featureOpen = null">×</button>
          </header>
          <div class="ta-figs">
            <figure v-for="img in featureOpen.images || []" :key="img.src">
              <img :src="img.src" :alt="img.caption || featureOpen.name" loading="lazy"/>
              <figcaption v-if="img.caption">{{ img.caption }}</figcaption>
            </figure>
            <p v-if="!(featureOpen.images || []).length" class="ring-empty">这一项还没有配图。</p>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Icon from '../../widgets/Icon.vue';

const featureOpen = ref(null);
function open(item) { featureOpen.value = item; }

defineProps({
  title: { type: String, default: 'BuildingOS 技术架构' },
  feature: { type: Array, default: () => [] },
  frontend: { type: Array, default: () => [] },
  business: { type: Object, default: () => ({}) },
  tech: { type: Object, default: () => ({}) },
  infra: { type: Object, default: () => ({}) },
  edge: { type: Object, default: () => ({}) },
  devices: { type: Object, default: () => ({}) },
});
</script>