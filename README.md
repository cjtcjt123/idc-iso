# IDC管理工具（Expo / React Native 移动端）

数据中心（IDC）资产管理移动端 App，基于 Expo SDK 52 / React Native，一份代码同时支持 **iOS** 与 **Android**。

## 功能
- 机房 / 机柜 / 设备 / 库存 / 光配（ODF）浏览与详情
- 机柜 42U 立面图，点设备格跳详情
- 配件管理、客户管理
- 扫码入库（expo-camera）
- 设备上架/下架、物料入库/出库等写入操作
- 后端 API 地址可在 App 内切换（「我的」页顶部图标连点 5 次 → 口令解锁）

## 本地预览
```bash
npm install
npx expo start --web      # 浏览器预览 UI
npx expo start            # 真机用 Expo Go 扫码（需登录同一 Expo 账号）
```

## 构建未签名 iOS IPA（GitHub Actions → TrollStore）
仓库已配置 `.github/workflows/build-ios.yml`：push 到 `master` 分支即在云端 macOS runner
用 `expo prebuild` + `xcodebuild` 生成 **未签名 IPA**，无需 Apple 开发者账号、不占本机磁盘。
- 产物位置：GitHub Actions **Artifacts**（ios-ipa）+ **Releases**（prerelease 资源）
- 安装：iPhone 装 TrollStore → 下载 `.ipa` → TrollStore 打开安装（永久有效，不掉签）
- 仓库未配置签名 Secrets 时自动走未签名分支；配置 `BUILD_CERTIFICATE_BASE64` 等 Secrets 后自动走已签名分支

## 安卓
```bash
eas build --platform android --profile development   # APK，直装
eas build --platform android --profile production     # AAB，上架
```

## 目录
- `src/` 源码（api / auth / components / navigation / screens / theme / config）
- `assets/` 应用图标
- `eas.json` 安卓构建配置
- `.github/workflows/build-ios.yml` iOS 未签名 IPA 云端构建
