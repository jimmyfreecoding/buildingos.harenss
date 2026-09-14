<template>
  <div class="scenario-ring">
    <!-- 顶部：这一页的一句话定义（老 PPT 里 IOC 智慧运营中心 那条横幅） -->
    <div v-if="banner" class="ring-banner">
      <b>{{ banner.title }}</b>
      <span>{{ banner.text }}</span>
    </div>

    <!-- 引线：从每个节点指向中间的模型，两端各留一段，不压图标也不盖住楼 -->
    <svg class="ring-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line
        v-for="node in nodes"
        :key="node.id"
        :x1="point(node, 0.12).x"
        :y1="point(node, 0.12).y"
        :x2="point(node, 0.54).x"
        :y2="point(node, 0.54).y"
        vector-effect="non-scaling-stroke" />
    </svg>

    <button
      v-for="node in nodes"
      :key="node.id"
      type="button"
      class="ring-node"
      :style="{ left: node.x + '%', top: node.y + '%' }"
      @click="open = node">
      <span class="ring-icon"><Icon :name="node.icon || 'grid'"/></span>
      <b>{{ node.name }}</b>
    </button>

    <!-- 底部：运营闭环那条流程带 -->
    <div v-if="loop.length" class="ring-loop">
      <b class="ring-loop-label">运营闭环</b>
      <div class="ring-loop-steps">
        <template v-for="(step, index) in loop" :key="step.title">
          <em v-if="index !== loop.length - 1" class="ring-step-arrow">›</em>
          <div class="ring-step">
            <b>{{ step.title }}</b>
            <span>{{ step.sub }}</span>
          </div>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="open" class="ring-modal" @click.self="open = null">
        <section class="ring-sheet" role="dialog" aria-modal="true" :aria-label="detail.title">
          <header>
            <span class="ring-eyebrow">{{ title }}</span>
            <h2>
              <span class="ring-title-icon"><Icon :name="detail.icon"/></span>{{ detail.title }}
            </h2>
            <p v-if="detail.desc">{{ detail.desc }}</p>
            <button type="button" class="ring-close" aria-label="关闭" @click="open = null">×</button>
          </header>
          <div v-if="detail.usage" class="ring-note">
            <b>用</b>
            <p>{{ detail.usage }}</p>
          </div>
          <div v-if="detail.example" class="ring-note">
            <b>例</b>
            <p>{{ detail.example }}</p>
          </div>
          <table v-if="detail.rows.length" class="ring-table">
            <thead>
              <tr>
                <th>对标维度</th>
                <th v-for="column in columns" :key="column">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in detail.rows" :key="row.dim">
                <th>{{ row.dim }}</th>
                <td v-for="(value, i) in row.values" :key="i" :class="{ 'is-todo': isTodo(value) }">{{ value }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="ring-empty">这一项的对标内容还没填。</p>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Icon from '../../widgets/Icon.vue';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  title: { type: String, default: '场景对标' },
  columns: { type: Array, default: () => ['Smart 园区', '吉行园区', '望潮', '吉利集团'] },
  details: { type: Object, default: () => ({}) },
  banner: { type: Object, default: null },
  loop: { type: Array, default: () => [] },
});

const open = ref(null);
const detail = computed(() => {
  const found = (open.value && props.details && props.details[open.value.id]) || {};
  return {
    title: found.title || (open.value ? open.value.name : ''),
    // 标题前的小图标，和点开之前环上那个节点用的是同一个
    icon: (open.value && open.value.icon) || 'grid',
    desc: found.desc || '',
    usage: found.usage || '',
    example: found.example || '',
    rows: found.rows || [],
  };
});

// 引线两点之间的插值：t=0 在节点上，t=1 在模型正中
function point(node, t) {
  return { x: node.x + (50 - node.x) * t, y: node.y + (50 - node.y) * t };
}
function isTodo(value) { return !value || value === '待补充'; }
</script>
