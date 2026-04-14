/**
 * 动态获取AI热门项目并推送到飞书
 * 每日实时抓取 GitHub AI 热榜
 * 包含：AI热榜 + OpenClaw工具 + Claude Code项目
 */

const axios = require('axios');

// 配置 - 优致科技应用
const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a9c0467200f8dcd0';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'UNZtnQQAtgT3qxdoDMcVwhz44e3W7qXS';
const FEISHU_CHAT_ID = process.env.FEISHU_CHAT_ID || 'oc_5bb33921f628c074107ce5afe5a30132';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// 动态计算日期（确保每天内容不同）
const now = new Date();
const daysAgo = (n) => {
  const d = new Date(now.getTime() - n * 86400000);
  return d.toISOString().split('T')[0];
};

// 查询配置 - 使用日期过滤 + 随机排序，确保每天内容不同
const QUERIES_CONFIG = {
  // 🔥 AI 热门项目 - 最近7天有更新的高星项目
  ai: [
    `ai OR llm OR chatbot pushed:>${daysAgo(7)} stars:>200 sort:stars`,
    `machine-learning OR deep-learning created:>${daysAgo(30)} sort:stars`
  ],
  // 🛠️ OpenClaw 推荐 - 最近活跃的工具项目
  openclaw: [
    `windows-tool OR desktop-app OR browser-automation pushed:>${daysAgo(14)} stars:>100 sort:stars`,
    `web-scraping OR automation pushed:>${daysAgo(7)} stars:>50 sort:stars`
  ],
  // 💜 Claude Code 相关 - 最近活跃的AI编码项目
  claudeCode: [
    `claude-code OR cline OR cursor OR ai-coding pushed:>${daysAgo(14)} stars:>30 sort:stars`,
    `ai-agent OR ai-assistant created:>${daysAgo(30)} stars:>100 sort:stars`
  ],
  // 🧩 Skills & MCP Servers - 最新活跃项目
  skillsMcp: [
    `mcp-server OR modelcontextprotocol pushed:>${daysAgo(14)} sort:stars`,
    `claude-skills OR ai-skills OR mcp pushed:>${daysAgo(7)} sort:stars`
  ]
};

// 不再使用硬编码备用数据，强制从 API 获取实时数据
// 如果 API 失败，将抛出错误提醒检查 GITHUB_TOKEN 配置

/**
 * 通用查询函数
 */
async function searchRepos(queries, maxResults = 5) {
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
      // 避免 API 速率限制，增加间隔到 1.5 秒
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.log(`查询失败 (${query}): ${error.message}`);
    }
  }

  // 去重
  const uniqueRepos = new Map();
  allRepos.forEach(repo => {
    if (!uniqueRepos.has(repo.full_name)) {
      uniqueRepos.set(repo.full_name, repo);
    }
  });

  // 先按stars降序排序，再随机打乱前N个（避免每天结果完全一样）
  const sorted = Array.from(uniqueRepos.values())
    .sort((a, b) => b.stargazers_count - a.stargazers_count);

  // 取前 maxResults*2 个候选，再随机抽取 maxResults 个
  const candidates = sorted.slice(0, maxResults * 2);
  const shuffled = candidates.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxResults);
}

/**
 * 获取所有类别的热门项目
 */
async function fetchAllTrendingRepos() {
  console.log('📡 正在获取 AI 热门项目...');
  const aiRepos = await searchRepos(QUERIES_CONFIG.ai, 6);
  if (aiRepos.length === 0) {
    throw new Error('❌ 无法获取 AI 项目数据，请检查 GITHUB_TOKEN 配置');
  }
  console.log(`   ✅ AI 项目: ${aiRepos.length} 个`);

  console.log('📡 正在获取 OpenClaw Windows 工具（含数据抓取、浏览器自动化）...');
  const openclawRepos = await searchRepos(QUERIES_CONFIG.openclaw, 6);
  if (openclawRepos.length === 0) {
    throw new Error('❌ 无法获取 OpenClaw 工具数据，请检查 GITHUB_TOKEN 配置');
  }
  console.log(`   ✅ OpenClaw 工具: ${openclawRepos.length} 个`);

  console.log('📡 正在获取 Claude Code 相关项目...');
  const claudeCodeRepos = await searchRepos(QUERIES_CONFIG.claudeCode, 5);
  if (claudeCodeRepos.length === 0) {
    throw new Error('❌ 无法获取 Claude Code 项目数据，请检查 GITHUB_TOKEN 配置');
  }
  console.log(`   ✅ Claude Code 项目: ${claudeCodeRepos.length} 个`);

  console.log('📡 正在获取 Skills & MCP Servers...');
  const skillsMcpRepos = await searchRepos(QUERIES_CONFIG.skillsMcp, 5);
  // Skills & MCP 允许为空，不影响整体推送
  console.log(`   ✅ Skills & MCP: ${skillsMcpRepos.length} 个`);

  return {
    ai: aiRepos,
    openclaw: openclawRepos,
    claudeCode: claudeCodeRepos,
    skillsMcp: skillsMcpRepos
  };
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
 * 添加项目到内容列表
 */
function addProjectToContent(content, repo, index) {
  const lang = repo.language || 'Unknown';
  const stars = repo.stargazers_count >= 1000
    ? `${(repo.stargazers_count / 1000).toFixed(1)}k`
    : repo.stargazers_count.toString();

  content.push(
    [{ tag: 'text', text: `${index + 1}. ${repo.name}` }],
    [{ tag: 'text', text: `   📦 ${repo.full_name}` }],
    [{ tag: 'text', text: `   ⭐ ${stars} stars  |  💻 ${lang}` }],
    [{ tag: 'text', text: `   📝 ${repo.description || '暂无描述'}` }],
    [{ tag: 'text', text: `   🔗 ${repo.html_url}` }],
    [{ tag: 'text', text: '' }]
  );
}

/**
 * 发送富文本消息到飞书
 */
async function sendFeishuMessage(token, { ai, openclaw, claudeCode, skillsMcp }) {
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
          { tag: 'text', text: `每日精选 - ${today}（近7天活跃项目）` }
        ],
        [{ tag: 'text', text: '' }],
        [{ tag: 'text', text: '🔥 GitHub AI 热门项目（近7天活跃）：' }],
        [{ tag: 'text', text: '' }]
      ]
    }
  };

  // 添加AI热门项目
  ai.forEach((repo, index) => {
    addProjectToContent(content.zh_cn.content, repo, index);
  });

  // 添加 OpenClaw 推荐工具板块
  content.zh_cn.content.push(
    [{ tag: 'text', text: '─────────────' }],
    [{ tag: 'text', text: '' }],
    [{ tag: 'text', text: '🛠️ OpenClaw 推荐 - 近期活跃工具项目：' }],
    [{ tag: 'text', text: '' }]
  );

  openclaw.forEach((repo, index) => {
    addProjectToContent(content.zh_cn.content, repo, index);
  });

  // 添加 Claude Code 相关项目板块
  content.zh_cn.content.push(
    [{ tag: 'text', text: '─────────────' }],
    [{ tag: 'text', text: '' }],
    [{ tag: 'text', text: '💜 Claude Code 相关开源项目（近期活跃）：' }],
    [{ tag: 'text', text: '' }]
  );

  claudeCode.forEach((repo, index) => {
    addProjectToContent(content.zh_cn.content, repo, index);
  });

  // 添加底部信息
  content.zh_cn.content.push(
    [{ tag: 'text', text: '─────────────' }],
    [{ tag: 'text', text: '' }],
    [{ tag: 'text', text: '🧩 Skills & MCP Servers（近14天活跃）：' }],
    [{ tag: 'text', text: '' }]
  );

  // 添加 Skills & MCP 项目
  skillsMcp.forEach((repo, index) => {
    addProjectToContent(content.zh_cn.content, repo, index);
  });

  // 添加底部信息
  content.zh_cn.content.push(
    [{ tag: 'text', text: '─────────────' }],
    [{ tag: 'text', text: '💡 数据来源：GitHub API（实时抓取）' }],
    [{ tag: 'text', text: '📅 由 GitHub Actions 自动推送' }]
  );

  let response;
  try {
    response = await axios.post(
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
  } catch (error) {
    console.log('❌ 请求失败详情:');
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应数据:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('错误信息:', error.message);
    }
    throw error;
  }

  console.log('📤 发送消息响应:', JSON.stringify(response.data, null, 2));

  if (response.data.code !== 0) {
    throw new Error(`发送消息失败: code=${response.data.code}, msg=${response.data.msg}`);
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

    // 获取所有类别的热门项目
    const allRepos = await fetchAllTrendingRepos();
    console.log('');

    const totalCount = allRepos.ai.length + allRepos.openclaw.length + allRepos.claudeCode.length + allRepos.skillsMcp.length;
    if (totalCount === 0) {
      throw new Error('未获取到任何项目');
    }

    // 显示获取到的项目
    console.log('📋 热门项目汇总：');
    console.log(`   AI 项目: ${allRepos.ai.length} 个`);
    allRepos.ai.forEach((repo, i) => console.log(`      ${i + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`));

    console.log(`   OpenClaw 工具: ${allRepos.openclaw.length} 个`);
    allRepos.openclaw.forEach((repo, i) => console.log(`      ${i + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`));

    console.log(`   Claude Code 项目: ${allRepos.claudeCode.length} 个`);
    allRepos.claudeCode.forEach((repo, i) => console.log(`      ${i + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`));

    console.log(`   Skills & MCP: ${allRepos.skillsMcp.length} 个`);
    allRepos.skillsMcp.forEach((repo, i) => console.log(`      ${i + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`));

    console.log('');

    // 显示获取到的项目
    console.log('📋 热门项目汇总：');
    console.log(`   AI 项目: ${allRepos.ai.length} 个`);
    allRepos.ai.forEach((repo, i) => console.log(`      ${i + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`));

    console.log(`   OpenClaw 工具: ${allRepos.openclaw.length} 个`);
    allRepos.openclaw.forEach((repo, i) => console.log(`      ${i + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`));

    console.log(`   Claude Code 项目: ${allRepos.claudeCode.length} 个`);
    allRepos.claudeCode.forEach((repo, i) => console.log(`      ${i + 1}. ${repo.full_name} (⭐${repo.stargazers_count})`));
    console.log('');

    // 获取飞书token并发送消息
    console.log('🔑 获取飞书访问令牌...');
    const token = await getFeishuToken();
    console.log('✅ 获取令牌成功');

    console.log('📤 发送消息到飞书...');
    const result = await sendFeishuMessage(token, allRepos);
    console.log('✅ 消息发送成功!');
    console.log('   消息ID:', result.data?.message_id);

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

main();
