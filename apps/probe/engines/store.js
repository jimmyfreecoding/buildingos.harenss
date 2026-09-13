'use strict';

/**
 * DSH 探针数据层（M1）
 * 纯 Node 模块（无第三方依赖，可单测、可移植到 Pi Node 20）。
 * 持久化：JSON 文件（devices/events/config）+ audit.log（写操作留痕）。
 * 说明：cordis 动态插件环境无 require，插件内将内联等价逻辑或经 fs Service 调用；
 * 本模块是规范实现与单测载体（见 13 文档 M1）。
 *
 * 数据模型：
 *  Device: { ip, mac, oui, vendor, type, ports[], firstSeen, lastSeen, status, confidence }
 *  Event : { ts, level(P1-P4), kind, target, detail, autoHealed }
 *  Config: { site, snmpCommunity, credentialsRef, selfHealEnabled, notifyEmail, pollIntervalMs }
 */

const fs = require('fs');
const path = require('path');

function createStore(dataDir) {
  const dir = dataDir;
  const devicesFile = path.join(dir, 'devices.json');
  const eventsFile = path.join(dir, 'events.json');
  const configFile = path.join(dir, 'config.json');
  const auditFile = path.join(dir, 'audit.log');
  const EVENTS_LIMIT = 2000;

  function ensureDir() {
    fs.mkdirSync(dir, { recursive: true });
  }

  function readJson(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  function writeJson(file, data) {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  }

  function appendAudit(entry) {
    ensureDir();
    fs.appendFileSync(
      auditFile,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n',
      'utf8',
    );
  }

  return {
    ensureDir,
    readJson,
    writeJson,

    // ---------- devices ----------
    listDevices() {
      return readJson(devicesFile, []);
    },

    upsertDevice(device) {
      const devices = this.listDevices();
      const idx = devices.findIndex((d) => d.ip === device.ip);
      const now = new Date().toISOString();
      const merged =
        idx >= 0
          ? { ...devices[idx], ...device, lastSeen: now }
          : { ...device, firstSeen: now, lastSeen: now };
      if (idx >= 0) devices[idx] = merged;
      else devices.push(merged);
      writeJson(devicesFile, devices);
      appendAudit({ op: 'upsertDevice', ip: device.ip, mac: device.mac || null });
      return merged;
    },

    removeDevice(ip) {
      const devices = this.listDevices();
      const next = devices.filter((d) => d.ip !== ip);
      if (next.length !== devices.length) {
        writeJson(devicesFile, next);
        appendAudit({ op: 'removeDevice', ip });
        return true;
      }
      return false;
    },

    // ---------- events ----------
    listEvents() {
      return readJson(eventsFile, []);
    },

    appendEvent(event) {
      const events = this.listEvents();
      const entry = { ts: new Date().toISOString(), ...event };
      events.push(entry);
      writeJson(eventsFile, events.slice(-EVENTS_LIMIT));
      appendAudit({
        op: 'appendEvent',
        level: event.level || 'P4',
        kind: event.kind,
        target: event.target || null,
      });
      return entry;
    },

    // ---------- config ----------
    getConfig() {
      return readJson(configFile, {});
    },

    setConfig(patch) {
      const cfg = { ...this.getConfig(), ...patch };
      writeJson(configFile, cfg);
      appendAudit({ op: 'setConfig', keys: Object.keys(patch) });
      return cfg;
    },

    // ---------- audit ----------
    listAudit() {
      try {
        return fs
          .readFileSync(auditFile, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l));
      } catch {
        return [];
      }
    },
  };
}

module.exports = { createStore };
