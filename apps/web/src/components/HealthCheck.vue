<template>
  <div class="hc-root">
    <button class="hc-fab" :class="{ 'is-open': open }" @click="open = !open">
      <Icon name="shield" />
      <span>网络健康体检</span>
    </button>

    <section v-if="open" class="hc-panel">
      <header class="hc-head">
        <h3>网络健康体检</h3>
        <button class="hc-x" @click="open = false" aria-label="关闭"><Icon name="close" /></button>
      </header>

      <!-- 未开始 -->
      <div v-if="state === 'idle'" class="hc-body">
        <p class="hc-lead">
          对当前网络做一次连通性体检：先采集网关延迟与在线主机，
          再交给 AI 分析，给出健康分、问题清单和处理建议。
        </p>
        <button class="hc-go" @click="start">开始体检</button>
      </div>

      <!-- 进行中 -->
      <div v-else-if="state === 'running'" class="hc-body hc-center">
        <div class="hc-spinner"></div>
        <p class="hc-step">{{ progressText }}</p>
        <p class="hc-hint">采集约 20 秒，AI 分析约 20–60 秒</p>
      </div>

      <!-- 出错 -->
      <div v-else-if="state === 'error'" class="hc-body">
        <p class="hc-err">{{ errorMsg }}</p>
        <pre v-if="detail" class="hc-pre">{{ detail }}</pre>
        <button class="hc-go" @click="start">重试</button>
      </div>

      <!-- 结果 -->
      <div v-else class="hc-body">
        <div class="hc-summary-row">
          <div class="hc-score" :data-level="scoreLevel">
            <strong>{{ score }}</strong>
            <span>健康分</span>
          </div>
          <div class="hc-summary-text">
            <p class="hc-conclusion">{{ analysis?.summary || '（AI 未给出结论）' }}</p>
            <p class="hc-meta">{{ facts?.segment }} · {{ facts?.live_hosts }} 台在线 · 用时 {{ (elapsedMs / 1000).toFixed(1) }}s</p>
          </div>
        </div>

        <!-- AI 没吐出结构化结果时的兜底 -->
        <pre v-if="!analysis && analysisRaw" class="hc-pre">{{ analysisRaw }}</pre>

        <template v-if="analysis">
          <h4 v-if="analysis.findings?.length" class="hc-h4">发现的问题</h4>
          <ul class="hc-findings">
            <li v-for="(f, i) in analysis.findings" :key="i" :data-sev="f.severity">
              <em>{{ sevLabel(f.severity) }}</em>
              <div>
                <strong>{{ f.title }}</strong>
                <span>{{ f.detail }}</span>
              </div>
            </li>
          </ul>

          <h4 v-if="analysis.suggestions?.length" class="hc-h4">建议</h4>
          <ol class="hc-suggestions">
            <li v-for="(s, i) in analysis.suggestions" :key="i">{{ s }}</li>
          </ol>
        </template>

        <h4 class="hc-h4">采集到的事实</h4>
        <dl class="hc-facts">
          <div><dt>网段</dt><dd>{{ facts?.segment }}</dd></div>
          <div><dt>网关</dt><dd>{{ facts?.gateway }}</dd></div>
          <div><dt>网关延迟</dt><dd>{{ facts?.gateway_rtt }}</dd></div>
          <div><dt>丢包</dt><dd>{{ facts?.gateway_loss }}</dd></div>
          <div><dt>在线主机</dt><dd>{{ facts?.live_hosts }}</dd></div>
        </dl>
        <p v-if="facts?.host_list?.length" class="hc-hosts">{{ facts.host_list.join('、') }}</p>

        <button class="hc-go hc-again" @click="start">再体检一次</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import Icon from '../widgets/Icon.vue';

const open = ref(false);
const state = ref('idle'); // idle | running | done | error
const progressText = ref('');
const errorMsg = ref('');
const detail = ref('');
const result = ref(null);
let stepTimer = null;

const facts = computed(() => result.value?.facts);
const analysis = computed(() => result.value?.analysis);
const analysisRaw = computed(() => result.value?.analysis_raw);
const elapsedMs = computed(() => result.value?.elapsedMs || 0);

const score = computed(() => analysis.value?.score ?? '—');
const scoreLevel = computed(() => {
  const s = Number(analysis.value?.score);
  if (!Number.isFinite(s)) return 'unknown';
  if (s >= 85) return 'good';
  if (s >= 70) return 'fair';
  return 'poor';
});

const SEV = { p1: '严重', p2: '重要', p3: '一般', info: '提示' };
const sevLabel = (s) => SEV[s] || s || '提示';

function goStep(messages) {
  let i = 0;
  progressText.value = messages[0];
  stepTimer = setInterval(() => {
    i = Math.min(i + 1, messages.length - 1);
    progressText.value = messages[i];
  }, 9000);
}

function stopStep() {
  if (stepTimer) clearInterval(stepTimer);
  stepTimer = null;
}

async function start() {
  state.value = 'running';
  errorMsg.value = '';
  detail.value = '';
  result.value = null;
  goStep(['正在采集网关延迟…', '正在扫描网段…', '正在交给 AI 分析…', 'AI 正在生成结论…']);

  try {
    const res = await fetch('/api/health-check', { method: 'POST' });
    const body = await res.json();
    stopStep();

    if (!res.ok || !body.ok) {
      state.value = 'error';
      errorMsg.value = body.error || `请求失败（HTTP ${res.status}）`;
      detail.value = [body.stderr, body.stdout].filter(Boolean).join('\n').slice(-2000);
      return;
    }
    result.value = body;
    state.value = 'done';
  } catch (err) {
    stopStep();
    state.value = 'error';
    errorMsg.value = '连不上后端服务';
    detail.value = String(err?.message || err) + '\n\n后端起来了吗？ cd apps/api && npm start';
  }
}

onBeforeUnmount(stopStep);
</script>

<style scoped>
.hc-root {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 3000;
  font-family: inherit;
}

/* ── 悬浮按钮 ── */
.hc-fab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: 1px solid rgba(90, 220, 230, 0.5);
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(18, 60, 74, 0.96), rgba(12, 34, 46, 0.96));
  color: #b8f2f7;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  transition: transform 0.15s, border-color 0.15s;
}
.hc-fab:hover { transform: translateY(-2px); border-color: #5adce6; }
.hc-fab.is-open { border-color: #5adce6; color: #eafeff; }
.hc-fab svg { width: 18px; height: 18px; }
.hc-fab span { white-space: nowrap; }

/* ── 面板 ── */
.hc-panel {
  position: absolute;
  right: 0;
  bottom: 60px;
  width: 440px;
  max-height: 72vh;
  display: flex;
  flex-direction: column;
  background: #10161d;
  border: 1px solid rgba(90, 220, 230, 0.28);
  border-radius: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}
.hc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.hc-head h3 { margin: 0; font-size: 15px; color: #d9f6fa; font-weight: 600; }
.hc-x {
  display: flex; padding: 4px; border: 0; border-radius: 6px;
  background: transparent; color: #7d96a3; cursor: pointer;
}
.hc-x:hover { background: rgba(255, 255, 255, 0.06); color: #d9f6fa; }
.hc-x svg { width: 16px; height: 16px; }

.hc-body { padding: 16px 18px 18px; overflow-y: auto; }
.hc-center { text-align: center; padding: 34px 18px; }

.hc-lead { margin: 0 0 16px; font-size: 13px; line-height: 1.7; color: #93a8b5; }

.hc-go {
  width: 100%; padding: 11px; border: 0; border-radius: 9px;
  background: linear-gradient(135deg, #1d8fa3, #17616f);
  color: #eafeff; font-size: 14px; cursor: pointer;
}
.hc-go:hover { filter: brightness(1.12); }
.hc-again { margin-top: 18px; background: rgba(255, 255, 255, 0.07); color: #b8cdd8; }

/* ── 进行中 ── */
.hc-spinner {
  width: 30px; height: 30px; margin: 0 auto 16px;
  border: 2px solid rgba(90, 220, 230, 0.22);
  border-top-color: #5adce6;
  border-radius: 50%;
  animation: hc-spin 0.9s linear infinite;
}
@keyframes hc-spin { to { transform: rotate(360deg); } }
.hc-step { margin: 0 0 6px; font-size: 14px; color: #cfeef4; }
.hc-hint { margin: 0; font-size: 12px; color: #6d8494; }

/* ── 结果 ── */
.hc-summary-row { display: flex; gap: 14px; align-items: center; margin-bottom: 18px; }
.hc-score {
  flex: 0 0 74px; height: 74px; border-radius: 14px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
}
.hc-score strong { font-size: 26px; line-height: 1; }
.hc-score span { margin-top: 4px; font-size: 11px; color: #7d96a3; }
.hc-score[data-level='good'] { border-color: rgba(94, 226, 158, 0.5); }
.hc-score[data-level='good'] strong { color: #5ee29e; }
.hc-score[data-level='fair'] { border-color: rgba(240, 200, 90, 0.5); }
.hc-score[data-level='fair'] strong { color: #f0c85a; }
.hc-score[data-level='poor'] { border-color: rgba(240, 110, 110, 0.5); }
.hc-score[data-level='poor'] strong { color: #f06e6e; }
.hc-score[data-level='unknown'] strong { color: #8fa3b0; }

.hc-summary-text { min-width: 0; }
.hc-conclusion { margin: 0 0 6px; font-size: 13.5px; line-height: 1.6; color: #dcf0f5; }
.hc-meta { margin: 0; font-size: 11.5px; color: #6d8494; }

.hc-h4 {
  margin: 18px 0 9px; font-size: 12px; font-weight: 600;
  color: #7fa8b8; letter-spacing: 0.06em;
}

.hc-findings { margin: 0; padding: 0; list-style: none; }
.hc-findings li {
  display: flex; gap: 10px; padding: 9px 11px; margin-bottom: 7px;
  background: rgba(255, 255, 255, 0.035);
  border-left: 2px solid #5c7787; border-radius: 0 8px 8px 0;
}
.hc-findings li[data-sev='p1'] { border-left-color: #f06e6e; }
.hc-findings li[data-sev='p2'] { border-left-color: #f0a95a; }
.hc-findings li[data-sev='p3'] { border-left-color: #f0c85a; }
.hc-findings li[data-sev='info'] { border-left-color: #5aa8f0; }
.hc-findings em {
  flex: 0 0 auto; font-style: normal; font-size: 11px;
  color: #8fa3b0; padding-top: 2px;
}
.hc-findings strong { display: block; font-size: 13px; color: #dcf0f5; font-weight: 600; }
.hc-findings span { display: block; margin-top: 3px; font-size: 12px; line-height: 1.6; color: #93a8b5; }

.hc-suggestions { margin: 0; padding-left: 20px; }
.hc-suggestions li { margin-bottom: 7px; font-size: 12.5px; line-height: 1.65; color: #c3d7e0; }

.hc-facts { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 7px 14px; }
.hc-facts div { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.hc-facts dt { color: #6d8494; }
.hc-facts dd { margin: 0; color: #c3d7e0; text-align: right; }
.hc-hosts { margin: 9px 0 0; font-size: 11.5px; line-height: 1.7; color: #7d96a3; word-break: break-all; }

.hc-pre {
  margin: 0 0 10px; padding: 11px; border-radius: 8px; max-height: 260px;
  overflow: auto; font-size: 11.5px; line-height: 1.6;
  background: rgba(0, 0, 0, 0.35); color: #a9c2ce; white-space: pre-wrap;
}
.hc-err { margin: 0 0 10px; font-size: 13px; color: #f0a0a0; }
</style>
