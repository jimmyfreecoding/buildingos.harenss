<template>
  <main class="ioc-shell" :class="{ 'warehouse-site': site.id === 'houston', 'is-night': hour < 6 || hour > 19, 'is-presenting': presentation, 'has-deck-heading': presentation && heading }">
    <!-- 舞台常驻：不能用 v-if/v-else 跟组件型场景互斥，否则切回来时节点被重建、
       原来的 WebGL canvas 一起没了，而园区没变 mountCampus 不会重跑，模型就回不来 -->
  <!-- v-show 而不是 v-if：组件型场景接管时只是隐藏舞台，节点和里面的 canvas 都留着，
       切回前面的页面才能立刻看到模型 -->
  <div v-show="!componentScene" ref="stage" class="campus-stage" aria-label="可交互的三维园区，拖动旋转、滚轮缩放"></div>
  <component :is="componentScene.component" v-if="componentScene" ref="sceneRef" :view="sceneView" :room-state="sceneRoomState" />
  <!-- 页面级覆盖层：不是卡片，没有面板外壳，只是浮在模型上面的注释层 -->
  <div v-if="presentation && overlays.length" class="page-overlays">
    <component :is="overlayFor(overlay)" v-for="(overlay, i) in overlays" :key="i" v-bind="overlay" @detail="openDetails" @room-state="onRoomState" />
  </div>
    <iframe v-if="streamUrl" :src="streamUrl" class="unreal-player" title="Unreal Engine Pixel Streaming 园区" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>
    <div class="scene-vignette"></div>
    <div v-if="sceneError && !streamUrl" class="scene-error"><Icon name="info"/><h2>三维场景初始化失败</h2><p>{{ sceneError }}</p><button @click="reload">重新加载</button></div>

    <header v-if="presentation && heading" class="deck-heading">
    <h1>{{ heading }}</h1>
    <!-- 演示工具条：插在标题和右侧信息之间，紧挨着「项目 · 演示 · 页码」 -->
    <slot name="deck-chrome" />
    <span>{{ headingSub }}</span>
  </header>

  <header class="ioc-header">
      <a class="ioc-brand" href="/ioc" :aria-label="site.name+'首页'"><span class="brand-symbol"><i></i><i></i><i></i></span><div><h1>{{ site.name }}智慧化管理平台</h1><span>{{ site.english }} · INTELLIGENT OPERATIONS CENTER</span></div></a>
      <nav aria-label="态势导航"><button v-for="tab in tabs" :key="tab.id" :class="{active:activeTab===tab.id}" @click="selectTab(tab.id)"><Icon :name="tab.icon"/><span>{{ tab.name }}</span><i></i></button></nav>
      <div class="header-status"><div class="header-clock"><strong>{{ time }}</strong><span>{{ date }}</span></div><span class="status-divider"></span><Icon :name="weatherIcon"/><div class="header-weather"><b>{{ weatherName }} <span>{{ temperature }}°C</span></b><small>东南风 2 级</small></div><button class="icon-button fullscreen" aria-label="全屏显示" title="全屏显示" @click="fullscreen"><Icon name="expand"/></button></div>
    </header>

    <div class="scene-heading"><span class="live-dot"></span><span>{{ currentView.title }}</span><span class="scene-heading-line"></span><small>{{ site.location || site.english }}</small></div>
    <div class="scene-engine"><span :class="{ connected:streamUrl }"></span>{{ streamUrl?'UNREAL ENGINE · 外部串流':'WEBGL · 实时三维' }}<i>{{ streamUrl?'PLAYER':`${fps} FPS` }}</i></div>

    <template v-if="!streamUrl && !sceneError"><button v-for="label in labels" v-show="label.visible && showLabels" :key="label.id" class="building-marker" :class="{ selected:selectedBuilding?.id===label.id }" :style="{left:label.x+'px',top:label.y+'px'}" @click="focusBuilding(label.id)"><span>{{ buildings.find(b=>b.id===label.id)?.label || label.id+' 座' }}</span><div><Icon name="building"/></div><i></i></button></template>

    <LayoutRenderer :runtime-props="runtimeProps" @detail="openDetails" @open-monitor="openMonitor" @open-alarm="openAlarm">

    <!-- 大屏仍然用这块浮层。演示模式不用它：那边由 cards/summary 这张卡负责，
       这样它能进态势的区域列表，就能在自由画布里拖、拉大小、删掉。 -->
  <section v-if="!presentation && currentView.metrics && currentView.metrics.length && !selectedBuilding" class="domain-card"><div><Icon :name="currentView.icon"/><b>{{ currentView.title }}</b><span>专题视图</span></div><p>{{ currentView.description }}</p><div class="domain-metrics"><div v-for="m in currentView.metrics" :key="m.label"><strong>{{ m.value }}</strong><span>{{ m.label }}</span></div></div><button @click="openDetails(activeTab)">查看专题详情 <Icon name="arrow"/></button></section>

    <component :is="indoorOverlay.component" v-if="indoorOverlay" @close="closeFloorPlan"/>
  <!-- 大屏用浮层（三栏布局的侧栏放不下平面图）。演示模式由 cards/plan 这张卡负责，
       这样它能进自由画布的盒子，能拖能改大小。同一个组件，floating 切外壳。 -->
  <PlanCard v-if="!presentation && exploded && !indoorOverlay && !streamUrl" floating :floor="exploded" @close="closeFloorPlan"/>

  <BuildingCard v-if="!presentation && selectedBuilding && !streamUrl && !exploded" floating :building="selectedBuilding" @close="selectedBuilding=null" @detail="openDetails"/>

    <div class="scene-tools"><button :class="{active:showLabels}" :disabled="!!streamUrl" title="楼栋标记" aria-label="切换楼栋标记" @click="showLabels=!showLabels"><Icon name="pin"/></button><button :disabled="!!streamUrl" title="园区俯瞰" aria-label="园区俯瞰" @click="topView"><Icon name="layers"/></button><button :class="{active:showFloorPicker}" :disabled="!!streamUrl || !canExploreFloors" :title="canExploreFloors?'楼层炸开':'当前园区暂未配置楼层平面'" aria-label="楼层炸开" @click="toggleFloorPicker"><Icon name="floors"/></button><button :class="{active:showAi}" title="AI 编排" aria-label="AI 编排" @click="showAi=!showAi"><Icon name="ai"/></button><button :disabled="!deckProject" :title="deckProject?'进入演示文稿 · 左右键翻页':'还没有配置演示文稿的项目'" aria-label="进入演示文稿" @click="openDeck"><Icon name="play"/></button><button title="渲染引擎设置" aria-label="渲染引擎设置" @click="showSettings=true"><Icon name="settings"/></button></div>
    <div class="scene-toolbar"><div class="toolbar-group view-group"><button :disabled="!!streamUrl" title="还原初始视角" @click="resetView"><Icon name="focus"/><span>全景</span></button><button :disabled="!!streamUrl" :class="{active:orbiting}" @click="toggleOrbit"><Icon name="orbit"/><span>漫游</span></button></div><i class="toolbar-divider"></i><div class="toolbar-group weather-group"><button v-for="w in weatherOptions" :key="w.id" :disabled="!!streamUrl" :class="{active:weather===w.id}" :title="w.label" :aria-label="w.label" @click="setWeather(w.id)"><Icon :name="w.icon"/><span>{{ w.label }}</span></button></div><i class="toolbar-divider"></i><button :disabled="!!streamUrl || !canStudio" :class="{active:studio}" :title="canStudio?(studio?'关闭纯白背景':'纯白背景 · 适合 PPT 展示'):'当前模型暂不支持纯白背景'" aria-label="纯白背景" @click="toggleStudio"><Icon name="studio"/><span>白底</span></button><button class="day-toggle" :disabled="!!streamUrl" :class="{active:showTime}" @click="showTime=!showTime"><Icon :name="hour<6||hour>19?'moon':'sun'"/><span>{{ String(hour).padStart(2,'0') }}:00</span></button></div>
    <section v-if="showFloorPicker && !streamUrl" class="floor-picker">
      <div class="panel-heading"><Icon name="floors"/><h2>楼层炸开</h2><small>EXPLODE</small><span v-if="exploded" class="picker-current">{{ exploded.id }}座 {{ exploded.floor }}F</span><button class="icon-button" aria-label="关闭楼层面板" @click="toggleFloorPicker"><Icon name="close"/></button></div>
      <div class="floor-building-switch"><button v-for="b in floorBuildings" :key="b.id" :class="{active:floorBuilding===b.id}" @click="floorBuilding=b.id">{{ b.label || b.id+' 座' }}</button></div>
      <div class="floor-grid"><button v-for="f in availableFloors" :key="f" :class="{active:exploded&&exploded.id===floorBuilding&&exploded.floor===f}" @click="pickFloor(f)">{{ f }}F</button></div>
      <div class="floor-picker-foot"><span>{{ site.floorPickerHint }}</span><b>查看该层平面图</b></div>
    </section>
    <div v-if="showTime && !streamUrl" class="time-popover"><div><span>太阳时刻 · 光照模拟</span><b>{{ String(hour).padStart(2,'0') }}:00</b></div><input v-model.number="hour" type="range" min="0" max="23" aria-label="太阳时刻" @input="applyEnvironment"/><div class="time-ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div><div class="time-presets"><button @click="setHour(7)">清晨</button><button @click="setHour(14)">日间</button><button @click="setHour(18)">黄昏</button><button @click="setHour(22)">夜景</button></div></div>

    <footer class="ioc-footer"><span><i class="live-dot"></i> {{ streamUrl?'外部 Pixel Streaming 播放器':'本地三维场景已就绪' }}</span><span class="interaction-hint">左键旋转 · 右键平移 · 滚轮缩放</span><span>概念模型 <i>·</i> 业务数据为模拟数据 <i>·</i> {{ date }}</span></footer>

    <Transition name="toast"><div v-if="toast" class="ioc-toast"><Icon name="check"/>{{ toast }}</div></Transition>
    <div v-if="modal" class="ioc-modal-overlay" @click.self="modal=null"><section class="ioc-modal" :class="{'monitor-modal':modal.type==='monitor'}" role="dialog" aria-modal="true" :aria-label="modal.title"><div class="modal-heading"><div><span class="eyebrow">{{ site.english }} · OPERATIONS</span><h2>{{ modal.title }}</h2></div><button class="icon-button" aria-label="关闭弹窗" @click="modal=null"><Icon name="close"/></button></div>
      <template v-if="modal.type==='monitor'"><div class="monitor-large"><img :src="snapshots[modal.index]" :alt="modal.title"/><span>CAM 0{{ modal.index+1 }} <i></i> 场景模拟预览</span><time>{{ time }}</time></div><div class="modal-note">此画面由当前三维场景生成。真实监控可接入园区视频平台。</div><button class="primary-button" @click="refreshSnapshots">刷新场景快照 <Icon name="orbit"/></button></template>
      <template v-else-if="modal.type==='alarm'"><div class="alarm-detail"><span :class="modal.alarm.resolved?'good-pill':'warn-pill'">{{ modal.alarm.resolved?'已处理':'待处理 · '+modal.alarm.level }}</span><h3>{{ modal.alarm.description }}</h3><dl><dt>告警点位</dt><dd>{{ modal.alarm.location }}</dd><dt>发生时间</dt><dd>{{ date }} {{ modal.alarm.time }}</dd><dt>事件编号</dt><dd>{{ modal.alarm.id }}</dd><dt>处理建议</dt><dd>核查现场情况，确认后登记处理。</dd></dl><p class="modal-note">演示事件，处理状态保存在本次浏览器中。</p></div><button class="primary-button" :disabled="modal.alarm.resolved" @click="resolveAlarm(modal.alarm)"><Icon name="check"/>{{ modal.alarm.resolved?'已完成处理':'确认并标记已处理' }}</button></template>
      <template v-else><p class="modal-description">{{ modal.description }}</p><div class="detail-table"><div v-for="row in modal.rows" :key="row[0]" class="detail-row" :class="{ 'has-kids': row[3] && row[3].length, 'is-open': openRows[row[0]] }" @click="row[3] && row[3].length && toggleRow(row[0])"><span>{{ row[0] }}</span><strong>{{ row[1] }}</strong><small>{{ row[2] }}</small><em v-if="row[3] && row[3].length">{{ openRows[row[0]] ? '收起' : '展开 ' + row[3].length + ' 层' }}</em><table v-if="row[3] && row[3].length && openRows[row[0]]" class="detail-kids"><thead><tr><th>楼层</th><th>数量</th><th>名称</th></tr></thead><tbody><tr v-for="(k, ki) in kidsTable(row)" :key="ki"><td class="kid-floor">{{ k.floor }}</td><td class="kid-count">{{ k.count }}</td><td class="kid-names"><span v-for="(n, ni) in k.names" :key="ni">{{ n }}</span><i v-if="k.clipped">…</i></td></tr></tbody></table></div></div><div class="modal-note"><Icon name="info"/></div></template>
    </section></div>

    <div v-if="showSettings" class="ioc-modal-overlay" @click.self="showSettings=false"><section class="ioc-modal settings-modal" role="dialog" aria-modal="true" aria-label="渲染引擎设置"><div class="modal-heading"><div><span class="eyebrow">RENDERING ENGINE</span><h2>三维引擎与串流接入</h2></div><button class="icon-button" aria-label="关闭设置" @click="showSettings=false"><Icon name="close"/></button></div><div class="engine-option"><span class="engine-logo">3D</span><div><b>{{ streamUrl?'Unreal Engine Pixel Streaming':'本地 WebGL 实时场景' }}</b><p>{{ streamUrl?'正在使用外部播放器页面':'程序化建筑 · 动态光照 · 天气模拟 · 交互漫游' }}</p></div><span class="good-pill">当前</span></div><h3>园区模型</h3><label for="campus-model">本地 WebGL 模型</label><select id="campus-model" class="campus-model-select" :value="siteId" @change="switchModel($event.target.value)"><option v-for="item in siteList" :key="item.id" :value="item.id">{{ item.name }}</option></select><p class="settings-copy">{{ site.description }} 切换后自动保存至当前浏览器。</p><h3>界面主题</h3><label for="ioc-theme">界面与模型配色</label><select id="ioc-theme" class="campus-model-select" :value="themeId" @change="switchTheme($event.target.value)"><option v-for="t in themeList" :key="t.id" :value="t.id">{{ t.name }}</option></select><p class="settings-copy">主题同时改变界面配色和三维模型的材质配色。</p><h3>配置与分享</h3><p class="settings-copy">当前配置可以复制成链接发给别人，也可以到搭建页可视化调整卡片排布。</p><div class="settings-actions"><button class="secondary-button" @click="openStudio">打开搭建页</button><button class="primary-button" @click="copyShareLink"><Icon name="link"/> 复制分享链接</button></div><h3>接入 Unreal Engine</h3><p class="settings-copy">填入已部署的 Pixel Streaming 播放器页面地址，将虚幻引擎画面嵌入大屏中央。两侧业务面板保留，光照与天气需在虚幻项目内实现并控制。</p><label for="stream-url">Pixel Streaming 播放器 URL</label><input id="stream-url" v-model="streamInput" type="url" placeholder="https://your-streaming-server/player.html"/><p v-if="streamError" class="input-error">{{ streamError }}</p><p class="modal-note">服务端需要允许 iframe 嵌入，并配置可用的信令与 WebRTC 网络。此项目不包含 UE 工程或 GPU 串流服务器。</p><div class="settings-actions"><button class="secondary-button" @click="useLocal">使用本地场景</button><button class="primary-button" @click="connectStream"><Icon name="link"/> 连接播放器</button></div></section></div>
    </LayoutRenderer>

    <AiConsole v-if="showAi" :spec="spec" :can-undo="aiHistory.length>0" @apply="applySpecPatch" @undo="undoSpec" @close="showAi=false" />
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '../widgets/Icon.vue';
import { registries, initialSiteId } from '../registries';
import { createSceneHost } from '../scene/SceneHost.js';
import { createDataContext, provideDataContext } from '../data/dataContext.js';
import { createIocContext, provideIocContext } from '../core/context.js';
import { resolveSpec } from '../core/resolve.js';
import { applyTheme } from '../theme/applyTheme.js';
import { readSpecOverrides, saveDraft } from '../core/presets.js';
import { readJson, writeJson, readRaw, writeRaw, migrateKey, siteKey, LAST_SITE_KEY, LEGACY_ALARM_KEY } from '../core/storage.js';
import { shareUrl, compactSpec } from '../core/spec/serialize.js';
import { applyPatch } from '../core/spec/patch.js';
import AiConsole from '../ai/AiConsole.vue';
import LayoutRenderer from '../renderer/LayoutRenderer.vue';
import ScenarioRing from '../components/ioc/ScenarioRing.vue';
import TechArchitecture from '../components/ioc/TechArchitecture.vue';
import CoverPage from '../components/ioc/CoverPage.vue';
import ProjectTimeline from '../components/ioc/ProjectTimeline.vue';
import SystemTopology from '../components/ioc/SystemTopology.vue';
import DeviceMap from '../components/ioc/DeviceMap.vue';
import DevicePhotos from '../components/ioc/DevicePhotos.vue';
import ProjectFacts from '../components/ioc/ProjectFacts.vue';
import StrategyEffect from '../components/ioc/StrategyEffect.vue';
import NextSteps from '../components/ioc/NextSteps.vue';
import BuildingCard from '../cards/building/BuildingCard.vue';
import PlanCard from '../cards/plan/PlanCard.vue';
import './ioc.css';

const props = defineProps({
  // 演示模式：外层把「这一页的配置」传进来，页面自己不再显示编辑外壳
  overrides: { type: Object, default: null },
  presentation: { type: Boolean, default: false },
  // 纯白背景。null 表示不由外层控制，沿用页面自己的按钮状态
  studio: { default: null },
  // 演示模式下一份演示就是全部配置，不再读地址栏 / 草稿里的覆盖项
  useStoredOverrides: { type: Boolean, default: true },
  // 演示模式顶部那条标题栏：这一页叫什么，右边写项目名和页码
  heading: { type: String, default: '' },
  headingSub: { type: String, default: '' },
  // 演示模式的自由布局编辑状态（加卡 / 拖位置 / 改大小），大屏不传
  edit: { type: Object, default: null },
  // 页面级覆盖层（场景环之类）。不是卡片，不进区域列表，浮在模型上面。
  overlays: { type: Array, default: () => [] },
});

// 地址栏里带的配置（?spec= 或 ?preset=），优先级高于园区默认值
const specOverrides = ref(props.useStoredOverrides ? readSpecOverrides() : {});
// 两层覆盖：外层传进来的（入口配置 / 演示文稿这一页）垫在下面，
// 地址栏 ?spec= / ?preset= / 搭建页草稿 / AI 改动盖在上面 —— 显式的操作优先。
// 演示模式没有上面那层，所以这一页的配置就是全部。
const mergedOverrides = computed(() => ({ ...(props.overrides || {}), ...specOverrides.value }));

const stage=ref(null),labels=ref([]),snapshots=ref([]),fps=ref(0),sceneError=ref('');
const activeTab=ref((mergedOverrides.value.navigation&&mergedOverrides.value.navigation.active)||'overview'),weather=ref('sunny'),hour=ref(14),showTime=ref(false),showLabels=ref(true),orbiting=ref(false),selectedBuilding=ref(null);
const modal=ref(null),showSettings=ref(false),streamUrl=ref(''),streamInput=ref(''),streamError=ref(''),toast=ref(''),time=ref(''),date=ref('');
const showFloorPicker=ref(false),floorBuilding=ref('A'),exploded=ref(null),studio=ref(false);
const siteId=ref(initialSiteId(mergedOverrides.value.site));
const themeId=ref(registries.themes.has(mergedOverrides.value.theme)?mergedOverrides.value.theme:((registries.sites.get(siteId.value)||{}).defaultTheme||'dark-cyan'));
const site=computed(()=>registries.sites.get(siteId.value));
// 主场景有的是 Vue 组件（室内视图）而不是 WebGL 工厂，那种直接渲染组件、不经过 SceneHost
const mainScene=computed(()=>registries.scenes.get((spec.value.scene&&spec.value.scene.main&&spec.value.scene.main.provider)||site.value.defaultScene));
const componentScene=computed(()=>{const p=mainScene.value;return p&&p.component?p:null;});
// 组件型场景的句柄：读当前机位用
const sceneRef=ref(null);
// 页面覆盖层算出来的房间状态（照明/空调），交给组件型场景上色
const sceneRoomState=ref(null);
function onRoomState(v){sceneRoomState.value=v;}
const siteList=computed(()=>registries.sites.list());
const buildings=computed(()=>site.value.buildings);
const dataContext=createDataContext({site:site.value,registries});
provideDataContext(dataContext);
const readSlot=(slot,params)=>dataContext.read(slot,params);
const scene=ref(null);
// 当前态势也进配置：切换 tab 时重新合成一份
const spec=computed(()=>resolveSpec(site.value,registries,{
 ...mergedOverrides.value,
 navigation:{...(mergedOverrides.value.navigation||{}),active:activeTab.value},
}));
// 主题：令牌写成 CSS 变量挂到 .ioc-shell 上，场景调色板传给三维模型
// 从组件型场景切回 WebGL 时园区没变、站点 watch 不会触发，得手动补挂一次。
// 必须放在 spec 之后 —— watch 建立初值时会立刻求值 componentScene，而它依赖 spec。
watch(componentScene, (now, before) => { if (before && !now) mountCampus(); });
// 这一页配的机位。只比数值，不比对象 —— spec 每次重算都会 clone 出新对象，
// 用对象相等去 watch 的话，切个态势也会把镜头拽回去。
const sceneView=computed(()=>{const main=spec.value.scene&&spec.value.scene.main;return (main&&main.options&&main.options.view)||null;});
const sceneViewKey=computed(()=>{const v=sceneView.value;return v&&Array.isArray(v.position)?v.position.join(',')+'|'+((v.target||[]).join(',')):'';});
watch(sceneViewKey,()=>{const v=sceneView.value;if(v&&scene.value&&scene.value.can('view'))scene.value.view(v);});
const theme=computed(()=>registries.themes.get(themeId.value)||registries.themes.get('dark-cyan'));
const themeList=computed(()=>registries.themes.list());
watch(theme,t=>applyTheme(t),{immediate:true});
// 卡片靠它拿当前园区、当前配置、当前主题和场景句柄
provideIocContext(createIocContext({site,registries,scene,data:dataContext,spec,theme,edit:props.edit}));
// 详情弹窗的静态表格还是要页面自己取
const detailTables=computed(()=>readSlot('detail.tables')||{});
const indoorOverlay=computed(()=>{
 if(!exploded.value||streamUrl.value)return null;
 const entry=site.value.overlays.find(o=>o.trigger.building===exploded.value.id&&o.trigger.floor===exploded.value.floor);
 return entry?registries.scenes.get(entry.provider)||null:null;
});
const canExplode=computed(()=>Boolean(scene.value&&scene.value.can('explodeFloor')));
const canExploreFloors=computed(()=>canExplode.value||site.value.overlays.length>0);
const floorBuildings=computed(()=>{
 const modeled=site.value.modeledFloors;
 if(!modeled)return buildings.value;
 return buildings.value.filter(b=>modeled[b.id]&&modeled[b.id].length);
});
const availableFloors=computed(()=>{
 const modeled=site.value.modeledFloors;
 const floors=modeled&&modeled[floorBuilding.value];
 if(floors)return floors;
 const building=buildings.value.find(b=>b.id===floorBuilding.value);
 return Array.from({length:building?.floors||0},(_,i)=>i+1);
});
let sceneHost,timer,toastTimer;
// 六个态势写在园区文件的 views 里，这里只做投影
const views=computed(()=>spec.value.views||[]);
const tabs=computed(()=>views.value.map(v=>({id:v.id,name:v.name,icon:v.icon})));
const currentView=computed(()=>views.value.find(v=>v.id===activeTab.value)||views.value[0]||{});
// 覆盖层按 kind 找组件；没写 kind 的默认是场景环
const OVERLAY_KINDS={ 'scenario-ring':ScenarioRing, 'tech-architecture':TechArchitecture, 'cover':CoverPage, 'timeline':ProjectTimeline, 'system-topology':SystemTopology, 'device-map':DeviceMap, 'device-photos':DevicePhotos, 'project-facts':ProjectFacts, 'strategy-effect':StrategyEffect, 'next-steps':NextSteps };
const overlayFor=overlay=>OVERLAY_KINDS[(overlay&&overlay.kind)||'scenario-ring']||ScenarioRing;
// 不是配置、而是运行时才有状态的，按卡片实例名传下去
const runtimeProps=computed(()=>({
 environment:{weather:weather.value},
 monitor:{snapshots:snapshots.value},
 alarm:{alarms:alarms.value,pending:pendingAlarms.value,snapshots:snapshots.value},
 traffic:{viewId:activeTab.value},
 // 楼栋档案和楼层平面图的内容是运行时状态，不是配置，所以按实例名传下去
 building:{building:selectedBuilding.value},
 plan:{floor:exploded.value},
}));
const weatherOptions=[{id:'sunny',label:'晴天',icon:'sun'},{id:'cloudy',label:'多云',icon:'cloud'},{id:'rain',label:'雨天',icon:'rain'},{id:'snow',label:'雪天',icon:'snow'},{id:'fog',label:'雾天',icon:'fog'}];
const weatherName=computed(()=>weatherOptions.find(w=>w.id===weather.value).label),weatherIcon=computed(()=>weatherOptions.find(w=>w.id===weather.value).icon);
const temperature=computed(()=>weather.value==='snow'?'-2':weather.value==='rain'?'23':hour.value>19?'22':'26');


// 趋势线（viewFlow）和能耗曲线（energy）都从数据槽取，见上面
watch([streamUrl,exploded],()=>scene.value?.pause(Boolean(streamUrl.value)||Boolean(indoorOverlay.value)));
// 告警的「已处理」按园区分开存，否则两个园区会互相覆盖
function alarmKey(){return siteKey(siteId.value,'resolved-alarms');}
function savedAlarms(){const key=alarmKey();migrateKey(LEGACY_ALARM_KEY,key);const value=readJson(key,[]);return Array.isArray(value)?value:[];}
const alarms=ref([]);
function refreshAlarms(){const resolved=savedAlarms();alarms.value=(readSlot('alarm.list')||[]).map(a=>({...a,resolved:resolved.includes(a.id)}));}
const pendingAlarms=computed(()=>alarms.value.filter(a=>!a.resolved).length);
function updateClock(){const now=new Date();time.value=now.toLocaleTimeString('zh-CN',{hour12:false});date.value=now.toLocaleDateString('sv-SE');}
function notify(message){toast.value=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',2700);}
function selectTab(id){activeTab.value=id;selectedBuilding.value=null;const mode=views.value.find(v=>v.id===id)?.sceneMode;if(mode&&scene.value?.can('mode'))scene.value.mode(mode);}
function focusBuilding(id){orbiting.value=false;if(exploded.value&&exploded.value.id!==id)exploded.value=null;scene.value?.focus(id);}
function resetView(){scene.value?.reset();selectedBuilding.value=null;exploded.value=null;orbiting.value=false;}
function toggleFloorPicker(){if(!floorBuildings.value.some(b=>b.id===floorBuilding.value))floorBuilding.value=floorBuildings.value[0]?.id||'';showFloorPicker.value=!showFloorPicker.value;}
function pickFloor(f){if(streamUrl.value||!availableFloors.value.includes(f))return;if(canExplode.value)scene.value?.explodeFloor(floorBuilding.value,f);exploded.value={id:floorBuilding.value,floor:f};showFloorPicker.value=false;}
function closeFloorPlan(){if(canExplode.value)scene.value?.closeFloor();exploded.value=null;}
function topView(){scene.value?.top();orbiting.value=false;}
function toggleOrbit(){orbiting.value=!orbiting.value;scene.value?.orbit(orbiting.value);}
const canStudio=computed(()=>Boolean(scene.value&&scene.value.can('studio')));
function toggleStudio(){studio.value=!studio.value;scene.value?.studio(studio.value);notify(studio.value?'已切到纯白背景，适合 PPT 展示':'已恢复场景背景');}
function applyEnvironment(){scene.value?.environment(weather.value,hour.value);}
function setWeather(value){weather.value=value;applyEnvironment();}
function setHour(value){hour.value=value;applyEnvironment();}
function openMonitor(index,title){modal.value={type:'monitor',index,title:title||'监控预览'};}
function refreshSnapshots(){scene.value?.snapshots();notify('已更新三维场景快照');}
function openAlarm(alarm){modal.value={type:'alarm',title:'视频事件详情',alarm};}
function resolveAlarm(alarm){alarm.resolved=true;writeJson(alarmKey(),alarms.value.filter(a=>a.resolved).map(a=>a.id));notify('事件已确认，处理状态已更新');}
function openDetails(type){
 // 三张表依赖当前园区、楼栋和告警状态，所以在这里即时算
 const dynamic={
  park:['园区建筑档案',site.value.description,buildings.value.map(b=>[b.name,b.area+' m²',b.floors+' 层'])],
  building:['楼栋运行信息','当前楼栋设备与空间资源。',selectedBuilding.value?[[selectedBuilding.value.name,selectedBuilding.value.area+' m²','建筑面积'],['当前在园',selectedBuilding.value.people+' 人','模拟数据'],['接入设备',selectedBuilding.value.equipment+' 台','模拟数据'],['运行状态','正常','演示状态']]:[]],
  alerts:['视频报警事件','点击左侧单条告警，可查看并处理事件。',alarms.value.map(a=>[a.location,a.description,a.resolved?'已处理':'待处理'])],
 };
 const tables=detailTables.value,meta=views.value.find(v=>v.id===type);
 const d=dynamic[type]||tables[type]||(meta?[meta.title,meta.description,meta.metrics.map(m=>[m.label,m.value,'模拟数据'])]:dynamic.park);
 openRows.value={};
 modal.value={type:'details',title:d[0],description:d[1],rows:d[2]};
 }
 // 明细行第三层：楼栋那一行可以展开出楼层和房间名
 const openRows=ref({});
 function toggleRow(k){openRows.value={...openRows.value,[k]:!openRows.value[k]};}
 // 展开出来的第三层：把「1F：名称、名称…」这种字符串拆成表格行。
 // 数量优先取父行的 note（形如 "1F 14 · 2F 18"），名称过长被截断时标出来。
 function kidsTable(row){
  const counts={};
  for(const part of String(row[2]||'').split('·')){
   const m=part.trim().match(/^(\S+)\s+(\d+)$/);
   if(m)counts[m[1]]=Number(m[2]);
  }
  return (row[3]||[]).map(s=>{
   const str=String(s);
   const i=str.indexOf('：');
   const floor=i>=0?str.slice(0,i):str;
   const rest=i>=0?str.slice(i+1):'';
   const clipped=rest.endsWith('…');
   const names=rest.replace(/…$/,'').split('、').filter(Boolean);
   return { floor, names, clipped, count: counts[floor]!=null?counts[floor]:names.length };
  });
 }
function connectStream(){
 try{const url=new URL(streamInput.value.trim());if(!['http:','https:'].includes(url.protocol))throw new Error();if(location.protocol==='https:'&&url.protocol==='http:'){streamError.value='HTTPS 页面需要使用 HTTPS 播放器地址。';return;}streamUrl.value=url.href;showSettings.value=false;showTime.value=false;streamError.value='';notify('已嵌入播放器，请确认串流服务已启动');}catch{streamError.value='请输入有效的 HTTP 或 HTTPS 播放器地址。';}
}
function useLocal(){streamUrl.value='';showSettings.value=false;notify('已切换至本地三维场景');}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('当前浏览器不支持全屏显示');}}
function reload(){location.reload();}
function onKey(e){if(e.key==='Escape'){if(showAi.value){showAi.value=false;return;}if(exploded.value){closeFloorPlan();return;}if(showFloorPicker.value){showFloorPicker.value=false;return;}modal.value=null;showSettings.value=false;showTime.value=false;selectedBuilding.value=null;}}
function mountCampus(){
 document.title=site.value.name+' · IOC 数字孪生';
 if(sceneHost){sceneHost.dispose();sceneHost=null;}
 scene.value=null;labels.value=[];snapshots.value=[];sceneError.value='';
 selectedBuilding.value=null;exploded.value=null;showFloorPicker.value=false;orbiting.value=false;modal.value=null;
 floorBuilding.value=floorBuildings.value[0]?.id||'';
 dataContext.useSite(site.value);refreshAlarms();
 if(componentScene.value){sceneError.value='';document.title=site.value.name+' · IOC 数字孪生';return;}
 const provider=registries.scenes.get(site.value.defaultScene);
 if(!provider){sceneError.value='找不到场景模型：'+site.value.defaultScene;return;}
 try{
  sceneHost=createSceneHost(provider,stage.value,{theme:theme.value});
  sceneHost.on('labels',v=>{labels.value=v;});
  sceneHost.on('stats',v=>{fps.value=v;});
  sceneHost.on('select',v=>{selectedBuilding.value=v;});
  sceneHost.on('snapshots',v=>{snapshots.value=v;});
  sceneHost.on('mode',id=>{const view=views.value.find(v=>v.sceneMode===id);if(view)activeTab.value=view.id;});
  scene.value=sceneHost;
  applyEnvironment();
  sceneHost.pause(Boolean(streamUrl.value));
  sceneHost.studio?.(studio.value);
  // 这一页配了机位就飞过去，没配就停在模型自己的初始视角
  const configured=sceneView.value;
  if(configured&&sceneHost.can('view'))sceneHost.view(configured);
  const mode=views.value.find(v=>v.id===activeTab.value)?.sceneMode;
  if(mode&&sceneHost.can('mode'))sceneHost.mode(mode);
 }catch(e){sceneError.value=e.message;console.error(e);}
}
function switchModel(id){
 if(!registries.sites.has(id)||id===siteId.value)return;
 siteId.value=id;activeTab.value=site.value.defaultView||'overview';streamUrl.value='';themeId.value=site.value.defaultTheme||themeId.value;mountCampus();
 writeRaw(LAST_SITE_KEY,id);
 const url=new URL(location.href);if(/^\/[^/]+\/ioc\/?$/.test(url.pathname))url.pathname='/'+id+'/ioc';url.searchParams.set('model',id);history.replaceState(history.state,'',url);
 notify('已切换至'+site.value.name);
}
function switchTheme(id){
 if(!registries.themes.has(id)||id===themeId.value)return;
 themeId.value=id;applyTheme(theme.value);mountCampus();
 notify('已切换至'+theme.value.name+'主题');
}
const showAi=ref(false);
const aiHistory=ref([]);
// 覆盖项一变，园区/主题/当前态势都要跟着重新对一遍
// （主题可能没写在覆盖项里，那时要回落到园区的默认主题）
function syncFromOverrides(overrides){
 const nextSite=registries.sites.has(overrides.site)?overrides.site:siteId.value;
 const fallback=(registries.sites.get(nextSite)||{}).defaultTheme||'dark-cyan';
 const nextTheme=registries.themes.has(overrides.theme)?overrides.theme:fallback;
 // 园区或主题变了要把三维场景整个重建，只换态势则不用
 const changed=nextSite!==siteId.value||nextTheme!==themeId.value;
 siteId.value=nextSite;
 themeId.value=nextTheme;
 if(overrides.navigation&&overrides.navigation.active)activeTab.value=overrides.navigation.active;
 if(changed&&stage.value)mountCampus();
}
// 换页：外层把新的一页传进来，园区、主题、态势、白底跟着这一页走
watch(()=>props.overrides,next=>{if(next)syncFromOverrides({...(next||{}),...specOverrides.value});},{deep:true});
watch(()=>props.studio,next=>{if(next===null||next===undefined||next===studio.value)return;studio.value=next;scene.value?.studio(next);},{immediate:true});
function applySpecPatch(ops){
 const next=applyPatch(spec.value,ops);
 const base=resolveSpec(registries.sites.get(next.site),registries,{});
 aiHistory.value.push(JSON.parse(JSON.stringify(specOverrides.value)));
 specOverrides.value=compactSpec(next,base);
 saveDraft(specOverrides.value);
 syncFromOverrides(specOverrides.value);
 notify('已应用 AI 改动');
}
function undoSpec(){
 const previous=aiHistory.value.pop();
 if(previous===undefined)return;
 specOverrides.value=previous;
 saveDraft(previous);
 syncFromOverrides(previous);
 notify('已撤销上一次 AI 改动');
}
function openStudio(){location.href='/ioc/studio';}
// 演示模式要有对应的项目才进得去，这里按「哪个项目是演示模式」找，不写死名字
const deckProject=computed(()=>registries.projects.list().find(p=>p.mode==='deck'&&(p.slides||[]).length)||null);
function openDeck(){const p=deckProject.value;if(p)location.href='/ioc/deck?project='+encodeURIComponent(p.id);}
async function copyShareLink(){
 const link=shareUrl(spec.value,location.origin+'/ioc/dashboard');
 try{await navigator.clipboard.writeText(link);notify('分享链接已复制');}
 catch(error){notify('复制失败，可手动复制地址栏');}
}
// 演示模式要读当前机位，才能把「拖好的这一页」存下来
defineExpose({currentView:()=>{
 if(sceneRef.value&&typeof sceneRef.value.currentView==='function')return sceneRef.value.currentView();
 return (scene.value&&scene.value.can('view'))?scene.value.view():null;
}});
onMounted(()=>{updateClock();timer=setInterval(updateClock,1000);document.addEventListener('keydown',onKey);mountCampus();});
onBeforeUnmount(()=>{clearInterval(timer);clearTimeout(toastTimer);document.removeEventListener('keydown',onKey);if(sceneHost){sceneHost.dispose();sceneHost=null;}scene.value=null;});
</script>
