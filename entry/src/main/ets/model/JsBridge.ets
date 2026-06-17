import webview from '@ohos.web.webview';
import { http } from '@kit.NetworkKit';
import { router } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { StorageUtil } from '../util/StorageUtil';
import { NotificationUtil } from '../util/NotificationUtil';
import { ReminderService } from '../service/ReminderService';

const DOMAIN = 0x0000;
const TAG = 'JsBridge';

interface ApiResponse {
  status: number;
  body?: object;
  error?: string;
}

export class JsBridge {
  private controller: webview.WebviewController | null = null;

  setController(controller: webview.WebviewController): void {
    this.controller = controller;
  }

  async getApiKey(): Promise<string> {
    hilog.info(DOMAIN, TAG, 'getApiKey called');
    const key = await StorageUtil.getApiKey();
    hilog.info(DOMAIN, TAG, 'getApiKey result, key length: %{public}d', key.length);
    return key;
  }

  openSettings(): void {
    hilog.info(DOMAIN, TAG, 'openSettings called');
    try {
      router.pushUrl({ url: 'pages/Settings' }, router.RouterMode.Standard, (err) => {
        if (err) {
          hilog.error(DOMAIN, TAG, 'pushUrl failed: %{public}s', JSON.stringify(err));
        } else {
          hilog.info(DOMAIN, TAG, 'pushUrl success');
        }
      });
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'openSettings error: %{public}s', JSON.stringify(error));
    }
  }

  async fetchApi(requestId: string, url: string, apiKey: string): Promise<void> {
    hilog.info(DOMAIN, TAG, 'fetchApi called, requestId: %{public}s', requestId);
    try {
      const httpRequest = http.createHttp();
      const response = await httpRequest.request(url, {
        method: http.RequestMethod.GET,
        header: {
          'X-API-Key': apiKey,
          'User-Agent': 'RocoMerchant/1.0'
        },
        readTimeout: 15000,
        connectTimeout: 15000
      });

      hilog.info(DOMAIN, TAG, 'fetchApi response code: %{public}d', response.responseCode);

      const result: ApiResponse = {
        status: response.responseCode,
        body: JSON.parse(response.result as string)
      };

      this.callbackJs(requestId, JSON.stringify(result));
      httpRequest.destroy();
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'fetchApi error: %{public}s', JSON.stringify(error));
      const errorResult: ApiResponse = {
        status: 0,
        error: (error as Error).message || 'Unknown error'
      };
      this.callbackJs(requestId, JSON.stringify(errorResult));
    }
  }

  async enableNotification(): Promise<boolean> {
    hilog.info(DOMAIN, TAG, 'enableNotification called');
    try {
      await ReminderService.setupRoundReminders();
      hilog.info(DOMAIN, TAG, 'Notification enabled');
      return true;
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'enableNotification error: %{public}s', JSON.stringify(error));
      return false;
    }
  }

  async disableNotification(): Promise<boolean> {
    hilog.info(DOMAIN, TAG, 'disableNotification called');
    try {
      await ReminderService.cancelAllReminders();
      await NotificationUtil.cancelAllNotifications();
      hilog.info(DOMAIN, TAG, 'Notification disabled');
      return true;
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'disableNotification error: %{public}s', JSON.stringify(error));
      return false;
    }
  }

  async getNotificationStatus(): Promise<boolean> {
    hilog.info(DOMAIN, TAG, 'getNotificationStatus called');
    try {
      const count = await ReminderService.getValidReminders();
      return count > 0;
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'getNotificationStatus error: %{public}s', JSON.stringify(error));
      return false;
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
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');

    const jsCode = "if(typeof _nativeCallback==='function') _nativeCallback('" + requestId + "','" + escaped + "')";

    this.controller.runJavaScript(jsCode).then(() => {
      hilog.info(DOMAIN, TAG, 'callbackJs success');
    }).catch((error: Error) => {
      hilog.error(DOMAIN, TAG, 'callbackJs error: %{public}s', error.message);
    });
  }
}
