# apps/web 已冻结

决策：`docs/design/DECISIONS.md` D14（2026-09-24）。

- 这个目录是 `buildingos.ioc` 前端的一份副本（`src/core/spec/validate.js`、`src/scene/SceneHost.js`、`src/scene/createSmartCampus.js` 等与 ioc 逐字节相同）。
- **IOC 前端唯一来源是 buildingos.ioc**。这里只允许修复性改动；新功能一律在 ioc 做。
- 唯一的 netops 专有部分是 `src/components/HealthCheck.vue`（网络健康体检，在 `App.vue` 里全局挂载）。它会在 ioc 的 P7a 迁移为「网络治理」项目模板中的组件，届时整个 `apps/web` 删除。
- `deploy/v3-frozen/docker-compose.yml` 仍引用 `../apps/web`，随 v3-frozen 一起标记为 legacy。
