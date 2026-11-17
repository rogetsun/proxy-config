/**
 * 公开仓库，脱敏uuid，转移到私有仓库了
 * Clash Verge Rev / Mihomo 单个订阅的「多落地链式代理」扩展脚本
 * 功能：
 * 1. 自动提取当前订阅的原始节点作为前置中转组（✈️ 链式前置），并过滤 Local- 本地端口及信息伪节点
 * 2. 通过 proxy-providers 挂载多个外部落地订阅（LANDING_SUBS），统一走前置拉取并绑定 dialer-proxy
 * 3. 生成总控分组（🎯 链式落地）及各订阅子组，追加到原订阅 select 分组中自由切换单跳/链式
 *
 * 使用说明：
 * 在 Clash Verge Rev 中右键单个订阅 -> 编辑扩展脚本（Extend Script），将本文件填入并将 url 替换为真实订阅地址。
 */

// ==================== 配置区 ====================
const GROUP_LANDING = "🎯 链式落地";
const GROUP_DIALER = "✈️ 链式前置";

// 多个落地订阅列表（全部走当前订阅前置拉取，按需增删；请替换为你的真实订阅链接）
const LANDING_SUBS = [
  {
    id: "landing-as",
    groupName: "🎯 落地-英国(as)",
    prefix: "[英国] ",
    url: "https://as.songyw.com/<your-uuid>/auto2",
  },
  {
    id: "landing-yy",
    groupName: "🎯 落地-台湾(yy)",
    prefix: "[台湾] ",
    url: "https://sub-yy.songyw.com/<your-uuid>/auto2",
  },
  {
    id: "landing-gtt",
    groupName: "🎯 落地-美国(gtt)",
    prefix: "[美国GTT] ",
    url: "http://216.36.99.70:39606/<your-uuid>/auto2",
  },
  {
    id: "landing-ntt",
    groupName: "🎯 落地-美国(ntt)",
    prefix: "[美国NTT] ",
    url: "http://216.167.48.203:39606/<your-uuid>/auto2",
  },
];
// ================================================

function main(config) {
  config.proxies = Array.isArray(config.proxies) ? config.proxies : [];
  config["proxy-groups"] = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  config["proxy-providers"] = config["proxy-providers"] || {};

  // 1. 提取当前订阅的原始节点（过滤掉 Local- 本地节点和 剩余流量/到期时间 等伪节点）
  const baseNodes = config.proxies
    .map((p) => p && p.name)
    .filter((name) => name && !/^Local-|剩余流量|到期时间|距离下次|官网|套餐|重置/i.test(name));

  const baseAutoGroups = config["proxy-groups"]
    .filter((g) => g && g.name && (g.type === "url-test" || g.type === "fallback"))
    .map((g) => g.name);

  const dialerCandidates = [...new Set([...baseAutoGroups, ...baseNodes])];

  // 2. 批量注册多个落地订阅，统一走 GROUP_DIALER 拉取并绑定 dialer-proxy
  const subGroups = [];

  for (const sub of LANDING_SUBS) {
    const provider = {
      type: "http",
      url: sub.url,
      path: `./providers/${sub.id}.yaml`,
      interval: 3600,
      proxy: GROUP_DIALER,
      header: {
        "User-Agent": ["clash.meta", "clash-verge/v2.0.0"],
      },
      "health-check": {
        enable: true,
        url: "https://www.gstatic.com/generate_204",
        interval: 300,
      },
      override: {
        "dialer-proxy": GROUP_DIALER,
        "additional-prefix": sub.prefix,
      },
    };

    if (sub.excludeFilter) {
      provider["exclude-filter"] = sub.excludeFilter;
    }

    config["proxy-providers"][sub.id] = provider;

    subGroups.push({
      name: sub.groupName,
      type: "select",
      use: [sub.id],
    });
  }

  // 3. 把“🎯 链式落地”追加到当前订阅原有 select 分组中
  for (const group of config["proxy-groups"]) {
    if (!group || group.type !== "select" || !Array.isArray(group.proxies)) continue;
    if (/直连|拦截|净化|direct|reject/i.test(group.name)) continue;
    if (group.proxies.every((m) => m === "DIRECT" || m === "REJECT")) continue;

    if (!group.proxies.includes(GROUP_LANDING)) {
      group.proxies.push(GROUP_LANDING);
    }
  }

  // 4. 创建总控组“🎯 链式落地”、“✈️ 链式前置”以及各个订阅子组，并置顶
  const landingMainGroup = {
    name: GROUP_LANDING,
    type: "select",
    proxies: subGroups.map((g) => g.name),
  };

  const dialerGroup = {
    name: GROUP_DIALER,
    type: "select",
    proxies: dialerCandidates.length > 0 ? dialerCandidates : ["DIRECT"],
  };

  const createdNames = new Set([GROUP_LANDING, GROUP_DIALER, ...subGroups.map((g) => g.name)]);
  config["proxy-groups"] = config["proxy-groups"].filter((g) => g && !createdNames.has(g.name));
  config["proxy-groups"].unshift(landingMainGroup, dialerGroup, ...subGroups);

  return config;
}
