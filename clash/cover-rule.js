/**
 * 本文档主要用于 Clash / Mihomo 等代理工具的全局覆写脚本
 * 功能：
 * 1. 开启进程名识别并注入本机 SOCKS5 代理节点
 * 2. 保留防 TUN 死循环的内核直连规则（本地兜底）
 * 3. 从 GitHub 仓库动态挂载远程进程分流规则集（rule-providers）
 * 4. 开启 use-hosts 并注入常用本机回环域名 hosts 映射
 */

const RULE_BASE_URL =
  "https://raw.githubusercontent.com/rogetsun/proxy-config/main/clash/rules";

// 按出口策略拆分的远程规则集映射（新增端口规则时在此处追加即可，注意目标 .list 文件至少包含一条有效规则）
const REMOTE_RULE_SETS = [
  { name: "custom-local-7890", file: "local-7890.list", target: "Local-7890" },
  { name: "custom-local-9999", file: "local-9999.list", target: "Local-9999" },
  { name: "custom-local-20122", file: "local-20122.list", target: "Local-20122" },
  { name: "custom-local-8899", file: "local-8899.list", target: "Local-8899" },
  // { name: "custom-local-7897", file: "local-7897.list", target: "Local-7897" },
];

// 常用本机回环域名映射（直接解析为 127.0.0.1，避免 Fake-IP 模式下本地唤起/授权失败）
const LOCAL_LOOPBACK_HOSTS = {
  "localhost.weixin.qq.com": "127.0.0.1",
  "localhost.work.weixin.qq.com": "127.0.0.1",
  "localhost.ptlogin2.qq.com": "127.0.0.1",
  "localhost.sec.qq.com": "127.0.0.1",
  "localhost.wbridge.wps.cn": "127.0.0.1",
  "*.localhost": "127.0.0.1",
};

/**
 * 从当前订阅的代理分组中自动探测用于拉取远程规则集的出口分组，
 * 避免 Mihomo 默认直连 raw.githubusercontent.com 时被重置导致规则集拉取失败。
 */
function resolveRuleProviderProxy(config) {
  const groups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  const isDirectOrReject = (group) => {
    if (!group || !group.name) return true;
    if (/直连|拦截|净化|direct|reject/i.test(group.name)) return true;
    const members = Array.isArray(group.proxies) ? group.proxies : [];
    return members.length > 0 && members.every((m) => m === "DIRECT" || m === "REJECT");
  };

  const candidates = groups.filter((g) => !isDirectOrReject(g));
  const preferredSelect = candidates.find((g) => g.type === "select");
  if (preferredSelect) return preferredSelect.name;

  const fallbackGroup = candidates[0];
  return fallbackGroup ? fallbackGroup.name : null;
}

function main(config) {
  // 1. 开启进程名识别（确保任意订阅都能正确捕获进程名）并启用本机回环 hosts
  config["find-process-mode"] = "strict";
  config.dns = config.dns || {};
  config.dns["use-hosts"] = true;
  config.hosts = Object.assign({}, config.hosts || {}, LOCAL_LOOPBACK_HOSTS);

  config.proxies = config.proxies || [];
  config.rules = config.rules || [];
  config["rule-providers"] = config["rule-providers"] || {};

  // 2. 注入本机本地代理端口（SOCKS5）
  const localProxies = [
    { name: "Local-7890", type: "socks5", server: "127.0.0.1", port: 7890, udp: true },
    { name: "Local-7897", type: "socks5", server: "127.0.0.1", port: 7897, udp: true },
    { name: "Local-8899", type: "socks5", server: "127.0.0.1", port: 8899, udp: true },
    { name: "Local-9999", type: "socks5", server: "127.0.0.1", port: 9999, udp: true },
    { name: "Local-20122", type: "socks5", server: "127.0.0.1", port: 20122, udp: true },
  ];

  for (const p of localProxies) {
    if (!config.proxies.some((item) => item.name === p.name)) {
      config.proxies.push(p);
    }
  }

  // 3. 【必留】放行本地代理核心自身出站，防止 TUN 模式死循环（同时兼容 Windows 和 macOS）
  const coreDirectRules = [
    "PROCESS-NAME-REGEX,^xray(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^sing-box(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^verge-mihomo(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^mihomo(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^FlClashCore(\\.exe)?$,DIRECT",
  ];

  // 4. 注册 GitHub 远程规则集，并生成对应的前置 RULE-SET 规则
  const providerProxy = resolveRuleProviderProxy(config);
  const remoteRules = [];
  for (const item of REMOTE_RULE_SETS) {
    const providerConfig = {
      type: "http",
      behavior: "classical",
      format: "text",
      url: `${RULE_BASE_URL}/${item.file}`,
      path: `./ruleset/${item.name}.list`,
      interval: 300,
    };
    if (providerProxy) {
      providerConfig.proxy = providerProxy;
    }
    config["rule-providers"][item.name] = providerConfig;
    remoteRules.push(`RULE-SET,${item.name},${item.target}`);
  }

  // 5. 插入到当前订阅原有 rules 的最前面（核心直连 -> 远程进程规则 -> 原订阅规则）
  config.rules = coreDirectRules.concat(remoteRules, config.rules);

  return config;
}
