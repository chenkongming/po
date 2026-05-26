# 更新 App Logo

桌面图标**不会**直接读取 `icons/` 目录，需要先同步再打进 APK。

## 正确流程

1. 把最新 logo 放进 `icons/`（至少更新 `icon-512.webp`，其它尺寸可选）
2. 执行：

```bash
npm run generate:icons
npm run build:apk
```

`build:apk` 已自动包含「从 `icons/` 同步 → 生成 Android 图标 → 打包」。

## 目录说明

| 目录 | 作用 |
|------|------|
| `icons/` | 源图（webp），用于 PWA；打包前会同步到 `resources/icon.png` |
| `resources/icon.png` | 由脚本自动生成，勿手改 |
| `android/.../mipmap-*` | Android 桌面图标，由 `generate:icons` 生成 |

若桌面仍显示旧图标：卸载旧 App 后重新安装。
