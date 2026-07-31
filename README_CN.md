# Anki Sender

一键将 Obsidian 中选中的文本发送到 Anki。支持单个和批量发送、自动词根标记、发音音频。

## 功能特性

- **单个发送**：选中文本 → 右键 → "Send to Anki"（或 `Ctrl+Shift+A`）
- **批量发送**：打开结构化词汇笔记 → `Ctrl+Shift+B` → 选择条目 → 一键发送
- **自动词根检测**：从单词构成行提取词源词根，自动填写 Anki 标签
- **发音音频**（可选）：从 Merriam-Webster API 获取发音，存储在 Anki 中，渲染播放按钮
- **Markdown → HTML 转换**：支持粗体、斜体、高亮、表格、列表、Wiki 链接等
- **自动创建卡组**：如果目标卡组不存在，自动创建
- **防重复**：不会重复添加相同的卡片

## 环境要求

1. **Anki** 桌面应用运行中
2. **AnkiConnect** 插件已安装在 Anki 中（插件代码：`2055492159`）
3. **Obsidian** 桌面版（v0.15.0+）

### 安装 AnkiConnect

1. 打开 Anki → 工具 → 插件 → 获取插件
2. 输入代码：`2055492159`
3. 重启 Anki

## 安装方式

### 从 Obsidian 社区插件安装（推荐）

1. 打开 Obsidian → 设置 → 第三方插件 → 浏览
2. 搜索 "Anki Sender"
3. 安装 → 启用

### 通过 BRAT 手动安装

1. 安装 [BRAT 插件](https://obsidian.md/plugins?id=obsidian42-brat)
2. BRAT → 添加 Beta 插件 → 输入 GitHub 地址：`https://github.com/sundaying0/anki-sender`

## 使用方法

### 单个发送

```
在编辑器中选中文本 → 右键 → "Send to Anki"
    ↓
确认弹窗：词根标签（自动填写）+ 来源（自动填写）
    ↓
点击 "Send" → 看到 "✅ Sent to [Deck Name]"
    ↓
切换到 Anki → 浏览卡片，或选中关键词 → Ctrl+U（下划线）进行主动回忆
```

### 批量发送

```
打开带有 ### N. 格式条目的笔记 → 按 Ctrl+Shift+B
    ↓
弹窗列出所有条目，默认全选
    ↓
点击 "Send N entries" → 进度指示 "⏳ Sending 3/27"
    ↓
完成 → "✅ Batch complete: 25 sent, 2 duplicates skipped"
```

## 配置选项

设置 → 第三方插件 → Anki Sender → 齿轮图标

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| Deck name | `新思维词汇` | 目标 Anki 卡组 |
| Model type | `XXHK - 划线` | Anki 笔记模板 |
| Global tags | （空） | 添加到每张卡片的标签 |
| Pronunciation | 关闭 | 从 Merriam-Webster 获取音频 |
| Dictionary API Key | （空） | 发音功能需要此密钥 |
| AnkiConnect URL | `http://localhost:8765` | AnkiConnect 端点 |

## 快捷键

| 操作 | 默认快捷键 |
|------|-----------|
| 发送到 Anki | `Ctrl+Shift+A` |
| 批量发送到 Anki | `Ctrl+Shift+B` |

可在 设置 → 快捷键 中自定义（搜索 "Anki"）。

## 网络访问

此插件访问以下服务：

- **AnkiConnect** (`localhost:8765`)：本地 HTTP API，用于与 Anki 通信。数据不会离开你的电脑。
- **Merriam-Webster Dictionary API**（可选）：下载单词发音音频。需要免费 API 密钥（每天 1000 次请求）。仅在设置中启用发音功能时访问。

## 工作原理

```
Obsidian 插件
    │  HTTP POST (JSON)
    │  localhost:8765
    ↓
AnkiConnect (Anki 插件)
    ↓
Anki 数据库
```

插件通过本地运行的 AnkiConnect HTTP API 将卡片发送到 Anki。所有通信都在你的电脑上完成。

## 许可证

[MIT](LICENSE)
