import { notificationManager } from '@kit.NotificationKit';
import { common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x0000;
const TAG = 'NotificationUtil';

export class NotificationUtil {
  static async requestPermission(context: common.UIAbilityContext): Promise<boolean> {
    try {
      const enabled = await notificationManager.isNotificationEnabled();
      if (enabled) {
        hilog.info(DOMAIN, TAG, 'Notification already enabled');
        return true;
      }
      await notificationManager.requestEnableNotification(context);
      hilog.info(DOMAIN, TAG, 'Notification permission granted');
      return true;
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Request notification permission failed: %{public}s', JSON.stringify(err));
      return false;
    }
  }

  static async publishProductNotification(
    title: string,
    content: string,
    notificationId: number
  ): Promise<void> {
    try {
      await notificationManager.addSlot(notificationManager.SlotType.SERVICE_INFORMATION);

      const request: notificationManager.NotificationRequest = {
        id: notificationId,
        content: {
          notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
          normal: {
            title: title,
            text: content,
            additionalText: '洛克商人助手'
          }
        },
        notificationSlotType: notificationManager.SlotType.SERVICE_INFORMATION,
        tapDismissed: true,
        autoDeletedTime: new Date().getTime() + 3600000
      };

      await notificationManager.publish(request);
      hilog.info(DOMAIN, TAG, 'Notification published: %{public}s', title);
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Publish notification failed: %{public}s', JSON.stringify(err));
    }
  }

  static async cancelNotification(notificationId: number): Promise<void> {
    try {
      await notificationManager.cancel(notificationId);
      hilog.info(DOMAIN, TAG, 'Notification cancelled: %{public}d', notificationId);
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Cancel notification failed: %{public}s', JSON.stringify(err));
    }
  }

  static async cancelAllNotifications(): Promise<void> {
    try {
      await notificationManager.cancelAll();
      hilog.info(DOMAIN, TAG, 'All notifications cancelled');
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Cancel all notifications failed: %{public}s', JSON.stringify(err));
    }
  }
}
