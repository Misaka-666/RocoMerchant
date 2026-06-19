# 洛克王国助手 (RocoMerchant)

鸿蒙版洛克王国助手，包含远行商人查询、孵蛋鉴定和精灵图鉴功能。

## 功能特性

### 远行商人
- 商品数据展示（道具、精灵、额外道具）
- 根据北京时间自动计算当前轮次
- 倒计时显示下次刷新时间
- 历史轮次商品查看

### 孵蛋鉴定
- 输入蛋身高和体重反查精灵
- 支持只输入身高或只输入体重
- 显示置信度和体型分类
- 数据自动更新（GitHub Actions 每天爬取）

### 精灵图鉴
- 400 个精灵数据
- 搜索功能（中文名、英文名、编号）
- 18 种属性筛选
- 多种排序方式（编号、种族值、名称）
- 卡片网格展示（图片、名称、属性、种族值）

### 其他
- 底部导航栏切换功能
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
├── entry/src/main/
│   ├── ets/
│   │   ├── entryability/EntryAbility.ets  # 入口 Ability
│   │   ├── model/JsBridge.ets             # JS Bridge
│   │   └── pages/Index.ets                # 主页面
│   └── resources/rawfile/
│       ├── index.html                     # 主页面
│       ├── app.js                         # 业务逻辑
│       ├── egg-data.js                    # 孵蛋数据（嵌入）
│       ├── pokedex-data.js                # 图鉴数据（嵌入）
│       ├── style.css                      # 样式文件
│       └── ttf/                           # 鸿蒙字体
├── .github/
│   ├── scripts/fetch-egg-data.js          # 数据爬虫
│   └── workflows/update-egg-data.yml      # 自动更新工作流
└── egg-data-versioned.json                # 版本化蛋数据
```

## 数据来源

| 功能 | 数据源 | 更新方式 |
|------|--------|----------|
| 远行商人 | rocokingdomworld.org/data/merchant.json | 实时获取 |
| 孵蛋鉴定 | rocokingdomworld.org/zh/egg-groups | GitHub Actions 每天自动爬取 |
| 精灵图鉴 | rocokingdomworld.org/zh/pokedex | 嵌入数据 |

## 安装说明

### 方式一：HAP 安装

1. 从 [Releases](https://github.com/Misaka-666/RocoMerchant/releases) 下载 `RocoMerchant.hap`
2. 使用 hdc 安装
   ```bash
   hdc install RocoMerchant.hap
   ```

### 方式二：源码构建

1. 克隆项目
   ```bash
   git clone https://github.com/Misaka-666/RocoMerchant.git
   ```
2. 使用 DevEco Studio 打开项目
3. 连接设备或启动模拟器
4. 点击 Run 运行

## 使用说明

### 远行商人
- 启动应用后自动加载当前轮次商品
- 显示当前轮次、倒计时、在售商品
- 底部可查看历史轮次商品

### 孵蛋鉴定
- 点击底部"孵蛋鉴定"切换页面
- 输入蛋的身高（米）和/或体重（kg）
- 点击"鉴定"查看匹配的精灵

### 精灵图鉴
- 点击底部"精灵图鉴"切换页面
- 使用搜索框搜索精灵（支持中文名、英文名、编号）
- 点击属性按钮筛选特定属性的精灵
- 使用排序下拉框选择排序方式

## 开发说明

### 构建命令

```bash
# Debug 构建
hvigorw --mode project assembleApp -p buildMode=debug

# Release 构建
hvigorw --mode project assembleApp -p buildMode=release
```

### 更新数据

蛋数据通过 GitHub Actions 自动更新：
- 每天北京时间 08:00 自动运行
- 也可在 GitHub 手动触发：Actions → Update Egg Data → Run workflow

## 版本历史

### v1.3.0 (2026-06-19)

- 新增精灵图鉴功能（400 个精灵）
- 搜索、属性筛选、排序功能
- 三列卡片网格布局

### v1.2.0 (2026-06-19)

- 新增孵蛋鉴定功能
- 底部导航栏切换
- 蛋数据自动更新（GitHub Actions）
- 清理无用代码

### v1.1.0 (2026-06-19)

- 更换数据源为 rocokingdomworld.org
- 无需 API Key
- 根据北京时间自动计算轮次

### v1.0.0 (2026-06-18)

- 初始版本
- WebView 混合架构
- 远行商人商品展示

## 许可证

MIT License

## 作者

Misaka-666

## 链接

- [GitHub 仓库](https://github.com/Misaka-666/RocoMerchant)
- [Releases](https://github.com/Misaka-666/RocoMerchant/releases)
