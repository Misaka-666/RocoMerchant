# 洛克商人助手 (RocoMerchant)

鸿蒙版洛克商人助手，用于查看洛克王国远行商人商品信息。

## 功能特性

- 商品数据展示（道具、精灵、额外道具）
- 轮次刷新提醒（08:00 / 12:00 / 16:00 / 20:00）
- API Key 管理
- 沉浸式全屏显示
- 鸿蒙字体支持

## 技术架构

- **框架**：ArkTS / ArkUI
- **架构**：WebView Hybrid
- **前端**：HTML + CSS + JavaScript
- **原生桥接**：JavaScriptProxy

## 项目结构

```
RocoMerchant/
├── AppScope/                          # 应用配置
│   ├── app.json5                      # 应用元数据
│   └── resources/                     # 应用资源
├── entry/                             # 主模块
│   └── src/main/
│       ├── ets/                        # ArkTS 源码
│       │   ├── entryability/           # 入口 Ability
│       │   ├── model/                  # 数据模型
│       │   │   └── JsBridge.ets        # JS Bridge
│       │   ├── pages/                  # 页面
│       │   │   ├── Index.ets           # 主页面（WebView）
│       │   │   └── Settings.ets        # 设置页面
│       │   └── util/                   # 工具类
│       │       ├── NotificationUtil.ets # 通知工具
│       │       └── StorageUtil.ets      # 存储工具
│       └── resources/                  # 资源文件
│           └── rawfile/                # 前端资源
│               ├── index.html          # 主页面
│               ├── app.js              # 业务逻辑
│               ├── style.css           # 样式文件
│               └── ttf/                # 字体文件
├── build-profile.json5                 # 构建配置
└── oh-package.json5                    # 依赖配置
```

## 安装说明

### 方式一：源码构建

1. 克隆项目
   ```bash
   git clone https://github.com/Misaka-666/RocoMerchant.git
   ```

2. 使用 DevEco Studio 打开项目

3. 连接设备或启动模拟器

4. 点击 Run 运行

### 方式二：HAP 安装

1. 从 [Releases](https://github.com/Misaka-666/RocoMerchant/releases) 下载 `RocoMerchant.hap`

2. 使用 hdc 安装
   ```bash
   hdc install RocoMerchant.hap
   ```

## 使用说明

1. 启动应用后，点击"前往设置"
2. 输入你的 ROCOM API Key
3. 点击保存
4. 返回主页面，商品数据将自动加载

## 配置说明

### API Key

应用需要 ROCOM API Key 才能获取商品数据。请前往 [ROCOM 官网](https://rocom.cn) 申请。

### 通知权限

应用需要通知权限才能在商品刷新时发送提醒。首次启动时会请求权限授权。

## 开发说明

### 构建命令

```bash
# Debug 构建
hvigorw --mode project assembleApp -p buildMode=debug

# Release 构建
hvigorw --mode project assembleApp -p buildMode=release
```

### 主要依赖

- `@kit.ArkUI`：ArkUI 组件库
- `@kit.NetworkKit`：网络请求
- `@kit.NotificationKit`：通知管理
- `@kit.BackgroundTasksKit`：后台任务
- `@ohos.web.webview`：WebView 组件

## 版本历史

### v1.0.0 (2026-06-18)

- 初始版本
- WebView 混合架构
- 商品数据展示
- API Key 管理
- 沉浸式全屏显示

## 许可证

MIT License

## 作者

Misaka-666

## 链接

- [GitHub 仓库](https://github.com/Misaka-666/RocoMerchant)
- [Releases](https://github.com/Misaka-666/RocoMerchant/releases)
