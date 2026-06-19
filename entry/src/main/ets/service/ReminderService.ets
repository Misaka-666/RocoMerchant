import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { notificationManager } from '@kit.NotificationKit';
import { NotificationUtil } from '../util/NotificationUtil';
import { StorageUtil } from '../util/StorageUtil';
import { http } from '@kit.NetworkKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x0000;
const TAG = 'ReminderService';

interface ReminderIds {
  ROUND_1: number;
  ROUND_2: number;
  ROUND_3: number;
  ROUND_4: number;
}

interface MerchantItem {
  name: string;
}

interface MerchantActivity {
  get_props: MerchantItem[];
  get_pets: MerchantItem[];
}

interface ApiData {
  merchantActivities: MerchantActivity[];
}

interface ApiResult {
  code: number;
  data: ApiData;
}

const REMINDER_IDS: ReminderIds = {
  ROUND_1: 80001,
  ROUND_2: 120001,
  ROUND_3: 160001,
  ROUND_4: 200001
};

export class ReminderService {
  static async setupRoundReminders(): Promise<void> {
    hilog.info(DOMAIN, TAG, 'Setting up round reminders');

    await ReminderService.createAlarmReminder(8, 0, '第一轮商品刷新', REMINDER_IDS.ROUND_1);
    await ReminderService.createAlarmReminder(12, 0, '第二轮商品刷新', REMINDER_IDS.ROUND_2);
    await ReminderService.createAlarmReminder(16, 0, '第三轮商品刷新', REMINDER_IDS.ROUND_3);
    await ReminderService.createAlarmReminder(20, 0, '第四轮商品刷新', REMINDER_IDS.ROUND_4);

    hilog.info(DOMAIN, TAG, 'All round reminders set up');
  }

  private static async createAlarmReminder(
    hour: number,
    minute: number,
    name: string,
    notificationId: number
  ): Promise<void> {
    try {
      const reminderReq: reminderAgentManager.ReminderRequestAlarm = {
        reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_ALARM,
        hour: hour,
        minute: minute,
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        title: '洛克商人 - ' + name,
        content: '点击查看最新商品信息',
        notificationId: notificationId,
        slotType: notificationManager.SlotType.SERVICE_INFORMATION,
        tapDismissed: true
      };

      await reminderAgentManager.publishReminder(reminderReq);
      hilog.info(DOMAIN, TAG, 'Reminder created: %{public}s at %{public}d:%{public}d', name, hour, minute);
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Create reminder failed: %{public}s', JSON.stringify(err));
    }
  }

  static async cancelAllReminders(): Promise<void> {
    try {
      await reminderAgentManager.cancelAllReminders();
      hilog.info(DOMAIN, TAG, 'All reminders cancelled');
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Cancel reminders failed: %{public}s', JSON.stringify(err));
    }
  }

  static async getValidReminders(): Promise<number> {
    try {
      const reminders = await reminderAgentManager.getValidReminders();
      hilog.info(DOMAIN, TAG, 'Valid reminders count: %{public}d', reminders.length);
      return reminders.length;
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Get reminders failed: %{public}s', JSON.stringify(err));
      return 0;
    }
  }

  static async fetchAndNotify(): Promise<void> {
    hilog.info(DOMAIN, TAG, 'Fetching data and sending notification');

    const apiKey = await StorageUtil.getApiKey();
    if (!apiKey) {
      hilog.warn(DOMAIN, TAG, 'No API key set');
      return;
    }

    try {
      const httpRequest = http.createHttp();
      const response = await httpRequest.request(
        'https://wegame.shallow.ink/api/v1/games/rocom/merchant/info',
        {
          method: http.RequestMethod.GET,
          header: {
            'X-API-Key': apiKey,
            'User-Agent': 'RocoMerchant/1.0'
          },
          readTimeout: 15000,
          connectTimeout: 15000
        }
      );

      if (response.responseCode === 200) {
        const resultStr = typeof response.result === 'string' ? response.result : JSON.stringify(response.result);
        const result: ApiResult = JSON.parse(resultStr);
        if (result.code === 0 && result.data) {
          const activities: MerchantActivity[] = result.data.merchantActivities || [];
          if (activities.length > 0) {
            const activity: MerchantActivity = activities[0];
            const props: MerchantItem[] = activity.get_props || [];
            const pets: MerchantItem[] = activity.get_pets || [];

            let content = '本轮商品：';
            if (props.length > 0) {
              content += props.slice(0, 3).map((p: MerchantItem) => p.name).join('、');
            }
            if (pets.length > 0) {
              content += '，精灵：' + pets.slice(0, 2).map((p: MerchantItem) => p.name).join('、');
            }

            await NotificationUtil.publishProductNotification(
              '洛克商人 - 商品刷新',
              content,
              new Date().getHours() * 100 + new Date().getMinutes()
            );
          }
        }
      }

      httpRequest.destroy();
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Fetch data failed: %{public}s', JSON.stringify(err));
    }
  }
}
