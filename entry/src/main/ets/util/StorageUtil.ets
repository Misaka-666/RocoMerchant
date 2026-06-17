import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x0000;
const TAG = 'StorageUtil';
const STORE_NAME = 'settings';
const KEY_API_KEY = 'api_key';

export class StorageUtil {
  private static context: common.UIAbilityContext | null = null;

  static init(context: common.UIAbilityContext): void {
    StorageUtil.context = context;
  }

  static async getApiKey(): Promise<string> {
    if (!StorageUtil.context) {
      hilog.error(DOMAIN, TAG, 'Context not initialized');
      return '';
    }
    try {
      const store = await preferences.getPreferences(StorageUtil.context, STORE_NAME);
      const value = await store.get(KEY_API_KEY, '');
      return value as string;
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'Failed to get API key: %{public}s', JSON.stringify(error));
      return '';
    }
  }

  static async saveApiKey(apiKey: string): Promise<void> {
    if (!StorageUtil.context) {
      hilog.error(DOMAIN, TAG, 'Context not initialized');
      return;
    }
    try {
      const store = await preferences.getPreferences(StorageUtil.context, STORE_NAME);
      await store.put(KEY_API_KEY, apiKey);
      await store.flush();
      hilog.info(DOMAIN, TAG, 'API key saved successfully');
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'Failed to save API key: %{public}s', JSON.stringify(error));
    }
  }
}
