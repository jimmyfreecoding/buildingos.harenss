<template>
  <main class="studio">
    <header class="studio-head">
      <div><h1>IOC 搭建</h1><p>选园区、布局、主题和态势，再往左右两栏里增删排序卡片。改动会即时存到本机。</p></div>
      <div class="studio-actions">
        <button class="ghost" @click="openDashboard">打开大屏</button>
        <button class="primary" @click="copyLink">复制分享链接</button>
      </div>
    </header>

    <section class="studio-bar">
      <label>园区<select v-model="siteId" @change="rebuildFromSite"><option v-for="s in siteList" :key="s.id" :value="s.id">{{ s.name }}</option></select></label>
      <label>布局<select v-model="layoutId" @change="patch({ layout: layoutId })"><option v-for="l in layoutList" :key="l.id" :value="l.id">{{ l.name }}</option></select></label>
      <label>主题<select v-model="themeId" @change="patch({ theme: themeId })"><option v-for="t in themeList" :key="t.id" :value="t.id">{{ t.name }}</option></select></label>
      <label>当前态势<select v-model="viewId" @change="patch({ navigation: { active: viewId } })"><option v-for="v in views" :key="v.id" :value="v.id">{{ v.name }}</option></select></label>
    </section>

    <section class="studio-regions">
      <div v-for="region in stackRegions" :key="region.id" class="studio-region">
        <h2>{{ region.label }}<small>{{ region.id }}</small></h2>
        <ol>
          <li v-for="(instanceId, index) in regionCards(region.id)" :key="instanceId + '-' + index">
            <span>{{ cardName(instanceId) }}</span>
            <button :disabled="index === 0" title="上移" @click="moveCard(region.id, index, -1)">↑</button>
            <button :disabled="index === regionCards(region.id).length - 1" title="下移" @click="moveCard(region.id, index, 1)">↓</button>
            <button class="danger" title="移除" @click="removeCard(region.id, index)">移除</button>
          </li>
          <li v-if="!regionCards(region.id).length" class="empty">这个区域还没有卡片</li>
        </ol>
        <select class="adder" @change="addCard(region.id, $event.target.value); $event.target.value = ''">
          <option value="">＋ 往这里加一张卡…</option>
          <option v-for="def in availableCards" :key="def.type" :value="def.type">{{ def.name }}</option>
        </select>
      </div>
    </section>

    <section class="studio-presets">
      <h2>预设</h2>
      <div class="preset-row">
        <input v-model="presetName" placeholder="给这套配置起个名字" />
        <button class="primary" :disabled="!presetName.trim()" @click="saveCurrent">保存</button>
      </div>
      <ul>
        <li v-for="preset in presets" :key="preset.name">
          <button class="link" @click="loadPreset(preset.name)">{{ preset.name }}</button>
          <small>{{ preset.savedAt }}</small>
          <button class="danger" @click="dropPreset(preset.name)">删除</button>
        </li>
        <li v-if="!presets.length" class="empty">还没有保存过预设</li>
      </ul>
    </section>

    <p v-if="toast" class="studio-toast">{{ toast }}</p>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue';
import { registries, initialSiteId } from '../registries';
import { resolveSpec } from '../core/resolve.js';
import { shareUrl, compactSpec } from '../core/spec/serialize.js';
import { listPresets, savePreset, removePreset, findPreset, saveDraft, readDraft } from '../core/presets.js';

const siteList = computed(() => registries.sites.list());
const layoutList = computed(() => registries.layouts.list());
const themeList = computed(() => registries.themes.list());
const availableCards = computed(() => registries.cards.list());

const draft = ref(null);
const siteId = ref(initialSiteId());
const layoutId = ref('');
const themeId = ref('');
const viewId = ref('');
const presets = ref(listPresets());
const presetName = ref('');
const toast = ref('');

function notify(message) {
  toast.value = message;
  setTimeout(() => { if (toast.value === message) toast.value = ''; }, 2600);
}

/** 当前园区 + 覆盖项 = 一份完整配置 */
function build(overrides) {
  return resolveSpec(registries.sites.get(siteId.value), registries, overrides || readDraft() || {});
}

function syncSelectors(spec) {
  layoutId.value = spec.layout;
  themeId.value = spec.theme;
  viewId.value = (spec.navigation && spec.navigation.active) || (spec.views[0] && spec.views[0].id) || '';
}

function rebuildFromSite() {
  const spec = build({});
  draft.value = spec;
  syncSelectors(spec);
  saveDraft(spec);
}

const spec = computed(() => draft.value || build({}));
const views = computed(() => spec.value.views || []);
const currentView = computed(() => views.value.find(v => v.id === viewId.value) || views.value[0] || {});

const stackRegions = computed(() => {
  const layout = registries.layouts.get(layoutId.value);
  return layout ? layout.regions.filter(r => r.role === 'stack') : [];
});

function regionCards(regionId) {
  const regions = currentView.value.regions || {};
  return regions[regionId] || [];
}

function cardName(instanceId) {
  const instance = (spec.value.cards || {})[instanceId];
  const def = instance ? registries.cards.get(instance.type) : null;
  return def ? def.name : instanceId;
}

/** 改配置的统一入口：克隆一份、改掉、存草稿 */
function patch(overrides) {
  const next = resolveSpec(registries.sites.get(siteId.value), registries, { ...spec.value, ...overrides });
  draft.value = next;
  syncSelectors(next);
  saveDraft(next);
}

// 区域 id 直接由调用方给，这里只负责「克隆 -> 改 -> 存」
function withRegion(regionId, mutate) {
  const next = JSON.parse(JSON.stringify(spec.value));
  const view = next.views.find(v => v.id === viewId.value) || next.views[0];
  view.regions = view.regions || {};
  const list = view.regions[regionId] || (view.regions[regionId] = []);
  mutate(list, next);
  draft.value = next;
  saveDraft(next);
}

function addCard(regionId, type) {
  if (!type) return;
  withRegion(regionId, (list, next) => {
    list.push(type);
    if (!next.cards[type]) {
      const def = registries.cards.get(type);
      next.cards[type] = { type, props: { ...(def ? def.props : {}) } };
    }
  });
  notify('已加入「' + cardName(type) + '」');
}

function removeCard(regionId, index) {
  withRegion(regionId, list => { list.splice(index, 1); });
}

function moveCard(regionId, index, delta) {
  withRegion(regionId, list => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
  });
}

function saveCurrent() {
  presets.value = savePreset(presetName.value.trim(), spec.value);
  notify('已保存预设「' + presetName.value.trim() + '」');
  presetName.value = '';
}

function loadPreset(name) {
  const preset = findPreset(name);
  if (!preset) return;
  draft.value = preset.spec;
  siteId.value = preset.spec.site || siteId.value;
  syncSelectors(preset.spec);
  saveDraft(preset.spec);
  notify('已载入「' + name + '」');
}

function dropPreset(name) {
  presets.value = removePreset(name);
  notify('已删除「' + name + '」');
}

/** 只把改过的部分编进链接，否则地址会长到没法分享 */
function shareable() {
  const base = resolveSpec(registries.sites.get(spec.value.site), registries, {});
  return shareUrl(compactSpec(spec.value, base), location.origin + '/ioc/dashboard');
}

function openDashboard() {
  saveDraft(spec.value);
  location.href = shareable();
}

async function copyLink() {
  const link = shareable();
  try {
    await navigator.clipboard.writeText(link);
    notify('分享链接已复制');
  } catch (error) {
    notify('复制失败，链接：' + link.slice(0, 80) + '…');
  }
}

rebuildFromSite();
</script>

<style scoped>
.studio{min-height:100dvh;background:#11161d;color:#e7f3ff;font-family:'Noto Sans SC','Microsoft YaHei',sans-serif;font-size:13px;padding:26px clamp(16px,4vw,48px) 60px}
.studio h1{font-size:22px;margin:0;letter-spacing:1px}
.studio h2{font-size:14px;margin:0 0 12px;letter-spacing:1px;color:#c3e6ff}
.studio h2 small{margin-left:8px;font-size:10px;color:#7896ad;letter-spacing:.5px}
.studio p{margin:6px 0 0;color:#93aabe;font-size:12px}
.studio-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;padding-bottom:18px;border-bottom:1px solid #b1d6f12e}
.studio-actions{display:flex;gap:10px}
.studio button{font:inherit;cursor:pointer;border-radius:4px;border:1px solid #b6dcff33;background:#1b2a3a;color:#dbeaf7;padding:7px 14px}
.studio button:disabled{opacity:.4;cursor:not-allowed}
.studio button.primary{background:#2a5f8f;border-color:#8ddbff66}
.studio button.ghost{background:transparent}
.studio button.danger{background:transparent;border-color:#ff947b55;color:#ffb3a0;padding:4px 10px}
.studio button.link{background:none;border:0;color:#8ddbff;padding:0;text-decoration:underline}
.studio-bar{display:flex;gap:18px;flex-wrap:wrap;margin:22px 0 8px}
.studio-bar label{display:flex;flex-direction:column;gap:6px;font-size:11px;color:#93aabe}
.studio select,.studio input{font:inherit;background:#18222e;color:#e7f3ff;border:1px solid #b6dcff2e;border-radius:4px;padding:7px 10px;min-width:150px}
.studio-regions{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-top:24px}
.studio-region{background:#18222e;border:1px solid #b6dcff1f;border-radius:6px;padding:16px}
.studio-region ol{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-direction:column;gap:8px}
.studio-region li{display:flex;align-items:center;gap:8px;background:#111a24;border:1px solid #b6dcff1a;border-radius:4px;padding:8px 10px}
.studio-region li span{flex:1}
.studio-region li.empty,.studio-presets li.empty{color:#6f8ba3;font-size:11px;background:none;border:0}
.studio-region .adder{width:100%}
.studio-presets{margin-top:32px;background:#18222e;border:1px solid #b6dcff1f;border-radius:6px;padding:16px;max-width:640px}
.preset-row{display:flex;gap:10px;margin-bottom:12px}
.preset-row input{flex:1}
.studio-presets ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.studio-presets li{display:flex;align-items:center;gap:12px}
.studio-presets li small{color:#6f8ba3;font-size:10px}
.studio-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#1d3a2c;border:1px solid #85e5b266;color:#d5f3e3;padding:10px 18px;border-radius:4px}
</style>
