/**
 * 动态获取AI热门项目并推送到飞书
 * 每日实时抓取 GitHub AI 热榜
 */

const axios = require('axios');

// 配置
const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// AI相关关键词（用于筛选项目）
const AI_KEYWORDS = [
  'ai', 'artificial-intelligence', 'machine-learning', 'deep-learning',
  'llm', 'gpt', 'chatgpt', 'claude', 'openai', 'anthropic',
  'langchain', 'llamaindex', 'transformer', 'neural-network',
  'computer-vision', 'nlp', 'natural-language', 'speech',
  'agent', 'rag', 'embedding', 'vector', 'mcp', 'model-context-protocol',
  'cursor', 'copilot', 'code-assistant', 'ai-code'
];

/**
 * 获取GitHub今日热门项目
 */
async function fetchTrendingRepos() {
  // 查询过去7天stars增长最多的AI相关项目
  const date = new Date();
  date.setDate(date.getDate() - 7);
  const dateStr = date.toISOString().split('T')[0];

  const queries = [
    // AI/LLM 相关
    `ai stars:>500 created:>${dateStr}`,
    `llm stars:>300 pushed:>${dateStr}`,
    `gpt stars:>300 pushed:>${dateStr}`,
    `chatbot stars:>300 pushed:>${dateStr}`,
    `machine-learning stars:>500 pushed:>${dateStr}`,
    // AI工具
    `copilot stars:>200 pushed:>${dateStr}`,
    `code-assistant stars:>200 pushed:>${dateStr}`,
    // MCP相关
    `mcp model-context-protocol stars:>100 pushed:>${dateStr}`,
    // Agent相关
    `agent ai stars:>300 pushed:>${dateStr}`
  ];

  const allRepos = [];

  for (const query of queries) {
    try {
      const response = await axios.get(
        'https://api.github.com/search/repositories',
        {
          params: {
            q: query,
            sort: 'stars',
            order: 'desc',
            per_page: 10
          },
          headers: GITHUB_TOKEN ? {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          } : {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (response.data.items) {
        allRepos.push(...response.data.items);
      }
    } catch (error) {
      console.log(`查询失败 (${query}): ${error.message}`);
    }
  }

  // 去重并排序
  const uniqueRepos = new Map();
  allRepos.forEach(repo => {
    if (!uniqueRepos.has(repo.full_name)) {
      uniqueRepos.set(repo.full_name, repo);
    }
  });

  // 按stars排序，取前10个
  const sortedRepos = Array.from(uniqueRepos.values())
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 10);

  return sortedRepos;
}

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
async function sendFeishuMessage(token, repos) {
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');

  // 构建富文本内容
  const content = {
    zh_cn: {
      title: '🤖 AI 每日热榜',
      content: [
        [
          { tag: 'text', text: '📊 ' },
          { tag: 'text', text: `每日精选 - ${today}` }
        ],
        [{ tag: 'text', text: '' }],
        [{ tag: 'text', text: '🔥 GitHub AI 热门项目（实时）：' }],
        [{ tag: 'text', text: '' }]
      ]
    }
  };

  // 添加每个项目
  repos.forEach((repo, index) => {
    const lang = repo.language || 'Unknown';
    const stars = repo.stargazers_count >= 1000
      ? `${(repo.stargazers_count / 1000).toFixed(1)}k`
      : repo.stargazers_count.toString();

    content.zh_cn.content.push(
      [{ tag: 'text', text: `${index + 1}. ${repo.name}` }],
      [{ tag: 'text', text: `   📦 ${repo.full_name}` }],
      [{ tag: 'text', text: `   ⭐ ${stars} stars  |  💻 ${lang}` }],
      [{ tag: 'text', text: `   📝 ${repo.description || '暂无描述'}` }],
      [{ tag: 'text', text: `   🔗 ${repo.html_url}` }],
      [{ tag: 'text', text: '' }]
    );
  });

  // 添加底部信息
  content.zh_cn.content.push(
    [{ tag: 'text', text: '─────────────' }],
    [{ tag: 'text', text: '💡 数据来源：GitHub API（实时）' }],
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
    console.log('🤖 AI 每日热榜推送开始...');
    console.log('');

    // 检查环境变量
    console.log('检查环境变量...');
    console.log('FEISHU_APP_ID:', FEISHU_APP_ID ? '✅ 已设置' : '❌ 未设置');
    console.log('FEISHU_APP_SECRET:', FEISHU_APP_SECRET ? '✅ 已设置' : '❌ 未设置');
    console.log('FEISHU_CHAT_ID:', FEISHU_CHAT_ID ? '✅ 已设置' : '❌ 未设置');
    console.log('GITHUB_TOKEN:', GITHUB_TOKEN ? '✅ 已设置' : '⚠️ 未设置（将使用匿名访问，有速率限制）');
    console.log('');

    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_CHAT_ID) {
      throw new Error('缺少必要的飞书环境变量配置');
    }

    // 获取热门项目
    console.log('📡 正在获取 GitHub AI 热门项目...');
    const repos = await fetchTrendingRepos();
    console.log(`✅ 获取到 ${repos.length} 个热门项目`);
    console.log('');

    if (repos.length === 0) {
      throw new Error('未获取到任何项目');
    }

    // 显示获取到的项目
    console.log('📋 热门项目列表：');
    repos.forEach((repo, index) => {
      console.log(`   ${index + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`);
    });
    console.log('');

    // 获取飞书token并发送消息
    console.log('🔑 获取飞书访问令牌...');
    const token = await getFeishuToken();
    console.log('✅ 获取令牌成功');

    console.log('📤 发送消息到飞书...');
    const result = await sendFeishuMessage(token, repos);
    console.log('✅ 消息发送成功!');
    console.log('   消息ID:', result.data?.message_id);

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

main();
