import webview from '@ohos.web.webview';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { JsBridge } from '../model/JsBridge';

const DOMAIN = 0x0000;

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  jsBridge: JsBridge = new JsBridge();

  aboutToAppear(): void {
    this.jsBridge.setController(this.controller);
  }

  build() {
    Column() {
      Web({ src: $rawfile('index.html'), controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .mixedMode(MixedMode.All)
        .onPageBegin(() => {
          hilog.info(DOMAIN, 'Index', 'Page begin loading, registering JS bridge');
          this.controller.registerJavaScriptProxy(
            this.jsBridge,
            'AndroidBridge',
            ['getApiKey', 'openSettings', 'fetchApi']
          );
        })
        .onPageEnd(() => {
          hilog.info(DOMAIN, 'Index', 'Page loaded');
        })
    }
    .width('100%')
    .height('100%')
  }
}
