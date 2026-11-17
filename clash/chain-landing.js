/**
 * Clash Verge Rev / Mihomo 单个订阅的「多落地链式代理 + ACL4SSR 自动分流」扩展脚本（脱敏版）
 * 功能：
 * 1. 自动提取当前订阅的原始节点作为前置中转组（✈️ 链式前置），并过滤 Local- 本地端口及信息伪节点
 * 2. 通过 proxy-providers 挂载多个外部落地订阅（LANDING_SUBS），统一走前置拉取并绑定 dialer-proxy
 * 3. 可选开启 ACL4SSR 自动更新分流规则（ENABLE_SPLIT_RULES）：
 *    - 规则插入到当前订阅原有 rules 最前面，优先命中
 *    - 策略组放在订阅默认主选择组之后，每个业务组均可独立切换走默认出口或「🎯 链式落地」
 *
 * 使用说明：
 * 在 Clash Verge Rev 中右键单个订阅 -> 编辑扩展脚本（Extend Script），将本文件填入并将 url 替换为真实订阅地址。
 */

// ==================== 配置区 ====================
const GROUP_LANDING = "🎯 链式落地";
const GROUP_DIALER = "✈️ 链式前置";

// 是否启用 ACL4SSR 自动更新分流规则（true 开启 / false 仅保留链式代理）
const ENABLE_SPLIT_RULES = true;

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

// ACL4SSR 远程规则集配置（每 24 小时自动更新）
const ACL4SSR_BASE = "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash";

const SPLIT_RULE_SETS = [
  { id: "acl-lan", file: "LocalAreaNetwork.list", target: "🎯 全球直连" },
  { id: "acl-unban", file: "UnBan.list", target: "🎯 全球直连" },
  { id: "acl-steam-cn", file: "Ruleset/SteamCN.list", target: "🎯 全球直连" },
  { id: "acl-telegram", file: "Telegram.list", target: "📲 电报消息" },
  { id: "acl-ai", file: "Ruleset/AI.list", target: "💬 Ai平台" },
  { id: "acl-openai", file: "Ruleset/OpenAi.list", target: "💬 Ai平台" },
  { id: "acl-youtube", file: "Ruleset/YouTube.list", target: "📹 油管视频" },
  { id: "acl-netflix", file: "Ruleset/Netflix.list", target: "🎥 奈飞视频" },
  { id: "acl-bahamut", file: "Ruleset/Bahamut.list", target: "📺 巴哈姆特" },
  { id: "acl-bili-hmt", file: "Ruleset/BilibiliHMT.list", target: "📺 哔哩哔哩" },
  { id: "acl-bili", file: "Ruleset/Bilibili.list", target: "📺 哔哩哔哩" },
  { id: "acl-media", file: "ProxyMedia.list", target: "🌍 国外媒体" },
  { id: "acl-china-media", file: "ChinaMedia.list", target: "🌏 国内媒体" },
  { id: "acl-fcm", file: "Ruleset/GoogleFCM.list", target: "📢 谷歌FCM" },
  { id: "acl-bing", file: "Bing.list", target: "Ⓜ️ 微软Bing" },
  { id: "acl-onedrive", file: "OneDrive.list", target: "Ⓜ️ 微软云盘" },
  { id: "acl-microsoft", file: "Microsoft.list", target: "Ⓜ️ 微软服务" },
  { id: "acl-apple", file: "Apple.list", target: "🍎 苹果服务" },
  { id: "acl-epic", file: "Ruleset/Epic.list", target: "🎮 游戏平台" },
  { id: "acl-origin", file: "Ruleset/Origin.list", target: "🎮 游戏平台" },
  { id: "acl-sony", file: "Ruleset/Sony.list", target: "🎮 游戏平台" },
  { id: "acl-steam", file: "Ruleset/Steam.list", target: "🎮 游戏平台" },
  { id: "acl-nintendo", file: "Ruleset/Nintendo.list", target: "🎮 游戏平台" },
  { id: "acl-netease", file: "Ruleset/NetEaseMusic.list", target: "🎶 网易音乐" },
  { id: "acl-china-domain", file: "ChinaDomain.list", target: "🇨🇳 China" },
  { id: "acl-china-ip", file: "ChinaCompanyIp.list", target: "🇨🇳 China" },
];
// ================================================

/**
 * 探测当前订阅的默认主选择分组（优先选择包含原始节点最多的 select 分组，避免误命中 Final/漏网之鱼）
 */
function detectDefaultMainGroup(groups, baseNodes) {
  const isDirectOrReject = (g) => {
    if (!g || !g.name) return true;
    if (/直连|拦截|净化|direct|reject/i.test(g.name)) return true;
    const members = Array.isArray(g.proxies) ? g.proxies : [];
    return members.length > 0 && members.every((m) => m === "DIRECT" || m === "REJECT");
  };

  const baseNodeSet = new Set(baseNodes || []);
  const selectCandidates = groups.filter((g) => g && g.type === "select" && !isDirectOrReject(g));

  // 优先选出直接包含最多原始节点的 select 分组（如 Proxies / 吹雪云 / 🚀 节点选择）
  let bestGroup = null;
  let maxNodeCount = 0;
  for (let i = 0; i < selectCandidates.length; i++) {
    const g = selectCandidates[i];
    const members = Array.isArray(g.proxies) ? g.proxies : [];
    const hitCount = members.filter((m) => baseNodeSet.has(m)).length;
    if (hitCount > maxNodeCount) {
      maxNodeCount = hitCount;
      bestGroup = g;
    }
  }
  if (bestGroup && maxNodeCount > 0) return bestGroup.name;

  if (selectCandidates[0]) return selectCandidates[0].name;
  const fallback = groups.find((g) => !isDirectOrReject(g));
  return fallback ? fallback.name : null;
}

/**
 * 构建 ACL4SSR 分流策略组（放在原订阅默认分组之后）
 */
function buildSplitGroups(defaultMainGroup, baseAutoGroups) {
  const proxyFirst = [
    ...(defaultMainGroup ? [defaultMainGroup] : []),
    ...baseAutoGroups,
    "DIRECT",
  ];
  const directFirst = [
    "🎯 全球直连",
    ...(defaultMainGroup ? [defaultMainGroup] : []),
  ];

  const defs = [
    { name: "📲 电报消息", proxies: [...new Set(proxyFirst)] },
    { name: "💬 Ai平台", proxies: [...new Set(proxyFirst)] },
    { name: "📹 油管视频", proxies: [...new Set(proxyFirst)] },
    { name: "🎥 奈飞视频", proxies: [...new Set(proxyFirst)] },
    { name: "📺 巴哈姆特", proxies: [...new Set(proxyFirst)] },
    { name: "📺 哔哩哔哩", proxies: [...new Set(directFirst)] },
    { name: "🌍 国外媒体", proxies: [...new Set(proxyFirst)] },
    { name: "🌏 国内媒体", proxies: [...new Set(directFirst)] },
    { name: "📢 谷歌FCM", proxies: [...new Set(proxyFirst)] },
    { name: "Ⓜ️ 微软Bing", proxies: [...new Set(directFirst)] },
    { name: "Ⓜ️ 微软云盘", proxies: [...new Set(directFirst)] },
    { name: "Ⓜ️ 微软服务", proxies: [...new Set(directFirst)] },
    { name: "🍎 苹果服务", proxies: [...new Set(directFirst)] },
    { name: "🎮 游戏平台", proxies: [...new Set(proxyFirst)] },
    { name: "🎶 网易音乐", proxies: [...new Set(directFirst)] },
    {
      name: "🇨🇳 China",
      proxies: [...new Set(["DIRECT", ...(defaultMainGroup ? [defaultMainGroup] : [])])],
    },
    {
      name: "🎯 全球直连",
      proxies: [...new Set(["DIRECT", ...(defaultMainGroup ? [defaultMainGroup] : [])])],
    },
  ];

  return defs.map((d) => ({ name: d.name, type: "select", proxies: d.proxies }));
}

function main(config) {
  config.proxies = Array.isArray(config.proxies) ? config.proxies : [];
  config["proxy-groups"] = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  config["proxy-providers"] = config["proxy-providers"] || {};
  config["rule-providers"] = config["rule-providers"] || {};
  config.rules = Array.isArray(config.rules) ? config.rules : [];

  // 1. 提取当前订阅的原始节点与默认主分组
  const baseNodes = config.proxies
    .map((p) => p && p.name)
    .filter((name) => name && !/^Local-|剩余流量|到期时间|距离下次|官网|套餐|重置/i.test(name));

  const baseAutoGroups = config["proxy-groups"]
    .filter((g) => g && g.name && (g.type === "url-test" || g.type === "fallback"))
    .map((g) => g.name);

  const defaultMainGroup = detectDefaultMainGroup(config["proxy-groups"], baseNodes);

  // 若原订阅没有 url-test 分组（如 Nowhere 等纯 select 订阅），自动补一个前置测速组
  const autoDialerGroupName = "⚡ 前置自动选择";
  const hasUrlTest = config["proxy-groups"].some((g) => g && g.type === "url-test");
  const extraDialerAutoGroup =
    !hasUrlTest && baseNodes.length > 0
      ? {
          name: autoDialerGroupName,
          type: "url-test",
          url: "https://www.gstatic.com/generate_204",
          interval: 300,
          tolerance: 50,
          proxies: baseNodes,
        }
      : null;

  const dialerCandidates = [
    ...new Set([
      ...(extraDialerAutoGroup ? [autoDialerGroupName] : []),
      ...baseAutoGroups,
      ...baseNodes,
    ]),
  ];

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

  // 3. 只把“🎯 链式落地”插入到当前订阅默认主选择分组的第一位（不动其他业务/地区分流组）
  if (defaultMainGroup) {
    const mainGroupObj = config["proxy-groups"].find((g) => g && g.name === defaultMainGroup);
    if (mainGroupObj && Array.isArray(mainGroupObj.proxies)) {
      if (!mainGroupObj.proxies.includes(GROUP_LANDING)) {
        mainGroupObj.proxies.unshift(GROUP_LANDING);
      }
    }
  }

  // 4. 创建链式分组（置顶）并保留原订阅原有分组在其后
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

  const chainGroupNames = new Set([
    GROUP_LANDING,
    GROUP_DIALER,
    autoDialerGroupName,
    ...subGroups.map((g) => g.name),
  ]);
  const originalGroups = config["proxy-groups"].filter((g) => g && !chainGroupNames.has(g.name));

  // 5. 若开启分流规则，挂载 ACL4SSR rule-providers 并把分流组追加到原订阅默认分组之后
  let finalSplitGroups = [];
  if (ENABLE_SPLIT_RULES) {
    const existingNames = new Set(originalGroups.map((g) => g.name));
    finalSplitGroups = buildSplitGroups(defaultMainGroup, baseAutoGroups).filter(
      (g) => !existingNames.has(g.name)
    );

    const splitRules = [];
    const ruleProxy = defaultMainGroup || GROUP_DIALER;
    for (const item of SPLIT_RULE_SETS) {
      config["rule-providers"][item.id] = {
        type: "http",
        behavior: "classical",
        format: "text",
        url: `${ACL4SSR_BASE}/${item.file}`,
        path: `./ruleset/${item.id}.list`,
        interval: 86400,
        proxy: ruleProxy,
      };
      splitRules.push(`RULE-SET,${item.id},${item.target}`);
    }

    // 分流规则插入到当前订阅原有规则最前面（优先命中）
    config.rules = [...splitRules, ...config.rules];

    // 若原订阅无兜底 MATCH 规则，自动补一条指向默认主分组
    if (!config.rules.some((r) => typeof r === "string" && /^MATCH,/i.test(r.trim()))) {
      config.rules.push(`MATCH,${defaultMainGroup || GROUP_LANDING}`);
    }
  }

  // 将原订阅默认主选择分组（如 Proxies / 吹雪云）排在链式分组之后、ACL4SSR 分流分组之前
  const defaultGroupObj = defaultMainGroup
    ? originalGroups.find((g) => g.name === defaultMainGroup)
    : null;
  const otherOriginalGroups = defaultGroupObj
    ? originalGroups.filter((g) => g.name !== defaultMainGroup)
    : originalGroups;

  // 除“🇨🇳 China”保留在末尾外，其余新增 ACL4SSR 分流分组紧跟在默认主分组之后、原订阅其余分组之前
  const frontSplitGroups = finalSplitGroups.filter((g) => g.name !== "🇨🇳 China");
  const tailSplitGroups = finalSplitGroups.filter((g) => g.name === "🇨🇳 China");

  // 最终顺序：订阅默认主分组 -> 链式配置分组 -> 新增业务分流分组 -> 🇨🇳 China -> 订阅其余分组
  config["proxy-groups"] = [
    ...(defaultGroupObj ? [defaultGroupObj] : []),
    landingMainGroup,
    dialerGroup,
    ...(extraDialerAutoGroup ? [extraDialerAutoGroup] : []),
    ...subGroups,
    ...frontSplitGroups,
    ...tailSplitGroups,
    ...otherOriginalGroups,
  ];

  return config;
}
