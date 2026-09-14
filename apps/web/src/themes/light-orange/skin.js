/**
 * 浅色模板的皮肤样式。
 *
 * 为什么是 .js 而不是 .css：scripts/smoke-check.mjs 在 Node 里跑，会顺着
 * registries -> themes -> 这里一路 import 进来，而 Vite 的 ?inline / ?raw 后缀
 * Node 不认。写成导出字符串的 .js，Vite 和 Node 都能用。
 */
export default `/* 浅色模板的皮肤。
 *
 * 默认那套（深色）的面板是半透明浮在三维场景上的；这套要变成
 * 「浅灰画布 + 白色圆角卡片」，属于形状上的差别，用 CSS 变量表达不了，
 * 所以单独写一张。只覆盖需要改的规则，没写到的仍走 ioc.css。
 */

/* ---- 外壳 ---- */
.ioc-shell{background:#eef1f4}
.ioc-header{background:#fff;border-bottom-color:#e9ecef;box-shadow:0 1px 2px #1018280f}
.ioc-header:after{background:linear-gradient(90deg,#f97316,#fdba74,transparent)}
.ioc-brand h1{color:#1f2329;text-shadow:none}
.ioc-brand>div>span{color:#a3a8b0}
.brand-symbol i{background:linear-gradient(#fdba74,#f97316)}
.header-clock strong{color:#1f2329}
.header-clock>span{color:#a3a8b0}
.header-status>svg{color:#646a73}
.header-weather b{color:#646a73}
.header-weather small{color:#a3a8b0}

/* 顶部导航做成胶囊 */
.ioc-header nav{gap:6px;align-items:center}
.ioc-header nav button{color:#646a73;border-radius:6px;min-width:0;padding:0 16px;height:32px;align-self:center}
.ioc-header nav button svg{opacity:.75}
.ioc-header nav button:before{display:none}
.ioc-header nav button.active{color:#f97316;background:#fff3e8}
.ioc-header nav button.active i{display:none}
.ioc-header nav button:hover{color:#1f2329;background:#f2f4f7}

/* ---- 面板：白色圆角卡片 ---- */
.ioc-panel:after{display:none}
.panel-body{background:#fff;border:1px solid #e9ecef!important;border-radius:10px;box-shadow:0 1px 3px #1018280f}
.panel-heading{border-bottom-color:#eef0f2;background:transparent;color:#1f2329}
.panel-heading:after{background:linear-gradient(90deg,#f97316,#fdba74,transparent)}
.panel-heading>svg{color:#f97316;filter:none}
.panel-heading>small{color:#a3a8b0}
.panel-heading>button svg{color:#8a9099}
.panel-foot{color:#8a9099}
.panel-foot b{color:#646a73}
.panel-foot .live-dot{background:#22c55e;box-shadow:none}

/* ---- 指标磁贴 ---- */
.area-metric,.floor-metric{background:#f7f9fb;border-color:#eef0f2}
.area-metric:before,.floor-metric:before{background:linear-gradient(90deg,transparent,#f97316,transparent)}
.area-metric>span,.area-metric>span small{color:#8a9099}
.area-metric strong{color:#1f2329;text-shadow:none}
.area-metric strong em{color:#f97316}
.metric-baseline{background:linear-gradient(90deg,#f97316,transparent)}
.floor-metric strong{color:#1f2329}
.floor-metric span{color:#8a9099}

/* ---- 空间指标 ---- */
.space-column button{border-bottom-color:#eef0f2}
.space-column strong{color:#1f2329}
.space-column span{color:#646a73}
.space-column small{color:#a3a8b0}
.space-column button:hover strong{color:#f97316}
.space-orbit{border-color:#e9ecef!important;background:radial-gradient(circle,#fff7ed 20%,#fff 60%)!important;box-shadow:0 0 0 6px #f9731614}
.space-orbit>span{border-color:#f9731633}
.space-orbit:after{border-color:#fdba74;border-bottom-color:transparent}
.space-orbit svg{color:#f97316}
.space-orbit b{color:#1f2329}

/* ---- 办公环境 ---- */
.quality-tag{color:#16a34a;border-color:#86efac;background:#f0fdf4}
.environment-metrics>div+div:before{background:linear-gradient(transparent,#e9ecef,transparent)}
.environment-metrics svg{color:#f97316}
.environment-metrics span,.environment-metrics small{color:#8a9099}
.environment-metrics strong{color:#1f2329;text-shadow:none}

/* ---- 监控 ---- */
.tiny-online{color:#16a34a}
.monitor-grid>button{border-color:#e9ecef;background:#f7f9fb}
.camera-id{background:#1f2329cc}
.camera-id i{background:#22c55e}
.camera-caption{background:linear-gradient(transparent,#1f2329e6)}
.camera-caption svg{color:#fff}
.monitor-play{background:#ffffffd9;color:#1f2329}
.monitor-play svg{color:#1f2329}

/* ---- 告警列表 ---- */
.alarm-count{color:#ea580c;border-color:#fdba74;background:#fff7ed}
.alert-row{border-bottom-color:#eef0f2!important}
.alert-row:hover{background:#f7f9fb}
.alert-thumb{border-color:#e9ecef;background:#f2f4f7}
.alert-thumb svg{color:#8a9099}
.alert-title b{color:#1f2329}
.alert-title time{color:#a3a8b0}
.alert-row p{color:#646a73}
.alert-level{color:#ea580c;background:#fff7ed}
.resolved-tag{color:#16a34a}
.alert-row.resolved .alert-thumb{background:#f0fdf4}
.all-alerts{color:#f97316!important;background:#fff!important;border-color:#fdba74!important}

/* ---- 环形图 ---- */
.donut .ring-track{stroke:#eef0f2}
.donut:after,.parking-donut:after{border-color:#eef0f2}
.donut strong{color:#1f2329;text-shadow:none}
.donut strong em{color:#f97316}
.donut>div>span{color:#8a9099}
.people-donut circle:nth-child(2){stroke:#22c55e}
.people-donut circle:nth-child(3){stroke:#f97316}
.parking-donut circle:nth-child(2){stroke:#14b8a6}
.parking-donut circle:nth-child(3){stroke:#f59e0b}
.donut-legend span{color:#646a73}
.donut-legend b{color:#1f2329}
.donut-legend small{color:#a3a8b0}
.donut-legend>p,.donut-legend p.parking-total{color:#8a9099}
.donut-legend p b{color:#1f2329}
.donut-legend i.blue{background:#f97316}
.donut-legend i.orange{background:#14b8a6}
.donut-legend i.green{background:#22c55e}

/* ---- 曲线与能耗 ---- */
.chart-legend span{color:#646a73}
.ioc-chart text{fill:#8a9099}
.ioc-chart .unit{fill:#a3a8b0}
.grid-line{stroke:#dfe3e8}
.energy-summary>span:first-child{color:#646a73}
.energy-summary strong{color:#1f2329}
.energy-summary em{color:#f97316}
.energy-saving{color:#16a34a}
.energy-saving small{color:#a3a8b0}

/* ---- 状态标签 ---- */
.good-pill,.warn-pill{background:#f0fdf4;border-color:#86efac;color:#16a34a}
.warn-pill{background:#fff7ed;border-color:#fdba74;color:#ea580c}

/* ---- 详情表与弹窗 ---- */
.ioc-modal-overlay{background:#10182866}
.ioc-modal{background:#fff;border:1px solid #e9ecef;box-shadow:0 20px 40px #1018281f}
.modal-heading h2,.ioc-modal h3{color:#1f2329}
.modal-description,.modal-note{color:#646a73}
.eyebrow{color:#f97316}
.detail-table{border-color:#eef0f2}
.detail-table>div+div{border-top-color:#eef0f2}
.detail-table>div:nth-child(odd){background:#f7f9fb}
.detail-table span{color:#646a73}
.detail-table strong{color:#1f2329}
.detail-table small{color:#a3a8b0}
.alarm-detail dt{color:#8a9099}
.alarm-detail dd{color:#1f2329}
.monitor-large{background:#111827;border-color:#e9ecef}
.input-error{color:#dc2626}
.secondary-button{background:#f7f9fb!important;border-color:#e9ecef!important;color:#646a73!important}
.secondary-button:hover{background:#f2f4f7!important}
.ioc-modal input,.campus-model-select{background:#fff!important;border-color:#d0d5dd!important;color:#1f2329!important}

/* ---- 楼栋卡 / 专题卡 ---- */
.building-card,.domain-card,.floor-plan-card{background:#fff;border-color:#e9ecef;box-shadow:0 8px 24px #10182814}
.building-card h2,.domain-card b,.floor-plan-card h2{color:#1f2329}
.building-status{color:#16a34a}
.building-stats b{color:#1f2329}
.building-stats span{color:#8a9099}
.building-card>p{color:#646a73}
.building-card>p strong{color:#1f2329}
.detail-link{color:#f97316!important}
.domain-card>div:first-child{color:#8a9099}
.domain-card>div:first-child>span{color:#f97316;border-color:#fdba74}
.domain-card>p{color:#646a73}
.domain-metrics strong{color:#1f2329}
.domain-metrics span{color:#8a9099}
.domain-card>button{color:#f97316}
.card-close{color:#8a9099!important}

/* ---- 三维场景上的浮层 ---- */
.scene-heading{color:#1f2329;text-shadow:none}
.scene-heading small{color:#8a9099}
.scene-heading-line{background:#c9d1d9}
.scene-engine{color:#1f2329;text-shadow:none}
.scene-tools>button{background:#fff;border-color:#e9ecef;box-shadow:0 1px 3px #1018280f;color:#646a73}
.scene-tools>button:hover{background:#f7f9fb}
.scene-tools>button.active{color:#f97316;background:#fff3e8;border-color:#fdba74}
.scene-toolbar{background:#fff;border-color:#e9ecef;box-shadow:0 4px 16px #10182814}
.scene-toolbar button{color:#646a73}
.scene-toolbar button:hover{color:#1f2329;background:#f7f9fb}
.scene-toolbar button.active{color:#f97316;background:#fff3e8}
.scene-toolbar .toolbar-divider{background:#e9ecef}
.building-marker>span{color:#1f2329;text-shadow:none;background:linear-gradient(90deg,transparent,#ffffffcc,transparent)}
.building-marker>div{background:linear-gradient(145deg,#ffffff,#f97316)}
.building-marker svg{color:#fff;filter:none}
.building-marker>i{background:linear-gradient(#f97316,transparent)}
.building-marker:hover>div,.building-marker.selected>div{background:#f97316}

/* ---- 楼层选择器 ---- */
.floor-picker{background:#fff;border-color:#e9ecef;box-shadow:0 8px 24px #10182814}
.floor-picker .panel-heading{border-bottom-color:#eef0f2}
.floor-building-switch button,.floor-grid button{color:#646a73;border-color:#e9ecef;background:#f7f9fb}
.floor-building-switch button.active,.floor-grid button.active{color:#f97316;background:#fff3e8;border-color:#fdba74}
.floor-grid button:hover{color:#1f2329;background:#f2f4f7}
.picker-current{color:#f97316;border-color:#fdba74;background:#fff7ed}
.floor-picker-foot{color:#8a9099;border-top-color:#eef0f2}

/* ---- 楼层平面图 ---- */
.plan-svg{background:#f7f9fb;border-color:#e9ecef}
.plan-wall{stroke:#c9d1d9}
.plan-core{fill:#e9ecef;stroke:#c9d1d9}
.plan-rooms rect{fill:#fff;stroke:#dfe3e8}
.plan-rooms rect:nth-child(even){fill:#f7f9fb}
.plan-corridors path{stroke:#e9ecef}
.plan-label{fill:#8a9099}
.plan-tooltip{background:#fff;border-color:#e9ecef;box-shadow:0 4px 16px #1018281f}
.plan-tooltip b{color:#1f2329}
.plan-tooltip small{color:#8a9099}
.plan-legend{color:#8a9099}

/* ---- 底栏与其他 ---- */
.ioc-footer{background:#fff;border-top-color:#e9ecef;color:#8a9099}
.ioc-footer>span:last-child{color:#a3a8b0}
.ioc-footer .live-dot{background:#22c55e;box-shadow:none}
.ioc-toast{background:#fff;border-color:#e9ecef;color:#1f2329;box-shadow:0 8px 24px #1018281f}
.ioc-toast svg{color:#22c55e}
.time-popover{background:#fff;border-color:#e9ecef;box-shadow:0 8px 24px #10182814}
.time-popover span{color:#8a9099}
.time-popover b{color:#1f2329}
.time-presets button{color:#646a73;border-color:#e9ecef;background:#f7f9fb}
.time-presets button:hover{color:#f97316;background:#fff3e8}
.scene-error{background:#fff;border-color:#e9ecef;color:#1f2329}
.ai-console{background:#fff;border-left-color:#e9ecef}
.ai-entry.assistant p{background:#f7f9fb}
.ai-input input{background:#f7f9fb;border-color:#e9ecef;color:#1f2329}`;
