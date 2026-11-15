/**
 * 本文档主要用于 clash系列、mihomao 等代理工具的通用规则配置
 * 比如 根据进程名称、进程路径、端口号等进行规则匹配，实现进程分流
 * 
 */
function main(config) {
  // 1. 开启进程名识别（确保任意订阅都能正确捕获进程名）
  config["find-process-mode"] = "strict";

  config.proxies = config.proxies || [];
  config.rules = config.rules || [];

  // 2. 注入本机三个本地代理端口（SOCKS5）
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

  // 3. 定义前置进程规则（自上而下优先匹配）
  const customRules = [
    // 【必留】放行本地代理核心自身出站，防止 TUN 模式死循环（同时兼容 Windows 和 macOS）
    // "PROCESS-NAME-REGEX,^(FlClashCore|xray|sing-box|verge-mihomo)(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^xray(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^sing-box(\\.exe)?$,DIRECT",
    // "PROCESS-NAME-REGEX,^verge-mihomo(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^mihomo(\\.exe)?$,DIRECT",
    "PROCESS-NAME-REGEX,^FlClashCore(\\.exe)?$,DIRECT",

    // ================= Windows 按你的需要修改下方分流规则 =================
    // 命令行工具示例
    "PROCESS-PATH-REGEX,^C:\\\\Program Files\\\\Google\\\\Chrome Dev\\\\Application\\\\.*,Local-9999",
    // Chrome Canary (Chrome SxS) 安装目录及其子目录下的所有进程均走 Local-7890
    "PROCESS-PATH-REGEX,^D:\\\\UV\\\\AppData\\\\Local\\\\Google\\\\Chrome SxS\\\\Application\\\\.*,Local-7890",
    // Antigravity 安装目录及其子目录下的所有进程均走 Local-9999
    "PROCESS-PATH-REGEX,^D:\\\\UV\\\\AppData\\\\Local\\\\Programs\\\\Antigravity\\\\.*,Local-9999",
    // ChatGPT（OpenAI.Codex 应用包）及其子目录下的所有进程均走 Local-9999，兼容版本号变化
    "PROCESS-PATH-REGEX,^C:\\\\Program Files\\\\WindowsApps\\\\OpenAI\\.Codex_.*,Local-9999",
    
    // ============================================================
    
    // ================= macOS 按你的需要修改下方分流规则 =================
    // 命令行工具示例
    "PROCESS-NAME,curl,Local-8899",
    //"PROCESS-PATH-REGEX,^/Applications/Google Chrome\\.app/.*,Local-8899",
    "PROCESS-PATH-REGEX,^/Applications/Google Chrome Dev\\.app/.*,Local-9999",
    // macOS 多子进程应用示例（如前面 lsof 看到的 Trae 实际由 Electron / Trae Helper 发包，用路径匹配最稳）
    // "PROCESS-PATH-REGEX,.*/Trae\\.app/.*,Local-9999",
    // "PROCESS-NAME,Telegram,Local-20122",
    // ============================================================
  ];

  // 4. 插入到当前订阅原有 rules 的最前面（未命中的流量继续走原订阅规则）
  config.rules = customRules.concat(config.rules);

  return config;
}