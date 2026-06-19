import webview from '@ohos.web.webview';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { JsBridge } from '../model/JsBridge';

const DOMAIN = 0x0000;

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  jsBridge: JsBridge = new JsBridge();
  methodList: string[] = ['fetchApi'];

  aboutToAppear(): void {
    this.jsBridge.setController(this.controller);
  }

  onBackPress(): boolean {
    this.controller.runJavaScript('isDetailOpen()').then((result: string) => {
      hilog.info(DOMAIN, 'Index', 'isDetailOpen result: %{public}s', result);
      if (result === 'true') {
        this.controller.runJavaScript('closePokedexDetail()');
      } else {
        this.controller.backward();
      }
    }).catch((err: Error) => {
      hilog.error(DOMAIN, 'Index', 'isDetailOpen error: %{public}s', err.message);
    });
    return true;
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
