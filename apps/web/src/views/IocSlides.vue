<template>
  <div class="deck" :class="{ 'is-editing': editing }" @mousemove="poke">
    <IocDashboard
      v-if="pages.length"
      ref="stage"
      :overrides="page.overrides"
      :studio="page.studio"
      :heading="page.bare ? '' : page.name"
      :heading-sub="headingSub"
      :edit="editState"
      :overlays="page.overlays"
      :use-stored-overrides="false"
      presentation>
      <template #deck-chrome>
        <div
          v-if="pages.length"
          class="deck-chrome"
          :class="{ 'is-visible': chrome || editing }"
          @mouseenter="pin(true)"
          @mouseleave="pin(false)">
          <div class="deck-modes">
            <button :class="{ 'is-on': mode === 'present' }" title="演示模式" @click="setMode('present')">演示</button>
            <button :class="{ 'is-on': mode === 'edit' }" title="编辑模式" @click="setMode('edit')">编辑</button>
          </div>
          <i class="deck-divider"></i>

          <!-- 演示模式只剩翻页，别的都是编辑的事 -->
          <template v-if="mode === 'present'">
            <button class="deck-nav" :disabled="index === 0" title="上一页（←）" @click="go(-1)">←</button>
            <div class="deck-count"><b>{{ index + 1 }}</b> / {{ pages.length }}</div>
            <button class="deck-nav" :disabled="index === pages.length - 1" title="下一页（→）" @click="go(1)">→</button>
          </template>

          <template v-else>
            <button class="deck-action" title="把这一页当前的机位存到本机" @click="saveCurrentView">保存视角</button>
            <button class="deck-action" :disabled="!page.saved" title="丢掉这一页存下来的机位" @click="clearCurrentView">还原视角</button>
            <button class="deck-action" title="生成能贴回 project.js 的机位片段" @click="copyViewCode">复制视角</button>
            <i class="deck-divider"></i>
            <button class="deck-action" :class="{ 'is-on': editing }" @click="toggleEdit">{{ editing ? '退出布局' : '调整布局' }}</button>
            <template v-if="editing">
              <button v-if="!page.free" class="deck-action" @click="enableFree">切成自由摆放</button>
              <template v-else>
                <select class="deck-add" :value="''" aria-label="加一张卡片" @change="onAdd">
                  <option value="">+ 加卡片</option>
                  <option v-for="item in cardTypes" :key="item.type" :value="item.type">{{ item.name }}</option>
                </select>
                <button class="deck-action" @click="copyLayoutCode">复制布局</button>
                <button class="deck-action" @click="resetLayout">还原布局</button>
              </template>
              <span class="deck-hint">拖卡片改位置，拖右下角改大小，× 删掉</span>
            </template>
          </template>

          <i class="deck-divider"></i>
          <a class="deck-exit" href="/ioc/dashboard">退出</a>
        </div>
      </template>
    </IocDashboard>

    <section v-else class="deck-empty">
      <h2>这个项目还没有配演示页</h2>
      <p>在项目的 <code>project.js</code> 里加一个 <code>slides</code> 数组，每项就是一页。</p>
      <a href="/ioc/dashboard">先去看大屏</a>
    </section>

    <Transition name="toast"><div v-if="note" class="deck-note">{{ note }}</div></Transition>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import IocDashboard from './IocDashboard.vue';
import { registries } from '../registries';
import { resolveBoot } from '../core/boot.js';
import { readDeckViews, saveDeckView, clearDeckView, deckViewSnippet } from '../core/deckViews.js';
import { readDeckLayouts, saveDeckLayout, clearDeckLayout, deriveCanvas, nextCardBox, nextInstanceId, deckLayoutSnippet } from '../core/deckLayouts.js';
import './deck.css';

const props = defineProps({
  // 入口已经把配置读好了就直接用，避免两遍
  boot: { type: Object, default: null },
});

const boot = props.boot || resolveBoot();
const project = boot.project;
const slides = (project && project.slides) || [];

// 项目可以统一指定白底，某一页要改再单独写 studio
const projectStudio = project && project.studio !== undefined ? project.studio : null;
// 「拖好之后保存」的那些机位和布局，按项目存在本机
const savedViews = ref(project ? readDeckViews(project.id) : {});
const layouts = ref(project ? readDeckLayouts(project.id) : {});
const stage = ref(null);

const round1 = list => list.map(n => Math.round(Number(n) * 10) / 10);

/* ------------------------------------------------------------------ 每一页 */

// 这一页用哪个态势：页上写了就用页的，没写就跟园区默认
function viewIdOf(slide) {
  if (slide.view) return slide.view;
  const site = registries.sites.get(slide.site || (project && project.site));
  return (site && site.defaultView) || 'overview';
}

// 这一页那个态势的左右两栏放什么卡：先看页上的补丁，再看园区定义
function viewRegions(slide) {
  const patch = ((slide.overrides && slide.overrides.views) || []).find(v => v.id === viewIdOf(slide));
  const site = registries.sites.get(slide.site || (project && project.site));
  const fromSite = ((site && site.views) || []).find(v => v.id === viewIdOf(slide));
  return (patch && patch.regions) || (fromSite && fromSite.regions) || {};
}

// 这个园区定义了哪些态势。换布局时要按它逐个推区域，所以得拿到完整列表
function siteViews(slide) {
  const site = registries.sites.get(slide.site || (project && project.site));
  return (site && site.views) || [];
}

const cardTypes = computed(() => registries.cards.list().map(card => ({ type: card.type, name: card.name })));

// 一页 = 一份 IOC 配置。项目里的 site / theme / layout 是底色，页上写的盖上去；
// 机位和布局则是「本机存下来的 > 项目文件里的」。
const pages = computed(() => slides.map((slide) => {
  const base = boot.baseOverrides || {};
  const overrides = { ...base, ...(slide.overrides || {}) };
  for (const key of ['site', 'theme', 'layout']) {
    if (slide[key]) overrides[key] = slide[key];
  }
  const viewId = viewIdOf(slide);
  overrides.navigation = { ...(overrides.navigation || {}), active: viewId };

  // 本机存了这一页的自由摆放就用它：布局换成画布，每张卡带上自己的 box
  const draft = layouts.value[slide.id] || null;
  if (draft) {
    overrides.layout = 'free-canvas';
    const cards = { ...(overrides.cards || {}) };
    for (const [id, entry] of Object.entries(draft.cards || {})) {
      cards[id] = { ...(cards[id] || {}), type: entry.type, box: entry.box };
    }
    overrides.cards = cards;
    // 布局是整页的属性：所有态势的区域都得换成 canvas，不能只换当前这个，
    // 否则剩下的态势还挂着 left / right，校验会说「布局里不存在的区域」
    const patches = overrides.views || [];
    overrides.views = siteViews(slide).map((view) => {
      const patch = patches.find(item => item.id === view.id) || {};
      return { ...view, ...patch, regions: { canvas: (draft.lists && draft.lists[view.id]) || [] } };
    });
  }

  const savedCamera = savedViews.value[slide.id] || null;
  const camera = savedCamera || slide.camera;
  if (camera && Array.isArray(camera.position)) {
    // 只往 scene.main.options 里塞相机，别把页面自己配的 scene.main.provider 冲掉
    const scene = overrides.scene || {};
    const main = scene.main || {};
    overrides.scene = {
      ...scene,
      // view 要把整个机位对象铺开 —— 只搬 position/target 会把 zoom 和 mode 丢掉
      main: { ...main, options: { ...(main.options || {}), view: { ...camera, position: camera.position, target: camera.target || [0, 0, 0] } } },
    };
  }

  return {
    id: slide.id || slide.name,
    name: slide.name || slide.id || '未命名',
    // 没写 studio 就跟项目；项目也没写就不管，沿用页面自己的按钮状态
    studio: slide.studio === undefined ? projectStudio : slide.studio,
    saved: Boolean(savedCamera),
    savedLayout: Boolean(draft),
    free: Boolean(draft),
    overlays: slide.overlays || [],
    // 封页这类不需要顶栏的页面写 bare: true
    bare: Boolean(slide.bare),
    overrides,
  };
}));

const headingSub = computed(() => {
  const parts = [];
  if (project && project.name) parts.push(project.name);
  parts.push((index.value + 1) + ' / ' + pages.value.length);
  return parts.join(' · ');
});

function readIndex() {
  const raw = Number(new URLSearchParams(location.search).get('slide'));
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(Math.trunc(raw), 0), Math.max(pages.value.length - 1, 0));
}

const index = ref(readIndex());
const page = computed(() => pages.value[index.value] || { id: '', name: '', studio: null, saved: false, savedLayout: false, free: false, overrides: {} });
const currentSlide = () => slides[index.value] || null;

/* ------------------------------------------------------- 自由摆放（编辑布局） */

const editing = ref(false);
// 两种模式：演示只管翻页和机位，编辑才露出布局、加卡片和代码工具
const mode = ref('present');
function setMode(next) {
  mode.value = next;
  if (next === 'present' && editing.value) exitEdit();
}

// 改这一页的布局草稿：读出来、改、存回去
function mutateDraft(mutator) {
  const slide = currentSlide();
  if (!slide || !project) return;
  const draft = layouts.value[slide.id] || { lists: {}, cards: {} };
  const next = {
    lists: Object.fromEntries(Object.entries(draft.lists || {}).map(([id, list]) => [id, list.slice()])),
    cards: { ...(draft.cards || {}) },
  };
  mutator(next);
  layouts.value = saveDeckLayout(project.id, slide.id, next);
}

// 传给页面，LayoutRegion 拖完卡就调这两个
const editState = reactive({
  active: false,
  move(id, box) {
    mutateDraft(next => {
      const entry = next.cards[id] || { type: id };
      next.cards[id] = { ...entry, box };
    });
  },
  remove(id) {
    mutateDraft(next => {
      for (const viewId of Object.keys(next.lists)) next.lists[viewId] = next.lists[viewId].filter(item => item !== id);
      delete next.cards[id];
    });
    say('已删掉一张卡');
  },
});

function toggleEdit() {
  editing.value = !editing.value;
  editState.active = editing.value;
  poke();
  if (editing.value) say('拖卡片改位置，拖右下角改大小');
}
function exitEdit() {
  editing.value = false;
  editState.active = false;
  say('已退出编辑布局');
}

function enableFree() {
  const slide = currentSlide();
  if (!slide || !project) return;
  // 把这一页对每个态势的改动先合进园区定义，再逐个推出画布区域
  const patches = (slide.overrides && slide.overrides.views) || [];
  const views = siteViews(slide).map(view => {
    const patch = patches.find(item => item.id === view.id);
    return patch ? { ...view, ...patch } : view;
  });
  layouts.value = saveDeckLayout(project.id, slide.id, deriveCanvas(views));
  say('已切成自由摆放，拖一下试试');
}

function onAdd(event) {
  const type = event.target.value;
  event.target.value = '';
  if (!type) return;
  const slide = currentSlide();
  if (!slide || !project) return;
  if (!layouts.value[slide.id]) enableFree();
  const viewId = viewIdOf(slide);
  mutateDraft(next => {
    const list = next.lists[viewId] || [];
    const used = Object.values(next.lists).flat();
    // 这一页还没用过这种卡就直接用它自己的实例；已经有了就再开一个实例
    const id = list.includes(type) ? nextInstanceId(type, used) : type;
    if (!next.cards[id]) next.cards[id] = { type, box: nextCardBox(Object.keys(next.cards).length) };
    next.lists[viewId] = [...list, id];
  });
  say('已加上「' + cardName(type) + '」，拖到想要的位置');
}

function cardName(type) {
  const found = registries.cards.get(type);
  return found ? found.name : type;
}

function resetLayout() {
  const slide = currentSlide();
  if (!slide || !project) return;
  layouts.value = clearDeckLayout(project.id, slide.id);
  say('已还原成项目文件里的布局');
}

async function copyLayoutCode() {
  const text = deckLayoutSnippet(page.value.overrides);
  try {
    await navigator.clipboard.writeText(text);
    say('已复制，替换 project.js 这一页的 overrides');
  } catch (error) {
    say('复制失败，片段已打到控制台');
    console.log(text);
  }
}

/* --------------------------------------------------------------- 视角和翻页 */

function liveView() {
  const handle = stage.value;
  return handle && typeof handle.currentView === 'function' ? handle.currentView() : null;
}

function saveCurrentView() {
  if (!project) return;
  const current = liveView();
  if (!current) { say('这一页的模型不支持机位读写'); return; }
  // zoom 和 mode 也算视角的一部分，一起存 —— 不然切到 3D 存完再回来按钮还停在 2.5D
 const saved = { position: round1(current.camera), target: round1(current.target) };
 if (typeof current.zoom === 'number') saved.zoom = current.zoom;
 if (current.mode) saved.mode = current.mode;
 savedViews.value = saveDeckView(project.id, page.value.id, saved);
  say('第 ' + (index.value + 1) + ' 页的视角已存在本机');
}

function clearCurrentView() {
  if (!project) return;
  savedViews.value = clearDeckView(project.id, page.value.id);
  say('已还原成项目文件里的视角');
}

async function copyViewCode() {
  const current = liveView();
  if (!current) { say('读不到当前机位'); return; }
  // 把 zoom / mode 一起带上 —— 平面这张图的缩放和 2.5D/3D 状态也是视角的一部分
 const code = deckViewSnippet({ ...current, position: current.camera });
  try {
    await navigator.clipboard.writeText(code);
    say('已复制，粘到 project.js 这一页里');
  } catch (error) {
    say('复制失败：' + code);
  }
}

const chrome = ref(true);
const note = ref('');
let idleTimer, noteTimer, hovering = false;

function poke() {
  chrome.value = true;
  clearTimeout(idleTimer);
  // 编辑布局或者鼠标停在栏上时不淡出
  if (hovering || editing.value) return;
  idleTimer = setTimeout(() => { chrome.value = false; }, 2600);
}
function pin(value) {
  hovering = value;
  if (value) { chrome.value = true; clearTimeout(idleTimer); }
  else poke();
}
function say(text) {
  note.value = text;
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { note.value = ''; }, 3200);
}

function go(step) {
  const next = Math.min(Math.max(index.value + step, 0), pages.value.length - 1);
  if (next === index.value) return;
  index.value = next;
  poke();
  const url = new URL(location.href);
  url.searchParams.set('slide', String(next));
  history.replaceState(history.state, '', url);
}

function onKey(event) {
  if (event.target && /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
  switch (event.key) {
    case 'ArrowLeft': case 'PageUp': case 'Backspace': go(-1); break;
    case 'ArrowRight': case 'PageDown': case ' ': go(1); break;
    case 'Home': index.value = 0; poke(); break;
    case 'End': index.value = pages.value.length - 1; poke(); break;
    default: break;
  }
}

watch(pages, () => { if (index.value > pages.value.length - 1) index.value = Math.max(pages.value.length - 1, 0); });

onMounted(() => {
  document.addEventListener('keydown', onKey);
  poke();
});
onBeforeUnmount(() => {
  clearTimeout(idleTimer);
  clearTimeout(noteTimer);
  document.removeEventListener('keydown', onKey);
});
</script>