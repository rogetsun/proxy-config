# proxy-config

Shadowrocket 代理规则配置文件仓库。

## 目录结构

```
├── shadowrockets/
│   ├── uv.conf                    # 主配置文件
│   ├── uv.module                  # 模块扩展
│   ├── uv-game.module             # 游戏模块扩展
│   ├── talkatone-rule-set.list    # Talkatone/Google Voice 规则集
│   ├── openai-rule-set.list       # OpenAI 规则集
│   ├── telegram-rule-set.list     # Telegram 规则集
│   ├── binance-rule-set.list      # Binance 规则集
│   ├── github-rule-set.list       # GitHub 规则集
│   ├── pubg-game-rule-set.list    # PUBG 游戏规则集
│   ├── mx.conf                    # 备用配置
│   └── mx.bak.yaml                # 备用配置备份
└── subconverter/                  # 订阅转换相关
```

## uv.conf 配置说明

### General（通用设置）

| 配置项                               | 值                       | 说明                                                                |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------- |
| `bypass-system`                      | `true`                   | 旁路系统，避免推送通知延迟等问题                                    |
| `skip-proxy`                         | 局域网段 + 特定域名      | 跳过代理的地址，包括银行等域名                                      |
| `dns-server`                         | DoH + 普通 DNS           | 使用 `doh.pub` 和 `alidns` 的 DoH，备用 `223.5.5.5`、`119.29.29.29` |
| `fallback-dns-server`                | `system`                 | DNS 查询失败时回退系统 DNS                                          |
| `ipv6`                               | `true`                   | 启用 IPv6 支持                                                      |
| `hijack-dns`                         | `8.8.8.8:53, 8.8.4.4:53` | 劫持 Google DNS 查询                                                |
| `udp-policy-not-supported-behaviour` | `REJECT`                 | 不支持 UDP 转发时拒绝                                               |

### Proxy Group（代理分组）

#### 主要分组

| 分组名称        | 类型     | 说明                                             |
| --------------- | -------- | ------------------------------------------------ |
| `default-proxy` | select   | 默认代理，可选 PROXY/台湾家宽/美国/家宽/美国家宽 |
| `台湾家宽`      | url-test | 自动测速选择台湾家宽节点                         |
| `美国`          | select   | 手动选择美国节点                                 |
| `家宽`          | select   | 手动选择家宽节点                                 |
| `美国家宽`      | select   | 手动选择美国/加拿大家宽节点                      |
| `游戏节点`      | select   | 手动选择游戏专用节点                             |

#### 应用分组

| 分组名称    | 类型   | 默认策略      |
| ----------- | ------ | ------------- |
| `binance`   | select | default-proxy |
| `TG`        | select | default-proxy |
| `talkatone` | select | default-proxy |
| `openai`    | select | default-proxy |
| `GitHub`    | select | default-proxy |
| `PUBG`      | select | default-proxy |

#### 流媒体 & 服务分组

| 分组名称   | 类型   | 默认策略                        |
| ---------- | ------ | ------------------------------- |
| `AI`       | select | default-proxy                   |
| `YouTube`  | select | default-proxy                   |
| `Netflix`  | select | default-proxy                   |
| `Disney+`  | select | default-proxy                   |
| `Max`      | select | default-proxy                   |
| `TikTok`   | select | default-proxy                   |
| `Spotify`  | select | default-proxy（含 DIRECT 选项） |
| `Twitter`  | select | default-proxy                   |
| `Facebook` | select | default-proxy                   |
| `PayPal`   | select | default-proxy（含 DIRECT 选项） |
| `Amazon`   | select | default-proxy（含 DIRECT 选项） |
| `苹果服务` | select | DIRECT                          |
| `谷歌服务` | select | default-proxy                   |
| `微软服务` | select | DIRECT                          |
| `哔哩哔哩` | select | DIRECT                          |
| `游戏平台` | select | default-proxy                   |

#### 地区自动测速分组

| 分组名称     | 类型     | 测试间隔 |
| ------------ | -------- | -------- |
| `香港节点`   | url-test | 600s     |
| `台湾节点`   | url-test | 600s     |
| `日本节点`   | url-test | 600s     |
| `新加坡节点` | url-test | 600s     |
| `韩国节点`   | url-test | 600s     |
| `美国节点`   | url-test | 600s     |

### Rule（分流规则）

规则按优先级从上到下匹配，主要包含：

**国内直连服务：**
- 苹果服务、哔哩哔哩、网易云音乐、百度、豆瓣、微信、抖音、新浪、知乎、小红书

**国外代理服务：**
- YouTube、Netflix、Disney+、Max(HBO)、Spotify、PayPal、Twitter、Facebook、Amazon
- AI 服务（Claude、Gemini、OpenAI、Grok/x.ai）
- TikTok、Google、Microsoft、GitHub
- 游戏平台（Sony、Nintendo、Epic、Steam）

**兜底规则：**
- `GEOIP,CN,DIRECT` — 中国 IP 直连
- `FINAL,default-proxy` — 其他流量走默认代理

### 其他配置

- **Host**：苹果域名使用系统 DNS 解析
- **URL Rewrite**：Google 搜索防跳转（`google.cn` → `google.com`）
- **MITM**：仅解密 `*.google.cn` 域名

## 自定义规则集

| 文件                      | 用途                                   |
| ------------------------- | -------------------------------------- |
| `talkatone-rule-set.list` | Talkatone / Google Voice 相关域名和 IP |
| `openai-rule-set.list`    | OpenAI / ChatGPT 相关域名              |
| `telegram-rule-set.list`  | Telegram 相关域名和 IP                 |
| `binance-rule-set.list`   | Binance 交易所相关域名                 |
| `github-rule-set.list`    | GitHub 相关域名                        |
| `pubg-game-rule-set.list` | PUBG 游戏相关域名和 IP                 |

## 使用方法

1. 在 Shadowrocket 中导入 `uv.conf` 作为配置文件
2. 添加节点订阅
3. 首页 → 连通性测试，选择可用节点
4. 如需 HTTPS 解密功能，参考配置文件中的证书安装说明
