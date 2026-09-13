# netops profile 骨架 —— 安装步骤

## 1. 创建 profile

```powershell
# 首次使用会自动初始化 $DSH_HOME/profiles/netops（一个 node 包）
dsh plugin --profile netops add @deepseek-ai/dsh-storage-sqlite
dsh plugin --profile netops add @deepseek-ai/dsh-credentials-local
```

## 2. 放置文件

| 来源 | 目标 |
|---|---|
| `package.json` | `$DSH_HOME\profiles\netops\package.json`（保留 dsh 生成的 `dsh.profile.bundles`，按需追加产品 bundle） |
| `cordis.patch.yml` | `$DSH_HOME\profiles\netops\cordis.patch.yml` ← **产品与客户只改这个文件** |
| `probe.yml` | `C:\netops\overlay\probe.yml`（计划任务用的一次性 overlay） |

> `$DSH_HOME\profiles\netops\cordis.yml` 是 dsh 生成的**空根入口列表**，不要手改。

## 3. 校验（必做）

```powershell
dsh --profile netops --dump-config
```

- 会打印合成后的完整树，并标注每一层的来源文件；
- 报 `Cannot find package ...` → 包没装或名字拼错；
- 报 `invalid config: $.<field> missing required value` → 行配置不合 schema；
- 报 id 冲突 → 某个 bundle 层已有同名行，改用 id 定位覆盖而不是 `insert`。

加 `--dump-default-config` 可只看 bundle 层（不含用户层与 `--patch`），用于排查是不是自己的层写坏了。

## 4. 常驻运行

```powershell
dsh --profile netops --patch C:\netops\overlay\probe.yml
```

后台化（开机自启）见主方案第 2.4 节：Windows 用 `schtasks` / NSSM，Linux 用 systemd。

## 5. 分环境注意

- **凭据**：`cordis.patch.yml` 里只写引用名（POSIX 风格环境变量名），值放 `$DSH_HOME\.credentials.yaml` 或进程环境。永远不要把密码写进这个 YAML。
- **探针出口接口**：必须显式配置 `probeInterface`。默认套接字的广播/组播会被度量更低的虚拟网卡（VirtualBox Host-Only 25、Wi-Fi Direct 25）抢走，而真实以太网是 45 —— 这会让所有 SSDP/ONVIF/mDNS 发现静默失败。
