import webview from '@ohos.web.webview';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { JsBridge } from '../model/JsBridge';

const DOMAIN = 0x0000;

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  jsBridge: JsBridge = new JsBridge();
  methodList: string[] = ['fetchApi', 'notifyDetailOpen', 'notifyDetailClose'];
  isDetailOpen: boolean = false;

  aboutToAppear(): void {
    this.jsBridge.setController(this.controller);
    this.jsBridge.setOnDetailStateChange((isOpen: boolean) => {
      this.isDetailOpen = isOpen;
      hilog.info(DOMAIN, 'Index', 'Detail state changed: %{public}s', isOpen ? 'open' : 'closed');
    });
  }

  onBackPress(): boolean {
    hilog.info(DOMAIN, 'Index', 'onBackPress, isDetailOpen: %{public}s', this.isDetailOpen ? 'true' : 'false');
    if (this.isDetailOpen) {
      this.controller.runJavaScript('closePokedexDetail()');
      return true;
    }
    return false;
  }

  build() {
    Column() {
      Web({ src: $rawfile('index.html'), controller: this.controller })
        .width('100%')
        .height('100%')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .mixedMode(MixedMode.All)
        .javaScriptProxy({
          object: this.jsBridge,
          name: 'AndroidBridge',
          methodList: this.methodList,
          controller: this.controller
        })
        .onPageEnd(() => {
          hilog.info(DOMAIN, 'Index', 'Page loaded successfully');
        })
    }
    .width('100%')
    .height('100%')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
  }
}
