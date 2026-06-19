import webview from '@ohos.web.webview';
import { http } from '@kit.NetworkKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { common } from '@kit.AbilityKit';

const DOMAIN = 0x0000;
const TAG = 'JsBridge';

interface ApiResponse {
  status: number;
  body?: object;
  error?: string;
}

export class JsBridge {
  private controller: webview.WebviewController | null = null;
  private context: common.UIAbilityContext | null = null;

  setController(controller: webview.WebviewController): void {
    this.controller = controller;
  }

  setContext(context: common.UIAbilityContext): void {
    this.context = context;
  }

  async fetchApi(requestId: string, url: string, apiKey: string): Promise<void> {
    hilog.info(DOMAIN, TAG, 'fetchApi called, requestId: %{public}s, url: %{public}s', requestId, url);
    try {
      const httpRequest = http.createHttp();
      const response = await httpRequest.request(url, {
        method: http.RequestMethod.GET,
        header: {
          'User-Agent': 'RocoMerchant/1.0'
        },
        readTimeout: 15000,
        connectTimeout: 15000
      });

      hilog.info(DOMAIN, TAG, 'fetchApi response code: %{public}d', response.responseCode);

      let bodyStr: string;
      if (typeof response.result === 'string') {
        bodyStr = response.result;
      } else {
        bodyStr = JSON.stringify(response.result);
      }

      const resultStr = '{"status":' + response.responseCode + ',"body":' + bodyStr + '}';
      this.callbackJs(requestId, resultStr);
      httpRequest.destroy();
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'fetchApi error: %{public}s', JSON.stringify(error));
      const errorMsg = (error instanceof Error) ? error.message : 'Unknown error';
      this.callbackJs(requestId, '{"status":0,"error":"' + errorMsg.replace(/"/g, '\\"') + '"}');
    }
  }

  async loadEggData(requestId: string): Promise<void> {
    hilog.info(DOMAIN, TAG, 'loadEggData called, requestId: %{public}s', requestId);
    if (!this.context) {
      hilog.error(DOMAIN, TAG, 'Context not set');
      this.callbackJs(requestId, '{"status":0,"error":"Context not set"}');
      return;
    }
    try {
      const resourceMgr = this.context.resourceManager;
      const rawData = await resourceMgr.getRawFileContent('egg-data.json');
      const content = String.fromCharCode(...rawData);
      hilog.info(DOMAIN, TAG, 'loadEggData success, length: %{public}d', content.length);
      this.callbackJs(requestId, '{"status":200,"body":' + content + '}');
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'loadEggData error: %{public}s', JSON.stringify(error));
      this.callbackJs(requestId, '{"status":0,"error":"load failed"}');
    }
  }

  private callbackJs(requestId: string, response: string): void {
    if (!this.controller) {
      hilog.error(DOMAIN, TAG, 'Controller not set');
      return;
    }

    const escaped = response
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '')
      .replace(/\t/g, '\\t');

    const jsCode = "if(typeof _nativeCallback==='function') _nativeCallback('" + requestId + "','" + escaped + "')";

    hilog.info(DOMAIN, TAG, 'callbackJs executing, requestId: %{public}s', requestId);

    this.controller.runJavaScript(jsCode).then(() => {
      hilog.info(DOMAIN, TAG, 'callbackJs success');
    }).catch((error: Error) => {
      hilog.error(DOMAIN, TAG, 'callbackJs error: %{public}s', error.message);
    });
  }
}
