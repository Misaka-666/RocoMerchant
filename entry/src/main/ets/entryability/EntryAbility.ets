import { AbilityConstant, ConfigurationConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { StorageUtil } from '../util/StorageUtil';
import { NotificationUtil } from '../util/NotificationUtil';
import { ReminderService } from '../service/ReminderService';

const DOMAIN = 0x0000;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    try {
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    } catch (err) {
      hilog.error(DOMAIN, 'EntryAbility', 'Failed to set colorMode. Cause: %{public}s', JSON.stringify(err));
    }
    StorageUtil.init(this.context);
    hilog.info(DOMAIN, 'EntryAbility', '%{public}s', 'Ability onCreate');
  }

  onDestroy(): void {
    hilog.info(DOMAIN, 'EntryAbility', '%{public}s', 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    hilog.info(DOMAIN, 'EntryAbility', '%{public}s', 'Ability onWindowStageCreate');

    this.setImmersiveMode(windowStage);

    windowStage.loadContent('pages/Index', (err) => {
      if (err && err.code) {
        hilog.error(DOMAIN, 'EntryAbility', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, 'EntryAbility', 'Succeeded in loading the content.');
    });
  }

  onWindowStageDestroy(): void {
    hilog.info(DOMAIN, 'EntryAbility', '%{public}s', 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    hilog.info(DOMAIN, 'EntryAbility', '%{public}s', 'Ability onForeground');
    this.initNotification();
  }

  onBackground(): void {
    hilog.info(DOMAIN, 'EntryAbility', '%{public}s', 'Ability onBackground');
  }

  private setImmersiveMode(windowStage: window.WindowStage): void {
    try {
      const windowClass: window.Window = windowStage.getMainWindowSync();

      windowClass.setWindowLayoutFullScreen(true);

      windowClass.setWindowSystemBarProperties({
        statusBarColor: '#00000000',
        navigationBarColor: '#00000000',
        statusBarContentColor: '#000000',
        navigationBarContentColor: '#000000'
      });

      AppStorage.setOrCreate('statusBarHeight', 0);
      AppStorage.setOrCreate('navigationBarHeight', 0);

      hilog.info(DOMAIN, 'EntryAbility', 'Immersive mode set successfully');
    } catch (err) {
      hilog.error(DOMAIN, 'EntryAbility', 'Failed to set immersive mode: %{public}s', JSON.stringify(err));
    }
  }

  private async initNotification(): Promise<void> {
    hilog.info(DOMAIN, 'EntryAbility', 'Initializing notification');

    const enabled = await NotificationUtil.requestPermission(this.context);
    if (enabled) {
      await ReminderService.setupRoundReminders();
      hilog.info(DOMAIN, 'EntryAbility', 'Notification initialized successfully');
    } else {
      hilog.warn(DOMAIN, 'EntryAbility', 'Notification permission not granted');
    }
  }
}
