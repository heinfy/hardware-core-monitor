import type { WebviewToHostMessage } from "../../../src/shared/protocol";

/**
 * acquireVsCodeApi 由 VSCode Webview 宿主注入。
 * 每个页面只能调用一次，因此这里封装成单例。
 */
interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

/** 获取 VSCode Webview API 单例 */
export function getVsCodeApi(): VsCodeApi {
  api ??= acquireVsCodeApi();
  return api;
}

/** 发送消息给扩展宿主；浏览器预览里没有宿主注入时直接跳过 */
export function postToHost(message: WebviewToHostMessage): void {
  if (typeof acquireVsCodeApi !== "function") {
    return;
  }

  getVsCodeApi().postMessage(message);
}
