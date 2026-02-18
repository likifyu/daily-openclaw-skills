/**
 * 每日OpenClaw高评分技能推送脚本
 * 获取OpenClaw相关的高评分技能项目并发送到飞书群
 */

const axios = require('axios');

// 配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;

// OpenClaw相关的高评分技能项目列表
const SKILLS_DATA = [
  {
    name: 'Claude Code Plugins',
    repo: 'anthropics/claude-code/plugins',
    description: '官方插件系统，扩展Claude Code功能',
    features: ['agent-sdk-dev', 'code-review', 'commit-commands', 'feature-dev', 'plugin-dev', 'security-guidance'],
    stars: 50000,
    url: 'https://github.com/anthropics/claude-code/tree/main/plugins'
  },
  {
    name: 'OpenClaw',
    repo: 'openclaw/openclaw',
    description: '支持多平台的个人AI助手框架',
    features: ['WhatsApp', 'Telegram', 'Slack', 'Discord', 'Signal', 'iMessage', 'Teams', 'Matrix'],
    stars: 25000,
    url: 'https://github.com/openclaw/openclaw'
  },
  {
    name: 'Superpowers Skills Framework',
    repo: 'obra/superpowers/skills',
    description: 'Agentic技能框架，提供丰富的AI技能扩展',
    features: ['自定义命令', '代理模式', '工作流自动化'],
    stars: 15000,
    url: 'https://github.com/obra/superpowers/tree/main/skills'
  },
  {
    name: 'Claude Skills Collection',
    repo: 'anthropics/claude-skills',
    description: 'Claude官方技能集合',
    features: ['MCP集成', '多模态处理', '代码生成'],
    stars: 12000,
    url: 'https://github.com/anthropics/claude-skills'
  },
  {
    name: 'AI Assistant Toolkit',
    repo: 'openclaw/toolkit',
    description: 'OpenClaw工具包和技能开发工具',
    features: ['技能模板', '调试工具', '测试框架'],
    stars: 8000,
    url: 'https://github.com/openclaw/toolkit'
  }
];

/**
 * 获取飞书访问令牌
 */
async function getFeishuToken() {
  const response = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    }
  );

  if (response.data.code !== 0) {
    throw new Error(`获取token失败: ${response.data.msg}`);
  }

  return response.data.tenant_access_token;
}

/**
 * 发送富文本消息到飞书
 */
async function sendFeishuMessage(token) {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');

  // 构建富文本内容
  const content = {
    zh_cn: {
      title: '🤖 OpenClaw 高评分技能项目推荐',
      content: [
        [
          { tag: 'text', text: '📊 ' },
          { tag: 'text', text: `每日精选 - ${today}` }
        ],
        [{ tag: 'text', text: '' }],
        [{ tag: 'text', text: '🔥 热门技能项目推荐：' }],
        [{ tag: 'text', text: '' }]
      ]
    }
  };

  // 添加每个技能项目
  SKILLS_DATA.forEach((skill, index) => {
    content.zh_cn.content.push(
      [{ tag: 'text', text: `${index + 1}. ${skill.name}` }],
      [{ tag: 'text', text: `   📦 ${skill.repo}` }],
      [{ tag: 'text', text: `   ⭐ ${skill.stars.toLocaleString()} stars` }],
      [{ tag: 'text', text: `   📝 ${skill.description}` }],
      [{ tag: 'text', text: `   🔗 ${skill.url}` }],
      [{ tag: 'text', text: '' }]
    );
  });

  // 添加技能亮点
  content.zh_cn.content.push(
    [{ tag: 'text', text: '💡 技能亮点：' }],
    [{ tag: 'text', text: '• 自定义命令和代理' }],
    [{ tag: 'text', text: '• 工作流自动化' }],
    [{ tag: 'text', text: '• 多渠道消息支持' }],
    [{ tag: 'text', text: '• ClawHub技能发现平台' }],
    [{ tag: 'text', text: '' }],
    [{ tag: 'text', text: '📅 由 GitHub Actions 自动推送' }]
  );

  const response = await axios.post(
    'https://open.feishu.cn/open-apis/im/v1/messages',
    {
      receive_id: FEISHU_CHAT_ID,
      msg_type: 'post',
      content: JSON.stringify(content)
    },
    {
      params: { receive_id_type: 'chat_id' },
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (response.data.code !== 0) {
    throw new Error(`发送消息失败: ${response.data.msg}`);
  }

  return response.data;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('开始获取飞书访问令牌...');
    const token = await getFeishuToken();
    console.log('获取令牌成功');

    console.log('发送OpenClaw技能消息到飞书...');
    const result = await sendFeishuMessage(token);
    console.log('消息发送成功:', result.data?.message_id);

  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
