import { router } from '@kit.ArkUI';
import { promptAction } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { StorageUtil } from '../util/StorageUtil';

const DOMAIN = 0x0000;

@Entry
@Component
struct Settings {
  @State apiKey: string = '';

  async aboutToAppear(): Promise<void> {
    this.apiKey = await StorageUtil.getApiKey();
    hilog.info(DOMAIN, 'Settings', 'API key loaded, length: %{public}d', this.apiKey.length);
  }

  build() {
    Column() {
      Text('设置')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .margin({ bottom: 24 })

      Text('API Key')
        .fontSize(16)
        .margin({ bottom: 8 })
        .alignSelf(ItemAlign.Start)

      TextInput({ text: this.apiKey, placeholder: '请输入你的 ROCOM API Key' })
        .onChange((value: string) => {
          this.apiKey = value;
        })
        .width('100%')
        .height(48)

      Button('保存')
        .onClick(async () => {
          await StorageUtil.saveApiKey(this.apiKey.trim());
          promptAction.showToast({ message: '已保存' });
          router.back();
        })
        .width('100%')
        .height(48)
        .margin({ top: 24 })
    }
    .padding(24)
    .width('100%')
    .height('100%')
    .backgroundColor('#ece3d3')
  }
}
