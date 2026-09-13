-- NetOps 主数据 schema（PostgreSQL 16）
-- 主键约定：设备身份 = 规范化 MAC（小写、冒号分隔）。IP 会变，MAC 不会。

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 站点与网段 ──────────────────────────────────────────────
CREATE TABLE sites (
  site_id       text PRIMARY KEY,
  name          text NOT NULL,
  timezone      text NOT NULL DEFAULT 'Asia/Shanghai',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE segments (
  segment_id    text PRIMARY KEY,
  site_id       text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  cidr          cidr NOT NULL,
  vlan_id       int,
  gateway_ip    inet,
  purpose       text,
  excluded      boolean NOT NULL DEFAULT false,   -- 虚拟网段排除出扫描
  UNIQUE (site_id, cidr)
);

-- ── 设备 ────────────────────────────────────────────────────
CREATE TABLE devices (
  node_id       text PRIMARY KEY,                  -- 规范化 MAC
  site_id       text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  vendor        text,
  model         text,
  firmware      text,
  role          text,                              -- gateway|ap|switch|nvr|camera|access|iot|client
  governance    smallint NOT NULL DEFAULT 0,       -- L0 在网 / L1 识别 / L2 可读 / L3 可写
  media_type    text,                              -- wired | wifi
  location      jsonb NOT NULL DEFAULT '{}',       -- {floor,room,rack,u,x,y}
  credential_ref text,                             -- 只放引用名，永不存明文
  runbook_id    text,
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  confidence    real,
  notes         text
);
CREATE INDEX ON devices (site_id, role);
CREATE INDEX ON devices (site_id, governance);

CREATE TABLE device_ips (
  node_id       text NOT NULL REFERENCES devices(node_id) ON DELETE CASCADE,
  ip            inet NOT NULL,
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, ip)
);

CREATE TABLE device_services (
  node_id       text NOT NULL REFERENCES devices(node_id) ON DELETE CASCADE,
  port          int NOT NULL,
  proto         text NOT NULL,
  service       text,
  banner        text,
  risk          text,
  PRIMARY KEY (node_id, port, proto)
);

-- ── 链路 ────────────────────────────────────────────────────
CREATE TABLE links (
  link_id       bigserial PRIMARY KEY,
  site_id       text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  a_node        text NOT NULL,
  b_node        text NOT NULL,
  medium        text NOT NULL,                     -- wired | wifi
  band          text,                              -- 2.4GHz | 5GHz
  channel       int,
  a_if          text,
  b_if          text,
  evidence      text[] NOT NULL DEFAULT '{}',      -- lldp|arp|ap-assoc|dhcp
  confidence    real,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, a_node, b_node, medium)
);

-- ── 能力自检（探针与 harness 各一份）────────────────────────
CREATE TABLE capability_checks (
  check_id      bigserial PRIMARY KEY,
  site_id       text NOT NULL,
  subject       text NOT NULL,                     -- probe-01 | harness
  metric        text NOT NULL,
  value         text,
  expected      text,
  verdict       text NOT NULL,                     -- ok | degraded | misconfigured
  checked_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 发现与证据 ──────────────────────────────────────────────
CREATE TABLE findings (
  finding_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       text NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
  category      text NOT NULL,                     -- wireless|wired|cctv|iot|config|security
  severity      text NOT NULL,                     -- p1|p2|p3|info
  title         text NOT NULL,
  root_cause    text,
  confidence    real,
  impact        jsonb NOT NULL DEFAULT '{}',
  actions       jsonb NOT NULL DEFAULT '[]',
  excluded      jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'open',      -- open|acked|fixed|wontfix
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  task_id       uuid                                   -- 产出它的 harness 任务
);
CREATE INDEX ON findings (site_id, status, severity);

CREATE TABLE finding_evidence (
  id            bigserial PRIMARY KEY,
  finding_id    uuid NOT NULL REFERENCES findings(finding_id) ON DELETE CASCADE,
  kind          text NOT NULL,                     -- metric|config|topology|contrast|log
  ref           text NOT NULL,                     -- td://... | pg://... | file://...
  note          text
);

-- ── 变更草案（M0–M2 只到 proposed）──────────────────────────
CREATE TABLE changes (
  change_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       text NOT NULL,
  finding_id    uuid REFERENCES findings(finding_id) ON DELETE SET NULL,
  target_node   text NOT NULL,
  action        text NOT NULL,
  params        jsonb NOT NULL DEFAULT '{}',
  risk          text,
  rollback      text,
  status        text NOT NULL DEFAULT 'proposed',  -- proposed|approved|executing|done|failed|rejected
  proposed_by   text NOT NULL DEFAULT 'harness',
  approved_by   text,
  executed_at   timestamptz,
  verify_result jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 配置快照 ────────────────────────────────────────────────
CREATE TABLE config_snapshots (
  id            bigserial PRIMARY KEY,
  node_id       text NOT NULL,
  source        text NOT NULL,                     -- snmp|ssh|http-api|onvif|manual
  normalized    jsonb NOT NULL,
  hash          text NOT NULL,
  taken_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, hash)
);
CREATE INDEX ON config_snapshots (node_id, taken_at DESC);

-- ── harness 任务与工具产物 ──────────────────────────────────
CREATE TABLE tasks (
  task_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       text NOT NULL,
  type          text NOT NULL,
  inputs        jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'queued',
  priority      text NOT NULL DEFAULT 'batch',
  result        jsonb,
  error         text,
  tokens        bigint,
  cost_usd      numeric(10,4),
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX ON tasks (site_id, status, created_at DESC);

CREATE TABLE task_events (
  id            bigserial PRIMARY KEY,
  task_id       uuid NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  seq           bigint NOT NULL,
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tool_artifacts (
  id            bigserial PRIMARY KEY,
  name          text NOT NULL,
  path          text NOT NULL,                     -- harness/toolbox/x.py
  created_by_task uuid REFERENCES tasks(task_id) ON DELETE SET NULL,
  promoted      boolean NOT NULL DEFAULT false,    -- 是否已进 adapters/
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

-- ── 报告 ────────────────────────────────────────────────────
CREATE TABLE reports (
  report_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       text NOT NULL,
  kind          text NOT NULL,                     -- daily|weekly|rca|monthly
  period_start  timestamptz NOT NULL,
  period_end    timestamptz NOT NULL,
  body_md       text NOT NULL,
  data          jsonb NOT NULL DEFAULT '{}',
  task_id       uuid REFERENCES tasks(task_id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON reports (site_id, kind, period_start DESC);

-- ── 审计 ────────────────────────────────────────────────────
CREATE TABLE audit (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor         text NOT NULL,                     -- user:<id> | harness | probe
  action        text NOT NULL,
  target        text,
  detail        jsonb NOT NULL DEFAULT '{}',
  result        text
);
CREATE INDEX ON audit (at DESC);
