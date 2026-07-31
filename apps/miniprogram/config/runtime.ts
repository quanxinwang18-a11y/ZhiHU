export const runtimeConfig = {
  /**
   * 留空时使用完全在小程序内运行的 Mock，打开项目即可体验。
   * 联调本地 Next.js API 时可临时改为 http://127.0.0.1:3000。
   * 真机必须换成已配置的 HTTPS 业务域名。
   */
  apiBaseUrl: "",
  historyLimit: 20,
} as const;

export const usesRemoteApi = runtimeConfig.apiBaseUrl.length > 0;

