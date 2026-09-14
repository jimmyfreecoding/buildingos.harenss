<template>
  <aside class="ai-console" aria-label="AI 编排">
    <header class="ai-head">
      <div><h2>AI 编排</h2><small>{{ modeLabel }}</small></div>
      <button class="ai-close" aria-label="关闭 AI 编排" @click="emit('close')">×</button>
    </header>

    <div class="ai-log">
      <p v-if="!entries.length" class="ai-hint">用一句话描述想要的界面，比如「左边放监控和告警，右边放能耗和人员，用深色主题，接 Smart 园区」。改动会先给你确认再应用。</p>
      <div v-for="(entry, index) in entries" :key="index" class="ai-entry" :class="entry.role">
        <p>{{ entry.text }}</p>
      </div>
      <p v-if="busy" class="ai-hint">正在理解…</p>
    </div>

    <section v-if="pending" class="ai-preview">
      <h3 v-if="pending.errors.length">这批改动不能应用</h3>
      <h3 v-else>将要应用 {{ pending.ops.length }} 处改动</h3>
      <ul v-if="!pending.errors.length">
        <li v-for="(line, index) in pending.descriptions" :key="index">{{ line }}</li>
      </ul>
      <ul v-else class="ai-errors">
        <li v-for="(line, index) in pending.errors" :key="index">{{ line }}</li>
      </ul>
      <div class="ai-preview-actions">
        <button class="ghost" @click="cancel">取消</button>
        <button class="primary" :disabled="pending.errors.length > 0" @click="apply">应用</button>
      </div>
    </section>

    <form class="ai-input" @submit.prevent="send">
      <input v-model="text" placeholder="说一句话，比如：右边放能耗和人员" :disabled="busy" aria-label="给 AI 的指令" />
      <button v-if="voiceSupported" type="button" class="ghost" :class="{ listening }" :disabled="busy" @click="toggleVoice">{{ listening ? '听取中…' : '语音' }}</button>
      <button type="submit" class="primary" :disabled="busy || !text.trim()">发送</button>
    </form>

    <footer class="ai-foot">
      <button class="ghost" :disabled="!canUndo" @click="emit('undo')">撤销上一次</button>
      <span>AI 只能改配置，不能改代码</span>
    </footer>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { registries } from '../registries';
import { createOrchestrator } from './orchestrator.js';
import { sanitizeOps } from './sanitize.js';
import { describePatch } from '../core/spec/patch.js';
import { createRecognizer, speechSupported } from './voice/recognizer.js';

const props = defineProps({
  spec: { type: Object, required: true },
  canUndo: { type: Boolean, default: false },
  // 留空就是规则模式；填了就 POST 到自己服务器的代理
  endpoint: { type: String, default: '' },
});
const emit = defineEmits(['apply', 'undo', 'close']);

const text = ref('');
const busy = ref(false);
const listening = ref(false);
const entries = ref([]);
const pending = ref(null);

const orchestrator = createOrchestrator({ registries, endpoint: props.endpoint });
const modeLabel = computed(() => (orchestrator.mode === 'remote' ? '远端模型' : '关键词规则（未接后端）'));

const voiceSupported = speechSupported();
const recognizer = createRecognizer({
  onResult(value) { text.value = value; listening.value = false; send(); },
  onError() { listening.value = false; },
  onEnd() { listening.value = false; },
});

function toggleVoice() {
  if (!recognizer) return;
  if (listening.value) { recognizer.stop(); listening.value = false; return; }
  listening.value = true;
  if (!recognizer.start()) listening.value = false;
}

function cardName(id) {
  const instance = (props.spec.cards || {})[id];
  const definition = instance ? registries.cards.get(instance.type) : null;
  return definition ? definition.name : id;
}
function regionName(id) {
  const layout = registries.layouts.get(props.spec.layout);
  const region = layout ? layout.regions.find(item => item.id === id) : null;
  return region && region.label ? region.label : id;
}
function viewName(index) {
  const view = (props.spec.views || [])[index];
  return view ? view.name : '#' + index;
}

async function send() {
  const message = text.value.trim();
  if (!message || busy.value) return;
  entries.value.push({ role: 'user', text: message });
  text.value = '';
  busy.value = true;
  try {
    const result = await orchestrator.propose(message, props.spec);
    if (result.warning) entries.value.push({ role: 'system', text: result.warning });
    entries.value.push({ role: 'assistant', text: result.reply });
    if (!result.ops.length) { pending.value = null; return; }
    const checked = sanitizeOps(result.ops, { registries, spec: props.spec });
    pending.value = {
      ops: checked.ops,
      errors: checked.errors,
      descriptions: checked.ok
        ? describePatch(checked.ops, { card: cardName, region: regionName, view: viewName })
        : [],
    };
  } catch (error) {
    entries.value.push({ role: 'system', text: '出错了：' + error.message });
  } finally {
    busy.value = false;
  }
}

function cancel() {
  pending.value = null;
  entries.value.push({ role: 'system', text: '已取消这次改动。' });
}

function apply() {
  if (!pending.value || pending.value.errors.length) return;
  emit('apply', pending.value.ops);
  entries.value.push({ role: 'system', text: '已应用 ' + pending.value.ops.length + ' 处改动。' });
  pending.value = null;
}
</script>

<style scoped>
.ai-console{position:absolute;z-index:60;top:66px;right:0;bottom:30px;width:clamp(300px,24vw,380px);display:flex;flex-direction:column;background:var(--ioc-card-2,#10273bde);border-left:1px solid var(--ioc-card-line,#aad8ff55);backdrop-filter:blur(18px);color:var(--ioc-text,#e7f3ff);font-size:12px}
.ai-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--ioc-line,rgba(177,214,241,.18))}
.ai-head h2{font-size:14px;margin:0;letter-spacing:1px}
.ai-head small{display:block;margin-top:4px;font-size:10px;color:var(--ioc-text-muted,#93aabe)}
.ai-close{background:none;border:0;color:inherit;font-size:20px;line-height:1;cursor:pointer;padding:0 4px}
.ai-log{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.ai-hint{color:var(--ioc-text-muted,#93aabe);font-size:11px;line-height:1.7;margin:0}
.ai-entry p{margin:0;padding:8px 11px;border-radius:5px;line-height:1.6}
.ai-entry.user p{background:var(--ioc-tool-active-bg,#3574a4ad)}
.ai-entry.assistant p{background:#00000038}
.ai-entry.system p{border-left:2px solid var(--ioc-warning,#ffcf87);color:var(--ioc-text-muted,#93aabe);padding-left:9px}
.ai-preview{padding:12px 16px;border-top:1px solid var(--ioc-line,rgba(177,214,241,.18))}
.ai-preview h3{font-size:12px;margin:0 0 8px}
.ai-preview ul{margin:0;padding-left:18px;line-height:1.8;color:var(--ioc-text-dim,#a2bccb)}
.ai-errors{color:var(--ioc-danger,#ff947b)!important}
.ai-preview-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
.ai-console button{font:inherit;cursor:pointer;border-radius:4px;border:1px solid var(--ioc-tool-line,#b6dcff47);background:var(--ioc-tool-bg,#18334ac9);color:inherit;padding:6px 12px}
.ai-console button:disabled{opacity:.45;cursor:not-allowed}
.ai-console button.primary{background:var(--ioc-tool-active-bg,#3574a4ad);border-color:var(--ioc-tool-active-line,#a1ddff80)}
.ai-console button.ghost{background:transparent}
.ai-console button.listening{border-color:var(--ioc-danger,#ff947b);color:var(--ioc-danger,#ff947b)}
.ai-input{display:flex;gap:6px;padding:12px 16px;border-top:1px solid var(--ioc-line,rgba(177,214,241,.18))}
.ai-input input{flex:1;min-width:0;font:inherit;background:#0d1b2a99;border:1px solid var(--ioc-tool-line,#b6dcff47);border-radius:4px;color:inherit;padding:7px 10px}
.ai-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 16px;border-top:1px solid var(--ioc-line,rgba(177,214,241,.18))}
.ai-foot span{font-size:10px;color:var(--ioc-text-muted,#93aabe)}
@media(max-width:1000px){.ai-console{top:auto;left:0;right:0;bottom:0;width:auto;height:70vh;border-left:0;border-top:1px solid var(--ioc-card-line,#aad8ff55)}}
</style>
