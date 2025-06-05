# proxy-config
梯子的配置文件

这个仓库包含用于Talkatone和Google Voice等服务的代理规则配置文件。

## 文件说明

- `talkatone-rule-set.list`: Talkatone和Google Voice服务的代理规则列表，包含相关域名、IP地址和端口
- 其他配置文件将陆续添加

## 规则内容

规则文件中包含以下内容：

1. Talkatone主要域名及相关分析服务域名
2. Google Voice服务域名(telephony.goog等)
3. 谷歌推送和认证服务域名
4. 广告和分析相关域名
5. Talkatone和Google Voice服务器IP地址
6. 媒体传输所需端口(RTP/SRTP)

## 使用方法

将规则文件导入到代理工具中使用，支持Clash、Surge等格式。
