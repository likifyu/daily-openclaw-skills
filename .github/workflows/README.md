# 每日 OpenClaw 技能推送服务

## 功能说明

每天北京时间 10:00 自动发送 OpenClaw 相关的高评分技能项目到飞书群。

## 部署步骤

### 1. Fork 或上传此仓库到 GitHub

### 2. 配置 GitHub Secrets

在仓库的 `Settings` -> `Secrets and variables` -> `Actions` 中添加以下 secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `FEISHU_APP_ID` | 飞书应用 ID | `cli_a9c0467200f8dcd0` |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | your_app_secret |
| `FEISHU_CHAT_ID` | 飞书群聊 ID | `oc_5bb33921f628c074107ce5afe5a30132` |

### 3. 启用 GitHub Actions

1. 进入仓库的 `Actions` 标签页
2. 如果看到提示，点击 `I understand my workflows, go ahead and enable them`
3. 选择 `Daily OpenClaw Skills to Feishu` 工作流
4. 点击 `Enable workflow`

### 4. 手动测试

1. 在 Actions 页面选择 `Daily OpenClaw Skills to Feishu`
2. 点击 `Run workflow` -> `Run workflow`
3. 查看运行日志确认是否成功

## 定时任务说明

- **执行时间**: 每天北京时间 10:00 (UTC 02:00)
- **Cron 表达式**: `0 2 * * *`

## 文件结构

```
.
├── .github/
│   └── workflows/
│       └── daily-openclaw-skills.yml  # GitHub Actions 工作流配置
├── scripts/
│   └── send-openclaw-skills.js        # 发送脚本
└── README-DAILY-SKILLS.md             # 本说明文档
```

## 飞书权限要求

确保飞书应用具有以下权限：
- `im:message` - 获取与发送消息
- `im:message:send_as_bot` - 以应用身份发消息

## 自定义技能列表

编辑 `scripts/send-openclaw-skills.js` 中的 `SKILLS_DATA` 数组来修改推送的技能项目。
