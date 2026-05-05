// ===== 数据层 + Prompt 架构 =====
// ===== part2_data.js（Issue #1 #2 #3 #9 #10 修复版） =====
// CASES 对象已删除；buildSystemPrompt 改为动态注入


// ===== 故事创作函数：用CASES_DNA组装成DOCX风格爆款脚本 =====
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// DOCX风格开场库（深度训练版v4 · 全量提取自19条爆款短视频）

// DOCX风格揭示库——深度训练版v4（全量提取自19条爆款）

// DOCX风格收尾库——深度训练版v4（全量提取自19条爆款 · 说完金句就停）

function getDNAKey(topicName) {
  const map = {"焦虑":"anxiety","失眠":"insomnia","叛逆":"rebellion","赚不到钱":"money","讨好":"people_pleaser","上瘾":"addiction","关系差":"relationship","恐惧":"fear","出轨":"relationship","孩子自伤":"self_harm","抑郁":"depression","控制不住情绪":"anger","亲子关系":"child_relation","原生家庭":"family_of_origin","内耗":"inner_conflict","婚姻":"marriage","考试掉链子":"test_failure","霸凌":"bullying","性取向":"sexuality","身体健康":"health",
    // DOCX爆款扩展
    "家庭内耗":"relationship","老人无德":"family_of_origin","身弱命贵":"body_weak_extra","盲目帮人":"causal_extra","知止":"zhizhi_extra","选伴侣看家风":"family_of_origin","六亲缘浅":"body_weak_extra","家和万事兴":"family_of_origin","因果":"causal_extra"};
  return map[topicName]||null;
}
let lastDNAIdx={};
function pickDNA(key, userProfile){
  const pool=CASES_DNA[key];
  if(!pool||!pool.length)return null;
  if(!userProfile||(!userProfile.gender&&!userProfile.age&&!userProfile.raw)){
    // Fallback: round-robin
    const prev=lastDNAIdx[key]??-1;
    const idx=(prev+1)%pool.length;
    lastDNAIdx[key]=idx;
    return pool[idx];
  }
  // Smart scoring
  const scored=pool.map((c,i)=>{
    let score=Math.random()*5;
    if(userProfile.gender&&c.p&&c.p.g===userProfile.gender)score+=15;
    if(userProfile.age&&c.p&&typeof c.p.a==='string'&&c.p.a.match(/^\d/)){
      const caseAge=parseInt(c.p.a);
      const userAge=parseInt(userProfile.age);
      if(!isNaN(caseAge)&&!isNaN(userAge)){
        score+=Math.max(0,10-Math.abs(caseAge-userAge)/3);
      }
    }
    if(userProfile.raw&&(c.sx||[])){
      for(const sx of c.sx){
        const sub=sx.substring(0,4);
        if(sub.length>=2&&userProfile.raw.includes(sub))score+=8;
      }
    }
    return{case:c,score};
  });
  scored.sort((a,b)=>b.score-a.score);
  return scored[0].case;
}

// ===== 故事创作引擎：用DNA组装成DOCX爆款脚本 =====

// 情感标签映射（共享常量，消除重复）

// 性别代词工具
function pronoun(g, type) {
  const m = {
    '女': { subj:'她', poss:'她的', obj:'她', who:'这个女的', elder:'这位姐姐', youth:'这个姑娘' },
    '男': { subj:'他', poss:'他的', obj:'他', who:'这个男的', elder:'这位大哥', youth:'这个小伙子' },
  };
  return (m[g]||m['女'])[type]||'她';
}

// 清理祖先称谓中的多余代词
function cleanWho(who) {
  // 清理祖先称谓，让它能自然接在"他的/她的"后面
  // 必须先匹配长的（她的/他的），再匹配短的（她/他），否则"他的爷爷"→"的爷爷"
  return who
    .replace(/^(她的|他的|我的|它的|她们的|他们的)/, '')
    .replace(/^(她|他|我|它)/, '')
    .replace(/^(那位|那个|这个|这些|那些|这|那)/, '')
    .replace(/^的/, '')
    .replace(/（.*?）/g, ''); // 去掉括号注释如（案主）
}

// 从用户输入中提取关键信息
function extractUserInfo(text) {
  const info = { raw: text, gender: null, duration: null, keywords: [] };
  if (/老公|丈夫|老婆|妻子|媳妇|婆婆|公公|岳父|岳母|嫁|娶|结婚|孕期|怀孕/.test(text)) info.keywords.push('婚姻相关');
  if (/孩子|儿子|女儿|娃|小儿|宝贝|宝宝/.test(text)) info.keywords.push('亲子相关');
  if (/妈|爸|父母|娘家|婆家/.test(text)) info.keywords.push('原生家庭相关');
  if (/我.*女|我是.*女|本人女|女生|女人|女孩|老婆|老公/.test(text)) {
    if (/老公|丈夫|老婆/.test(text)) info.gender = '女';
  }
  if (/我.*男|我是.*男|本人男|男生|男人|男孩/.test(text)) info.gender = '男';
  const durMatch = text.match(/(\d+)\s*(年|个月|月|天|周|岁|年了|个月了)/);
  if (durMatch) info.duration = durMatch[0];
  return info;
}

// 剥离命令前缀，提取真正的用户意图
function stripCommandPrefix(text) {
  // "生成一个焦虑的脚本" → "焦虑"
  // "帮我写一个关于失眠的内容" → "失眠"
  // "我要一篇亲子关系的文案" → "亲子关系"
  const cleaned = text
    .replace(/^(生成|帮我写|帮我做|我要|我想|写一个|写一篇|做一个|来一个|给我|请帮我|帮我生成|帮我写一个|帮我写一篇)(一篇?|一个|一份?|段|条)?(关于|有关)?/, '')
    .replace(/^(一个|一篇|一份|一段|一条)/, '') // 残留的数量词
    .replace(/^(个|篇|份|段|条)/, '') // 单字残留
    .replace(/的?(脚本|文案|内容|文章|稿子|口播|故事|案例|分析|讲解|视频脚本|口播脚本|爆款).*/, '')
    .replace(/^(然后呢?|接着|再|还有|换个|换一个|重新|再来).*/, '') // 上下文命令保留
    .trim();
  // 如果清理后太短或为空，返回原文
  return cleaned.length >= 1 ? cleaned : text;
}

// 智能截取用户输入——保留有意义的部分，避免截断
function quote(text, maxLen) {
  maxLen = maxLen || 30;
  // 先剥离命令前缀
  const stripped = stripCommandPrefix(text);
  if (stripped.length <= maxLen) return stripped;
  // 在标点或空格处截断
  let cut = stripped.substring(0, maxLen);
  const lastPunc = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('。'), cut.lastIndexOf('、'), cut.lastIndexOf(' '));
  if (lastPunc > maxLen * 0.5) cut = cut.substring(0, lastPunc);
  return cut;
}

// ===== 上下文命令处理（换个案例/再猛一点/换个角度等） =====

function generateContextResponse(text, prevTopic, flags) {
  const key = getDNAKey(prevTopic.name);
  const userProfile = extractUserInfo(text);
  const dd = key ? pickDNA(key, userProfile) : null;
  if (!dd) return generateFallback(text);
  
  const p = dd.p;
  const sub = pronoun(p.g, 'subj');
  const poss = pronoun(p.g, 'poss');
  const age = String(p.a).match(/^\d/) ? p.a+'岁' : p.a;
  const parts = [];
  
  if (flags.isReroll) {
    parts.push('好，给你换一个案例。同一个话题「'+prevTopic.name+'」，不同的故事。');
  } else if (flags.isAngrier) {
    parts.push('行，这个给你来一版更有冲击力的。操盘手就是要能拿捏观众的情绪。');
  } else if (flags.isCalmer) {
    parts.push('好，给你调一版更温和的。');
  } else if (flags.isAngle) {
    parts.push('换个角度讲「'+prevTopic.name+'」，同一个话题有不同的切法。');
  } else if (flags.isShorter) {
    parts.push('精简版来了。');
  } else if (flags.isLonger) {
    parts.push('给你展开讲。');
  }
  
  parts.push(pick([
    '有一个'+p.g+'的，'+dd.city+'的，'+p.j+'，'+age+'。'+dd.sx.join('，')+'。'+sub+'来找我的时候，很崩溃。'+sub+'跟我说：老师我真的没办法了，能试的都试了，就是没用。我问'+sub+'多久了，'+sub+'说好几年了，什么方法都试过，中医西医偏方全试了，没有一个管用的。',
    '曾经有一位'+p.g+'性来访者从'+dd.city+'而来。'+age+'，'+p.j+'。'+sub+'来的时候就是因为'+dd.sx[0]+'。'+(dd.sx.length>1?dd.sx.slice(1).join('，')+'。':'')+'我问'+sub+'多久了，'+sub+'说好几年了，什么方法都试过，就是没用。整个人看上去特别疲惫，眼眶都是黑的，说话的时候声音都在抖。',
    '我有一个学员，'+dd.city+'的，'+p.j+'，'+age+'。'+dd.sx.join('，')+'。'+sub+'来找我的时候说：老师我真的没办法了，能试的都试了。你知道吗，'+sub+'来的时候整个人都蔫了，家里人都觉得'+sub+'有问题，但'+sub+'自己知道那个不对劲是从骨头里来的。',
  ]));
  
  // 祖先故事
  const emo = EMO_MAP[dd.an.emo]||'一辈子放不下这件事';
  parts.push('然后呢，我就问'+sub+'，你上一代呢？'+sub+'沉默了很久，眼眶红了。然后说：'+dd.an.who+'，'+dd.an.what+'。\n\n你想，'+poss+''+cleanWho(dd.an.who)+'，'+emo+'，这些情绪去哪里了？不会消失的。遗忘不代表已经疗愈了，而是走出了时间之外，进入了潜意识。凡是我们的祖先长辈压在潜意识里面，重大的创伤，重大的情绪，没有表达的就会压到他的后代身上。');
  
  parts.push(dd.tr+'\n\n'+pick([
    '我们看到人是共生体，与你共生，与父共生，与家族共生。你以为是你自己的痛苦，其实是某个家族成员未表达的情绪。这个数据一直在运转，你根本不知道。',
    '几代之前长辈们打了一张牌，四到五代之后，这张牌才落下来，基因的承接者都要承担后果的。',
    '父母是因，孩子是果，你让果来解决因的事解决不了的。',
  ]));
  
  parts.push(pick(REVELATIONS)(dd.rv)+'\n\n'+pick([
    '你内在的情绪可能不是你的，是某个家族成员未表达的情绪。先意识到自己的情绪是谁的，再处理。这一步不能跳过。',
    '积之家必有余殃。不是玄学，这是科学。',
  ]));
  
  parts.push(pick([
    '怎么做呢？'+dd.ac+'。在那个画面里面充分地去和解和表达了情绪，大概一个多小时左右。这个过程不轻松，但当你做到了，一切都变了。潜意识疗愈补的不是财库的洞，是家族能量的断层。',
    '我们就陪着'+sub+dd.ac+'。当过去的委屈被看见，当下的生命自然丰盛。',
  ]));
  
  parts.push(pick([
    '击穿了数据回去，'+dd.rs+'。'+dd.rs2,
    '你知道'+sub+'得到的结果吗？'+dd.rs+'。'+dd.rs2,
  ])+'\n\n'+pick([
    sub+'跟我说的时候声音是带着笑的，你能感觉到那种轻盈——不是装出来的，是真的卸下了一座山。当我们疗愈了来自过去的伤痛，就为整个家族，改写了关于幸福的剧本。',
    '这就是击穿数据的力量。先意识到自己的创伤，再慢慢斩断与原生家庭的共生，那你就会真正的实现觉醒。',
  ]));
  
  parts.push(pick(CLOSINGS));
  
  const result = parts.join('\n\n');
  // 不再硬塞金句截断——靠内容自然控制字数
  return result;
}


function generateResponse(text, context) {
  context = context || [];
  
  // ===== 上下文感知命令检测 =====
  const isReroll = /换个案例|换一个|再来一个|重新来|换个故事|不同案例/.test(text);
  const isAngrier = /再猛|再狠|再激烈|更猛|更狠|冲击力|炸裂|爆款/.test(text);
  const isCalmer = /温和|柔和|缓和|温柔|软一点/.test(text);
  const isShorter = /短一点|简短|精简|压缩/.test(text);
  const isLonger = /长一点|详细|展开|深入/.test(text);
  const isAngle = /换个角度|不同角度|另一个角度|换角度/.test(text);
  
  // 从上下文中找到最近的话题
  let prevTopic = null;
  if (context.length >= 2) {
    for (let i = context.length - 2; i >= 0; i--) {
      if (context[i].role === 'user') {
        const pt = detectTopic(context[i].content);
        if (pt) { prevTopic = pt; break; }
      }
    }
  }
  
  // 如果是上下文命令，走专门的处理函数
  if ((isReroll || isAngrier || isCalmer || isShorter || isLonger || isAngle) && prevTopic) {
    return generateContextResponse(text, prevTopic, {isReroll, isAngrier, isCalmer, isShorter, isLonger, isAngle});
  }
  
  // ===== 正常话题检测 =====
  const topic = detectTopic(text);
  if (!topic) {
    // 如果当前消息没识别到话题，试试从上下文继承
    if (prevTopic) {
      return generateResponse('生成一个' + prevTopic.name + '的脚本，具体要求：' + text, context);
    }
    return generateFallback(text);
  }
  const key = getDNAKey(topic.name);
  // 提取用户信息用于智能匹配
  const userInfo = extractUserInfo(text);
  const d = key ? pickDNA(key, userInfo) : null;
  if (!d) return generateFallback(text);

  const p = d.p;
  const sub = pronoun(p.g, 'subj'); // 他/她
  const poss = pronoun(p.g, 'poss'); // 他的/她的
  const age = String(p.a).match(/^\d/) ? p.a+'岁' : p.a;
  const parts = [];

  // ===== 第1步：开场 —— 先回应用户输入 =====
  const userQuote = quote(text, 30);
  // 如果有 hook_hint，优先用它来引导开场方向
  const hookHint = d.hook_hint ? d.hook_hint : '';
  const openers = [
    '你说的「'+userQuote+'」，我听到了。这个事儿我太熟悉了，因为我见过太多类似的情况。',
    '你问的这个问题「'+userQuote+'」——我研究家族系统疗愈20年，可以负责任地告诉你，这件事大概率不是你的问题。',
    '我看到你说「'+userQuote+'」，我心里一紧。因为这种事儿我见过太多了。',
    '你问的「'+userQuote+'」——'+topic.name+'这件事，99%的人都以为是自己的问题，其实不是。',
    '你敢相信吗？你现在经历的「'+userQuote+'」，可能根本不是你的。背后藏着一个家族好几代人的秘密。',
    '我不管你信不信，今天告诉你一个真相——「'+userQuote+'」这件事，大概率不是你的问题。',
    '好多人在问，我有'+topic.name+'的问题，怎么解决？今天我就教大家一个关键点。',
    '千万不要去随便处理'+topic.name+'这件事，因为你只看到一个片段就想出手，往往要承担别人的因果。',
  ];
  // 如果有 hook_hint，追加一个基于感官细节的开场
  if (hookHint && d.sensory && d.sensory.length) {
    openers.push('你敢相信吗？'+d.sensory[0]+'。这不是个案，是很多家庭的缩影。');
    openers.push('我不管你信不信，今天告诉你一个真相——'+hookHint+'。');
  }
  parts.push(pick(openers));

  // ===== 第1.5步：理论钩子（不和开场重复） =====
  const hooks = [
    topic.name+'最大的伤害不是打骂，也不是贬低，而是长期承接着上一代没有表达的那些情绪。',
    '你有没有想过，你现在经历的'+topic.name+'，可能根本不是你的？大部分人还不知道。',
    '什么是'+topic.name+'？我用一个真实的案例来帮你了解。',
    '我告诉你，'+topic.name+'不是你的错，但它是你的功课。三代人同一个模式，这不是巧合，这是代际传承。',
    '大部分'+topic.name+'的人其实都是内在有不知道的牵挂——牵挂着一些人，牵挂的一些事。',
    '几代之前长辈们打了一张牌，四到五代之后这张牌才落下来，基因的承接者都要承担后果的。',
    '我见过太多家庭因为'+topic.name+'的事情搞得鸡飞狗跳，最后发现根源根本不在当事人身上。',
  ];
  // 避免开场和钩子撞车：如果开场已经包含了类似内容，换一个
  let hook = pick(hooks);
  let attempts = 0;
  while (parts[0].includes(hook.substring(0,15)) && attempts < 5) {
    hook = pick(hooks);
    attempts++;
  }
  parts.push(hook);

  // ===== 第2步：引入案例 =====
  // 检查上一段是否已经暗示了要讲故事，避免重复
  const lastPart = parts[parts.length - 1] || '';
  const caseIntros = [
    '来，听我给你讲个真实的案例。',
    '今天我要给你讲一个真实的故事。',
    '我来讲一个我印象特别深的案例。',
    '曾经有一位来访者从外地而来。',
    '这是一个非常震撼的故事。',
  ];
  if (!lastPart.includes('案例') && !lastPart.includes('故事')) {
    parts.push(pick(caseIntros));
  }

  // ===== 第3步：案例详情 —— 性别正确，融合感官细节 =====
  // 构建感官细节补充句
  var sensoryHint = '';
  if (d.sensory && d.sensory.length) {
    sensoryHint = ' '+d.sensory[0]+'。';
  }
  parts.push(pick([
    '有一个'+p.g+'的，'+d.city+'的，'+p.j+'，'+age+'。'+d.sx.join('，')+'。'+sensoryHint+sub+'来找我的时候，很崩溃。'+sub+'跟我说：老师我真的没办法了，能试的都试了，就是没用。我问'+sub+'多久了，'+sub+'说好几年了，什么方法都试过，就是没用。',
    '曾经有一位'+p.g+'性来访者从'+d.city+'而来。'+age+'，'+p.j+'。'+sub+'来的时候就是因为'+d.sx[0]+'。'+(d.sx.length>1?d.sx.slice(1).join('，')+'。':'')+sensoryHint+'我问'+sub+'多久了，'+sub+'说好几年了，什么方法都试过，就是没用。整个人看上去特别疲惫。',
    '我有一个学员，'+d.city+'的，'+p.j+'，'+age+'。'+d.sx.join('，')+'。'+sensoryHint+sub+'来找我的时候说：老师我真的没办法了。'+sub+'来的时候整个人都蔫了，家里人都觉得'+sub+'有问题，但'+sub+'自己知道那个不对劲是从骨头里来的。',
  ]));

  // ===== 第4步：转折 —— 引出祖先故事 =====
  const emo = EMO_MAP[d.an.emo]||'一辈子放不下这件事';

  parts.push(pick([
    '然后呢，我就问'+sub+'，你上一代呢？'+sub+'沉默了很久，眼眶红了。然后说：'+d.an.who+'，'+d.an.what+'。\n\n你想，'+poss+cleanWho(d.an.who)+'，'+emo+'，这些情绪去哪里了？不会消失的。遗忘不代表已经疗愈了，而是走出了时间之外，进入了潜意识。凡是我们的祖先长辈压在潜意识里面，重大的创伤，重大的情绪，没有表达的就会压到他的后代身上。',
    '我就继续问'+poss+'家族史，我说那你上一代呢？\n\n原来'+d.an.who+'，'+d.an.what+'。'+emo+'。我听完以后心里特别沉重。\n\n'+poss+cleanWho(d.an.who)+'，带着这么大的创伤过了一辈子，这些情绪会去哪里？不会消失的。它会进入潜意识数据库，一代一代传下去。',
    sub+'跟我说了一件事，我听完以后特别震撼。\n\n'+sub+'说：'+d.an.who+'，'+d.an.what+'。'+emo+'。\n\n我当时就明白了——这就是代际传承的源头。'+poss+cleanWho(d.an.who)+'，把没有处理的创伤传给了下一代。你知道吗？'+emo+'，一辈子放不下这件事，这些情绪全部传给了后代。',
  ]));

  // ===== 第5步：揭示代际链条 =====
  parts.push(d.tr+'\n\n'+pick([
    '我们看到人是共生体，与你共生，与父共生，与家族共生。你以为是你自己的痛苦，其实是某个家族成员未表达的情绪。这个数据一直在运转，你根本不知道。',
    '几代之前长辈们打了一张牌，四到五代之后，这张牌才落下来，基因的承接者都要承担后果的。我们这个世界是一个整体，每个人发出的力量都在影响着自己，也在影响着周围的人。',
    '父母是因，孩子是果，你让果来解决因的事解决不了的。你以为是自己的问题，其实是上一代的问题。',
    '人的感情也是一种储蓄，每次你这样做的时候看似没改变，是因为量变引起质变。等量到一定程度，关系就完了。',
  ]));

  // ===== 第6步：回到用户的处境 =====
  parts.push(pick([
    '所以你现在明白了吗？你说的「'+quote(text, 25)+'」，很可能不是你的问题，是你的家族在你身上运转的一个模式。',
    '你想想，你跟这个案例像不像？你身上发生的事，跟上一代、上上一代有没有关系？',
    '回到你身上——你现在经历的'+topic.name+'，你去问问你的父母、你的爷爷奶奶，他们有没有类似的经历？',
    '现在你再回头看你自己——你有没有想过，你现在的这些感受，可能在你之前就有人经历过？',
  ]));

  // ===== 第7步：揭示（融合 micro_insights） =====
  const reveal = pick(REVELATIONS)(d.rv);
  // 避免和前面祖先故事重复——检查是否已经说过类似内容
  const revealShort = reveal.substring(0,20);
  const alreadySaid = parts.some(p => p.includes(revealShort));
  if (!alreadySaid) {
    parts.push(reveal);
  }
  // 如果有 micro_insights，随机选1个融入揭示段落
  if (d.micro_insights && d.micro_insights.length) {
    const insight = pick(d.micro_insights);
    parts.push(pick([
      '凡是我们的祖先长辈压在潜意识里面，重大的创伤、重大的情绪，没有表达的就会压到他的后代身上。'+insight+'。你要先意识到这件事，才能真正处理。',
      '你内在的情绪可能不是你的，是某个家族成员未表达的情绪。'+insight+'。先意识到自己的情绪是谁的，再处理。这一步不能跳过。',
      '积之家必有余殃。不是玄学，这是科学。'+insight+'。这是研究家族系统、研究家庭疗愈的人这100年来都很具体了。',
      '关键在于承担痛苦后做出新选择，不再以牙还牙，这时因果就会改变。'+insight+'。能种下善因的人，才是真正的赢家。',
    ]));
  } else {
    parts.push(pick([
      '凡是我们的祖先长辈压在潜意识里面，重大的创伤、重大的情绪，没有表达的就会压到他的后代身上。你要先意识到这件事，才能真正处理。',
      '你内在的情绪可能不是你的，是某个家族成员未表达的情绪。先意识到自己的情绪是谁的，再处理。这一步不能跳过。',
      '积之家必有余殃。不是玄学，这是科学。这是研究家族系统、研究家庭疗愈的人这100年来都很具体了。',
      '我们看到人是共生体，与你共生，与父共生，与家族共生。你以为是你自己的痛苦，其实是某个家族成员未表达的情绪。这个数据一直在运转，你根本不知道。',
      '关键在于承担痛苦后做出新选择，不再以牙还牙，这时因果就会改变。能种下善因的人，才是真正的赢家。',
    ]));
  }

  // ===== 第8步：疗愈方法 =====
  parts.push(pick([
    '怎么做呢？你要回到那个画面，看看是谁把这个数据传给你的，然后在那个画面里面充分地表达出来——恐惧、愤怒、委屈、悲伤，全部表达出来。'+d.ac+'。这个过程不轻松，但当你做到了，一切都变了。',
    '你要做的就是：回到那个画面，充分地表达情绪。'+d.ac+'。当过去的委屈被看见，当下的生命自然丰盛。潜意识疗愈补的不是财库的洞，是家族能量的断层。',
    '击穿了这个数据，你的状态才会真正改变。不是靠意志力去改变行为，是从潜意识层面去疗愈根源。'+d.ac+'。用内化的方法解决外在的现象，工具背后是心性。',
  ]));

  // ===== 第9步：结果 =====
  parts.push(pick([
    '击穿了数据回去，'+d.rs+'。'+d.rs2,
    '你知道'+sub+'得到的结果吗？'+d.rs+'。'+d.rs2,
    '然后呢，'+d.rs+'。'+d.rs2,
  ])+'\n\n'+pick([
    sub+'跟我说的时候声音是带着笑的，你能感觉到那种轻盈——不是装出来的，是真的卸下了一座山。当我们疗愈了来自过去的伤痛，就为整个家族，改写了关于幸福的剧本。',
    '这就是击穿数据的力量。先意识到自己的创伤，再慢慢斩断与原生家庭的共生，那你就会真正的实现觉醒。',
    '当我们疗愈了来自过去的伤痛，就为整个家族，改写了关于幸福的剧本。记住，孩子的成长没有绝境，找对方法，就能把弯路走直。',
  ]));

  // ===== 第10步：收尾 =====
  parts.push(pick(CLOSINGS));
  const result = parts.join('\n\n');
  // 不再硬塞金句截断——靠内容自然控制字数
  return result;
}


function generateFallback(text) {
  // 从用户输入中提取关键信息
  const info = extractUserInfo(text);
  const userQuote = quote(text, 40);
  const fb = [
    ['你说的「'+userQuote+'」，我听到了。这件事我不确定你具体指的是哪个方向，但你放心，我不会随便给你打鸡血，也不会跟你说"你很优秀"。我只会跟你说真话。\n\n你现在经历的这个事情，你有没有想过可能不是你自己的问题？你想，你的父母呢？你的爷爷奶奶呢？他们有没有什么没有处理的创伤、没有表达的情绪？凡是我们的祖先长辈压在潜意识里面，重大的创伤、重大的情绪，没有表达的就会压到他的后代身上。\n\n我们看到人是共生体，与你共生，与父共生，与家族共生。你以为是你自己的痛苦，其实是某个家族成员未表达的情绪。你内在的情绪可能不是你的，是某个家族成员未表达的情绪。先意识到自己的情绪是谁的，再处理。这一步不能跳过。\n\n你现在可以做的第一步：跟你的父母聊一聊，问问他们年轻时经历过什么。不一定马上有答案，但你已经在往真相走了。当你做好准备的时候，你再来跟我说，我帮你一起看看，到底是哪里的数据出了问题。\n\n种瓜得瓜，种豆得豆，种什么因结什么果。但行好事，莫问前程，天地自有善法。'],
    ['我不管你说的是什么，我今天要告诉你一个真相——你现在经历的大部分痛苦，可能根本不是你的。\n\n几代之前长辈们打了一张牌，四到五代之后，这张牌才落下来，基因的承接者都要承担后果的。不是玄学，这是科学。我研究家族系统疗愈二十年，见过一万多个家庭，每一个来找我的人，都觉得是自己的问题，最后发现都不是。\n\n你的父母的生活习惯、三观都来自于他的原生家庭，你是改变不了他们的。你要强行改变的话，你的精神呢，就会不断的被入侵。先意识到自己的创伤，再慢慢斩断与原生家庭的共生，那你就会真正的实现觉醒。\n\n你来告诉我，你具体遇到了什么事？是焦虑？是失眠？是关系问题？是孩子的叛逆？你给我一个方向，我用真实的案例帮你拆解。但是你要记住——你不是一个人在受苦，你的背后站着一整个家族。\n\n先意识到自己的创伤，再慢慢斩断与原生家庭的共生，那你就会真正的实现觉醒。原生家庭不好的人，比别人慢半拍已经非常优秀了，所以不要跟别人比。'],
    ['你「'+userQuote+'」——我听到你说的每一个字了。但是你先别急着下结论，我来帮你看一看。\n\n大部分人遇到你说的这种事，第一反应是自己有问题。但我要告诉你，大概率不是你的问题。它是某个祖先压在潜意识里面的创伤，一代一代传下来，最后停在了你身上。这个数据一直在运转，你根本不知道。\n\n我给你一个判断的方法：你现在经历的这件事，你在父母身上看到了吗？在爷爷奶奶身上看到了吗？如果看到了，那基本可以确定是代际传承。如果没有看到，也不代表不是——有些数据藏了四五代，你根本不知道。\n\n我见过一个案例，五代前五兄弟分家闹矛盾，最小的弟弟被抛弃了。到了第五代，那个家族的后代怎么都赚不到钱。你想，五代之前的事，谁还记得？但是数据记得，基因记得，身体记得。\n\n你现在可以做的一件事：回到你的家族中看看，有没有人经历过类似的事情。当你找到线索的时候，你再来跟我说，我帮你一起击穿这个数据。\n\n但行善事，这不仅仅是利于别人，更是有利于自己，有利于自己的孩子，有利于自己的家人。我们这个世界是一个整体，每个人发出的力量都在影响着自己，也在影响着周围的人，而且最终也会回到自己身上。'],
  ];
  return pick(fb).join('\n\n');
}



// ===== 叙事技法库 =====







// ===== RENDER =====
// ===== Script Length =====

let scriptLength = 'medium';
function setLength(len) {
  scriptLength = len;
  document.querySelectorAll('.pill-group .pill[data-len]').forEach(el => {
    el.classList.toggle('active', el.dataset.len === len);
  });
}
let scriptStyle = 'story';
function setStyle(style) {
  scriptStyle = style;
  document.querySelectorAll('.pill-group .pill[data-style]').forEach(el => {
    el.classList.toggle('active', el.dataset.style === style);
  });
}

// ===== Welcome Topic Rendering =====
function renderWelcomeTopics(filter) {
  const el = document.getElementById('welcomeTopics');
  if (!el) return;
  // Remove existing toggle
  const existingToggle = el.parentElement.querySelector('.welcome-toggle');
  if (existingToggle) existingToggle.remove();
  const f = (filter || '').toLowerCase();
  const filtered = f ? TOPICS.filter(t => t.name.includes(f) || t.keys.some(k => k.includes(f))) : TOPICS;
  const expanded = el.classList.contains('expanded');
  el.innerHTML = filtered.map(t =>
    `<div class="welcome-topic-pill" onclick="quickAsk('生成一个${t.name}的脚本')">${t.name}</div>`
  ).join('');
  // Add toggle button
  if (!f && filtered.length > 6) {
    const btn = document.createElement('div');
    btn.className = 'welcome-toggle';
    btn.textContent = expanded ? '收起 ▲' : '展开全部 ▼';
    btn.onclick = function() {
      el.classList.toggle('expanded');
      btn.textContent = el.classList.contains('expanded') ? '收起 ▲' : '展开全部 ▼';
    };
    el.parentElement.insertBefore(btn, el.nextSibling);
  }
}
function filterTopics(val) { renderWelcomeTopics(val); }



// ===== 【重写】动态 buildSystemPrompt（Issue #1 #2 #3 修复） =====

function buildSystemPrompt(topic) {
  const topicHint = topic
    ? "\n\n当前用户话题："+topic.name+"\n对应原理："+topic.principle+"\n要问的关键问题："+topic.ask+"\n金句链："+(topic.chains||[]).join(" / ")
    : "";
  const lengthHint = scriptLength === 'short' ? "📏 目标800-1200字。"
    : scriptLength === 'long' ? "📏 目标2500-3500字。"
    : "📏 目标1200-2000字。";
  const styleHint = scriptStyle === 'nostory'
    ? "🎭 不含故事版。用金句排比型或观点共鸣型。"
    : "🎭 含故事版。必须包含：来访者案例+祖先故事+揭示+收尾。";

  // ===== 叙事技法指引（注入prompt开头） =====
  const narrativeGuide = "\n🎬 叙事技法要求：\n\n" +
  "【过渡】案例段落之间必须有自然过渡，不能硬切。用以下方式：\n" +
  "- 症状→祖先：用追问式过渡（\"后来我问他的XX\"、\"我一问才知道\"、\"我继续追\"）\n" +
  "- 铺垫→揭示：用递进对话（\"XX呢？{回答}。那再上一代呢？{回答}。\"）\n" +
  "- 故事→洞察：用揭示句（\"揭示就在这儿\"、\"原来是这样\"、\"你看到了吗\"）\n" +
  "⚠️ 以上过渡方式只是参考示例，禁止每次都用同一句，必须在不同案例之间轮换使用不同的过渡句式。\n\n" +
  "【感官细节】每个场景必须有1-2个感官细节（视觉/听觉/触觉），让观众\"看到\"画面。\n" +
  "- 不说\"他很难受\"，说\"牙齿都是洞，甜就好\"\n" +
  "- 不说\"家里气氛差\"，说\"饭桌上筷子不敢响\"\n" +
  "- 不说\"她很痛苦\"，说\"眼泪掉下来但一声不吭\"\n\n" +
  "【情绪节奏】按以下节奏控制叙述：\n" +
  "- 开头：慢铺垫（情绪3-4）\n" +
  "- 症状展开：中速（情绪5-6）\n" +
  "- 祖先揭示：慢+停顿（情绪8-9）\n" +
  "- 金句收尾：最慢（情绪9-10）\n\n" +
  "【碎句技法】关键冲击画面用碎句，模拟真实说话：\n" +
  "- \"牙齿都是洞，甜就好\"\n" +
  "- \"一个浪过来，妹妹就没了\"\n" +
  "- \"安眠药一把一把吃，给小孩儿都吃着\"\n\n";

  // ===== 从 NARRATIVE_TECHNIQUES 中随机选几个模板注入 =====
  const nt = NARRATIVE_TECHNIQUES;
  const pick = function(arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  let techInject = "📚 叙事技法参考（随机选取）：\n\n";

  // 随机选1-2个过渡模板
  const transTypes = Object.keys(nt.transitions);
  const selTransType = pick(transTypes);
  techInject += "【过渡模板·"+selTransType+"】\n";
  nt.transitions[selTransType].forEach(function(t) { techInject += "• "+t+"\n"; });

  // 随机选1个感官模板
  const sensoryTypes = Object.keys(nt.sensory);
  const selSensoryType = pick(sensoryTypes);
  techInject += "\n【感官模板·"+selSensoryType+"】\n";
  nt.sensory[selSensoryType].forEach(function(s) { techInject += "• "+s+"\n"; });

  // 随机选2个钩子模板
  techInject += "\n【开头钩子参考·仅供风格学习】\n";
  for (let hi = 0; hi < 2; hi++) { techInject += "• "+pick(nt.hooks)+"\n"; }
  techInject += "⚠️ 以上仅供学习风格和节奏，禁止照抄原文，必须自己写一个全新的原创开场。\n";

  // 随机选1个结尾模板
  techInject += "\n【结尾收束参考·仅供风格学习】\n• "+pick(nt.endings)+"\n";
  techInject += "⚠️ 以上仅供学习风格和语气，禁止照抄原文，必须自己写一个全新的原创收尾。\n";

  // 随机选3个口语标记词
  const shuffled = nt.oral_markers.slice().sort(function() { return Math.random() - 0.5; });
  techInject += "\n【口语标记词】"+shuffled.slice(0,3).join("、")+"\n\n";

  // ===== 动态注入案例库（精简版：只注入 2 个案例） =====
  let caseLib = "\n\n📦 案例库：\n";
  const topicKey = topic ? getDNAKey(topic.name) : null;
  if (topicKey && CASES_DNA[topicKey]) {
    const cases = CASES_DNA[topicKey];
    // 只取 2 个案例（轮询选取，避免重复）
    const MAX_CASES = 2;
    if (!lastDNAIdx[topicKey] || lastDNAIdx[topicKey] >= cases.length) lastDNAIdx[topicKey] = 0;
    const selected = [];
    for (let ci = 0; ci < MAX_CASES && ci < cases.length; ci++) {
      const idx = (lastDNAIdx[topicKey] + ci) % cases.length;
      selected.push(cases[idx]);
    }
    lastDNAIdx[topicKey] = (lastDNAIdx[topicKey] + MAX_CASES) % cases.length;

    caseLib += "\n━━━ 【"+topic.name+"】"+selected.length+"个案例 ━━━\n";
    selected.forEach(function(c, i) {
      const age = String(c.p.a).match(/^\d/) ? c.p.a+'岁' : c.p.a;
      caseLib += "\n【案例"+(i+1)+"】"+c.city+" · "+c.p.g+" · "+age+" · "+c.p.j+"\n";
      caseLib += "症状："+c.sx.join("；")+"\n";
      caseLib += "祖先："+c.an.who+"——"+c.an.what+"（"+c.an.emo+"）\n";
      caseLib += "代际链条："+c.tr+"\n";
      caseLib += "揭示："+c.rv+"\n";
      caseLib += "疗愈："+c.ac+"\n";
      caseLib += "结果："+c.rs+"。"+c.rs2+"\n";

      if (c.hook_hint) caseLib += "钩子提示："+c.hook_hint+"\n";
      if (c.sensory && c.sensory.length) caseLib += "感官细节方向："+c.sensory.join("；")+"\n";
      if (c.transitions && c.transitions.length) caseLib += "过渡提示："+c.transitions.join("；")+"\n";
      if (c.emotional_arc && c.emotional_arc.beats) {
        var arcStr = c.emotional_arc.beats.map(function(b) {
          return b.position+":"+b.emotion+"("+b.intensity+")";
        }).join(" → ");
        caseLib += "情绪弧线："+arcStr+"\n";
      }
      if (c.micro_insights && c.micro_insights.length) caseLib += "金句方向："+c.micro_insights.join("；")+"\n";
    });
  }
  // 移除"风格参考"案例（节省 tokens，AI 从当前话题案例中学习风格即可）

  let phraseBank = "\n📚 语料库：\n\n";
  const phraseKeys = Object.keys(PHRASES);
  // 只选 1 组语料（按话题相关性）
  const selKeys = [phraseKeys[0]]; // 只用第1组开场库

  return "你现在就是卢慧老师本人。你在拍短视频口播。\n\n" +
  narrativeGuide +
  techInject +
  "🚨 最高指令：\n" +
  "1. 整个输出是一整块连续文字，中间不能有空行。\n" +
  "2. 不用「什么是XX」开场，从「制造好奇缺口」开始。\n" +
  "3. 祖先故事必须「铺垫→展开→揭示」三步走。\n" +
  "4. 细节密度拉满，每个场景3-5句话。\n" +
  "5. 口语碎碎念，句子碎短断。高频：然后呢、你看看、你知道吗。\n" +
  "6. 收尾说一句就停。\n" +
  "7. 每200字至少3个呼吸点。\n" +
  "8. 「揭示就在这儿」这种揭示句式整篇只能用一次，其他揭示必须换不同的说法。\n" +
  "9. 「那再上一代呢」这种追问句式每个案例最多用一次，其他追问必须换不同的问法。\n" +
  "10. 每篇脚本的开场、收尾、过渡句式必须跟上次不同，不能用同一套模板。\n\n" +
  "🎯 60-70%讲故事，20-30%揭示，10%金句收尾。\n\n" +
  "🎬 口播脚本，用嘴说不是用笔写。\n\n" +
  "【金句排比型】" + STYLE_EXAMPLES.jujube + "\n\n" +
  "【案例故事型】" + STYLE_EXAMPLES.story + "\n\n" +
  "【观点共鸣型】" + STYLE_EXAMPLES.resonance + "\n\n" +
  "🗣️ 句子碎短断；口语标记高频；同一意思换着说；第一人称。\n\n" +
  "⚠️ 严禁：排比整齐 / 说教 / 替观众总结 / 连续三句总结 / 学术术语\n\n" +
  caseLib + "\n" + phraseBank + "\n" +
  lengthHint + "\n" + styleHint + "\n" + topicHint;
}


function detectTopic(text) {
  let best = null, bestScore = 0;
  const syns = {
    '烦':['焦虑','紧张','慌'],'睡不着':['失眠','入睡'],
    '不听话':['叛逆','顶嘴'],'没钱':['穷','负债','漏财'],
    '委屈':['讨好','卑微'],'离不开':['上瘾','沉迷'],
    '吵':['关系差','冲突'],'怕':['恐惧','胆小','社恐'],
    '外遇':['出轨','小三','背叛'],'割':['自伤','自残'],
    '丧':['抑郁','低落'],'吼':['暴躁','发火','脾气'],
    '不理':['亲子','冷漠','休学'],'家里':['原生家庭','父母'],
    '纠结':['内耗','想太多'],
    '考砸':['考试','发挥失常'],'被欺负':['霸凌','孤立'],
    '同性':['性取向'],'疼':['身体','生病','痛风'],
    // 新增同义词
    '紧张':['焦虑','心跳','不安'],'慌':['焦虑','坐立不安'],
    '害怕':['恐惧','胆小','不敢'],'累':['内耗','疲惫'],
    '压力':['焦虑','紧张','担心'],'抑郁':['低落','丧','没动力'],
    '难过':['抑郁','悲伤','想哭'],'想不开':['抑郁','想死'],
    '闹':['吵架','冲突','矛盾'],'痛苦':['抑郁','悲伤'],
    '心慌':['焦虑','心跳','不安'],'发抖':['恐惧','害怕'],
    '哭泣':['抑郁','悲伤'],'发脾气':['暴躁','发火'],
    '不自信':['讨好','卑微','没自我'],'自卑':['讨好','卑微'],
    '依赖':['上瘾','沉迷'],'酗酒':['酒瘾','喝酒'],
    '沉迷游戏':['游戏','上瘾','打游戏'],'孩子不听话':['叛逆','不听话'],
    '老公出轨':['出轨','外遇'],'婆媳':['婆婆','媳妇','婚姻'],
    '冷暴力':['冷战','不说话','婚姻'],'分手':['离婚','分手'],
    '单身':['不想恋爱','不想结婚'],'痛风':['尿酸','身体'],
    '鼻炎':['鼻子','呼吸','身体'],'打人':['暴力','脾气','吼'],
    '不想上学':['休学','不上学','躺平'],'成绩下降':['考试','掉链子'],
    '人际':['朋友','关系','社交'],'社交':['朋友','关系','社恐'],
    '换工作':['工作','跳槽','辞职'],'不开心':['低落','丧'],
    '孤独':['孤单','寂寞','没人理解'],'钱':['穷','赚钱','负债'],
    '老公':['丈夫','婚姻','夫妻'],'老婆':['妻子','婚姻'],
  };
  for (const t of TOPICS) {
    let score = 0;
    // 精确匹配：用户输入直接包含topic名 → 巨大权重
    if (text.includes(t.name)) score += t.name.length * 20;
    // 关键词匹配
    for (const k of t.keys) { if (text.includes(k)) score += k.length * 3; }
    // 同义词匹配
    for (const [syn, targets] of Object.entries(syns)) {
      if (text.includes(syn)) {
        for (const k of t.keys) { if (targets.includes(k)) score += k.length * 1.5; }
      }
    }
    // 特殊加权：更具体的主题应优先于泛化主题
    if (t.name === '考试掉链子' && /考试|考场|考砸|紧张.*考|考.*紧张/.test(text)) score += 50;
    if (t.name === '关系差' && /吵|闹|冲突|矛盾|不合/.test(text) && !/婚姻|老公|老婆/.test(text)) score += 30;
    if (t.name === '霸凌' && /欺负|孤立|校园|被排挤/.test(text)) score += 40;
    if (t.name === '身体健康' && /身体|生病|疼|痛|鼻炎|尿酸|胃/.test(text)) score += 30;
    if (t.name === '孩子自伤' && /自残|自伤|割|自毁/.test(text)) score += 50;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  // 如果还是没匹配到，尝试模糊匹配（2字以上子串）
  if (!best) {
    for (const t2 of TOPICS) {
      for (const k2 of t2.keys) {
        if (k2.length >= 2 && text.includes(k2)) {
          if (!best || k2.length > bestScore) { best = t2; bestScore = k2.length; }
        }
      }
    }
  }
  return bestScore > 0 ? best : null;
}



// ===== DOM 操作 + 逻辑层 =====
// ===== 【100遍训练·故事创作引擎】 - Part 3: Logic Functions =====
// 这个文件包含所有 DOM 操作、业务逻辑、事件监听器
// 不包含数据常量（CASES_DNA, TOPICS, CONCEPTS, PHRASES, SCRIPTS）和 buildSystemPrompt
// 这些在 part2_data.js 中提供

// ===== Guidance =====
let guidanceTipDismissed = false;
function dismissGuidanceTip() {
  const tip = document.getElementById('guidanceTip');
  if (tip) tip.classList.remove('show');
  guidanceTipDismissed = true;
}
function showGuidanceBar() {
  const bar = document.getElementById('guidanceBar');
  if (bar) bar.classList.add('show');
  if (!guidanceTipDismissed) {
    const tip = document.getElementById('guidanceTip');
    if (tip) tip.classList.add('show');
  }
}

// ===== Toast =====
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'alert');
  t.setAttribute('aria-live', 'assertive');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ===== History / Favorites =====
function getHistory() {
  try { return JSON.parse(localStorage.getItem('luhui_history') || '[]'); } catch { return []; }
}
function getRecentTopics() {
  const h = getHistory();
  const seen = new Set();
  const topics = [];
  for (const item of h) {
    if (item.topic && item.topic !== '对话' && !seen.has(item.topic)) {
      seen.add(item.topic);
      topics.push(item.topic);
      if (topics.length >= 5) break;
    }
  }
  return topics;
}
function saveHistory(arr) {
  const trimmed = arr.slice(0, 50);
  try {
    localStorage.setItem('luhui_history', JSON.stringify(trimmed));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      // 容量超限：自动删除最老的非收藏记录，逐条删除直到成功
      let pruned = trimmed.filter(h => h.favorite);
      // 保留收藏 + 最新的 10 条非收藏
      const nonFav = trimmed.filter(h => !h.favorite);
      pruned = pruned.concat(nonFav.slice(0, 10));
      pruned.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      try {
        localStorage.setItem('luhui_history', JSON.stringify(pruned));
        showToast('⚠️ 存储空间不足，已自动清理旧记录');
      } catch {
        // 仍然失败：只保留收藏
        const favOnly = trimmed.filter(h => h.favorite).slice(0, 20);
        try {
          localStorage.setItem('luhui_history', JSON.stringify(favOnly));
          showToast('⚠️ 存储空间严重不足，仅保留收藏记录');
        } catch {
          showToast('❌ 存储空间已满，无法保存');
        }
      }
    }
  }
}
function addToHistory(topic, content) {
  const arr = getHistory();
  arr.unshift({ id: Date.now(), topic: topic || '对话', content: content, timestamp: new Date().toISOString(), favorite: false });
  saveHistory(arr);
  renderHistory();
}
function toggleFavorite(id) {
  const arr = getHistory();
  const item = arr.find(h => h.id === id);
  if (item) item.favorite = !item.favorite;
  saveHistory(arr);
  renderHistory();
  // Also update msg button if visible
  document.querySelectorAll('.fav-btn-' + id).forEach(el => el.classList.toggle('faved', item?.favorite));
}
function deleteHistory(id) {
  const arr = getHistory().filter(h => h.id !== id);
  saveHistory(arr);
  renderHistory();
}
function loadHistory(id) {
  const item = getHistory().find(h => h.id === id);
  if (!item) return;
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();
  addMessage('user', '[加载历史] ' + item.topic);
  addMessage('assistant', item.content, false);
  closeSidebar(); // Close sidebar on mobile after loading
}
let historyFilter = 'all';
function filterHistory(mode, btn) {
  historyFilter = mode;
  document.querySelectorAll('.history-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHistory();
}

// [Issue 8 修复] renderHistory 只保留一个版本——带时间分组和搜索过滤的完整版
let historySearchQuery = '';

function filterHistorySearch(query) {
  historySearchQuery = (query || '').toLowerCase();
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!el) return;
  let items = getHistory();
  if (historyFilter === 'fav') items = items.filter(h => h.favorite);
  if (historySearchQuery) {
    items = items.filter(h =>
      h.topic.toLowerCase().includes(historySearchQuery) ||
      h.content.toLowerCase().includes(historySearchQuery)
    );
  }
  if (!items.length) { el.innerHTML = '<div class="history-empty">暂无记录</div>'; return; }

  // Group by time: today / yesterday / this week / earlier
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  const groups = { '今天': [], '昨天': [], '本周': [], '更早': [] };
  items.forEach(h => {
    const ts = new Date(h.timestamp).getTime();
    if (ts >= todayStart) groups['今天'].push(h);
    else if (ts >= yesterdayStart) groups['昨天'].push(h);
    else if (ts >= weekStart) groups['本周'].push(h);
    else groups['更早'].push(h);
  });

  let html = '';
  for (const [label, group] of Object.entries(groups)) {
    if (!group.length) continue;
    html += '<div class="history-time-group">' + label + ' (' + group.length + ')</div>';
    html += group.map(h => {
      const d = new Date(h.timestamp);
      const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
      return `<div class="history-item" onclick="loadHistory(${h.id})">
        <div class="hi-topic">${escapeHtml(h.topic)}</div>
        <div class="hi-preview">${escapeHtml(h.content.substring(0,80))}…</div>
        <div class="hi-time">${time}</div>
        <div class="hi-actions">
          <button class="hi-action" onclick="event.stopPropagation();toggleFavorite(${h.id})" title="收藏" aria-label="收藏">${h.favorite?'⭐':'☆'}</button>
          <button class="hi-action" onclick="event.stopPropagation();deleteHistory(${h.id})" title="删除" aria-label="删除">✕</button>
        </div>
      </div>`;
    }).join('');
  }
  el.innerHTML = html;
}

// ===== DOCX Export =====
function xmlEsc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// [Issue 11 修复] buildZip — 修复 CRC32、offset、UTF-8 编码支持
// DOCX 内部 XML 通常 <1KB，STORE 模式完全够用（ZIP 规范允许）
// 关键修复：
//   1. CRC32 使用预计算查找表（性能+正确性）
//   2. Central directory 的 offset 正确追踪
//   3. 文件名使用 UTF-8 编码（通过 TextEncoder），并设置 Language Encoding Flag (bit 11)
//   4. 添加 version needed / version made by 字段修正

// CRC32 查找表（预计算）
const _crc32Table = (function() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = _crc32Table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const dirs = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const dataBytes = enc.encode(f.content);
    const nameLen = nameBytes.length;
    const dataLen = dataBytes.length;

    // CRC32 — 使用预计算查找表
    const crc = crc32(dataBytes);

    // Local file header (STORE method = 0)
    // General purpose bit flag: bit 11 set (UTF-8 encoding for filename)
    const lh = new ArrayBuffer(30 + nameLen);
    const lv = new DataView(lh);
    lv.setUint32(0, 0x04034b50, true);  // Local file header signature
    lv.setUint16(4, 20, true);           // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true);       // General purpose bit flag (bit 11 = UTF-8)
    lv.setUint16(8, 0, true);            // Compression method (STORE = 0)
    lv.setUint16(10, 0, true);           // Last mod file time
    lv.setUint16(12, 0, true);           // Last mod file date
    lv.setUint32(14, crc, true);         // CRC-32
    lv.setUint32(18, dataLen, true);     // Compressed size
    lv.setUint32(22, dataLen, true);     // Uncompressed size
    lv.setUint16(26, nameLen, true);     // File name length
    lv.setUint16(28, 0, true);           // Extra field length
    new Uint8Array(lh, 30).set(nameBytes);

    parts.push(new Uint8Array(lh), dataBytes);

    // Central directory entry
    const cd = new ArrayBuffer(46 + nameLen);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true);   // Central directory header signature
    cv.setUint16(4, 20, true);           // Version made by (2.0)
    cv.setUint16(6, 20, true);           // Version needed to extract (2.0)
    cv.setUint16(8, 0x0800, true);       // General purpose bit flag (bit 11 = UTF-8)
    cv.setUint16(10, 0, true);           // Compression method (STORE = 0)
    cv.setUint16(12, 0, true);           // Last mod file time
    cv.setUint16(14, 0, true);           // Last mod file date
    cv.setUint32(16, crc, true);         // CRC-32
    cv.setUint32(20, dataLen, true);     // Compressed size
    cv.setUint32(24, dataLen, true);     // Uncompressed size
    cv.setUint16(28, nameLen, true);     // File name length
    cv.setUint16(30, 0, true);           // Extra field length
    cv.setUint16(32, 0, true);           // File comment length
    cv.setUint16(34, 0, true);           // Disk number start
    cv.setUint16(36, 0, true);           // Internal file attributes
    cv.setUint32(38, 0, true);           // External file attributes
    cv.setUint32(42, offset, true);      // Relative offset of local header
    new Uint8Array(cd, 46).set(nameBytes);

    dirs.push(new Uint8Array(cd));
    offset += 30 + nameLen + dataLen;
  }

  // Central directory offset & size
  const cdOffset = offset;
  let cdSize = 0;
  dirs.forEach(d => cdSize += d.length);

  // End of central directory record
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);    // End of central directory signature
  ev.setUint16(4, 0, true);             // Number of this disk
  ev.setUint16(6, 0, true);             // Disk where central directory starts
  ev.setUint16(8, files.length, true);   // Number of central directory records on this disk
  ev.setUint16(10, files.length, true);  // Total number of central directory records
  ev.setUint32(12, cdSize, true);        // Size of central directory
  ev.setUint32(16, cdOffset, true);      // Offset of start of central directory
  ev.setUint16(20, 0, true);             // Comment length

  return new Blob([...parts, ...dirs, new Uint8Array(eocd)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

function exportDocx(content, filename) {
  const bodyXml = content.split('\n').filter(l => l.trim()).map(l =>
    `<w:p><w:pPr><w:spacing w:after="200" w:line="360"/></w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Microsoft YaHei"/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${xmlEsc(l)}</w:t></w:r></w:p>`
  ).join('');
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:sl="http://schemas.openxmlformats.org/schemaLibrary/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:lc="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"><w:body>${bodyXml}</w:body></w:document>`;
  const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei" w:cs="Microsoft YaHei"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="200" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const blob = buildZip([{ name: '[Content_Types].xml', content: ct }, { name: 'word/document.xml', content: doc }, { name: 'word/styles.xml', content: styles }]);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || '脚本.docx'; a.click(); URL.revokeObjectURL(a.href);
}

function exportSrt(content, filename) {
  const lines = content.split('\n').filter(l => l.trim());
  let srt = ''; let time = 0;
  lines.forEach((line, i) => {
    const dur = Math.max(1.5, line.length / 4);
    const sh = String(Math.floor(time/3600)).padStart(2,'0');
    const sm = String(Math.floor((time%3600)/60)).padStart(2,'0');
    const ss = String(Math.floor(time%60)).padStart(2,'0');
    const eh = String(Math.floor((time+dur)/3600)).padStart(2,'0');
    const em = String(Math.floor(((time+dur)%3600)/60)).padStart(2,'0');
    const es = String(Math.floor((time+dur)%60)).padStart(2,'0');
    srt += `${i+1}\n${sh}:${sm}:${ss},000 --> ${eh}:${em}:${es},000\n${line.trim()}\n\n`;
    time += dur;
  });
  const blob = new Blob(['\uFEFF' + srt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || '字幕.srt'; a.click(); URL.revokeObjectURL(a.href);
}

function exportFeishu(content) {
  const md = '# 口播脚本\n\n' + content.split('\n').map(l => l.trim() ? l + '\n' : '').join('');
  navigator.clipboard.writeText(md).then(() => showToast('已复制到剪贴板，可粘贴到飞书文档'));
}

function showExportMenu(btn) {
  // Close any existing
  document.querySelectorAll('.export-dropdown').forEach(d => d.remove());
  const content = btn.closest('.msg').dataset.content || '';
  const dd = document.createElement('div');
  dd.className = 'export-dropdown';
  // Use closures to avoid passing content through DOM attributes
  const optWord = document.createElement('button');
  optWord.className = 'export-option';
  optWord.textContent = '📄 导出 Word';
  optWord.onclick = function(){ dd.remove(); exportDocx(content,'脚本.docx'); };
  const optSrt = document.createElement('button');
  optSrt.className = 'export-option';
  optSrt.textContent = '🎬 导出剪映字幕';
  optSrt.onclick = function(){ dd.remove(); exportSrt(content,'字幕.srt'); };
  const optFeishu = document.createElement('button');
  optFeishu.className = 'export-option';
  optFeishu.textContent = '📋 复制到飞书';
  optFeishu.onclick = function(){ dd.remove(); exportFeishu(content); };
  dd.append(optWord, optSrt, optFeishu);
  btn.closest('.export-wrapper').appendChild(dd);
  // 点击外部关闭下拉菜单（带一次性清理）
  setTimeout(() => {
    function closeHandler(e) { if (!dd.contains(e.target)) { dd.remove(); document.removeEventListener('click', closeHandler); } }
    document.addEventListener('click', closeHandler);
  }, 10);
}

// ===== Export All Chat =====
function exportAllChat() {
  if (chatMessages.length === 0) {
    showToast('暂无对话记录');
    return;
  }
  const allContent = chatMessages.map(m => {
    const label = m.role === 'user' ? '【用户】' : '【卢慧老师】';
    return label + '\n' + m.content;
  }).join('\n\n---\n\n');
  exportDocx(allContent, '卢慧AI对话记录.docx');
}

// [Issue 12 修复] API Key 加密改进
// 改进：
//   1. getDeviceKey 中添加随机 salt（首次生成后存入 localStorage）
//   2. 支持可选用户密码，与设备指纹组合派生密钥
//   3. 用户没设密码时用设备指纹 + 随机 salt（比原始方案更安全）
//   4. clearAllSettings 增加二次确认优化

async function getDeviceKey(userPassword) {
  const fp = navigator.userAgent + screen.width + 'x' + screen.height + navigator.language;
  const enc = new TextEncoder();

  // 获取或生成随机 salt
  let saltB64 = localStorage.getItem('luhui_device_salt');
  if (!saltB64) {
    const randomSalt = crypto.getRandomValues(new Uint8Array(32));
    saltB64 = btoa(String.fromCharCode(...randomSalt));
    localStorage.setItem('luhui_device_salt', saltB64);
  }
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));

  // 组合密钥材料：设备指纹 [+ 用户密码]
  const keyMaterial = userPassword ? fp + '::' + userPassword : fp;
  const keyMat = await crypto.subtle.importKey('raw', enc.encode(keyMaterial), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMat, 256
  );
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptKey(plain, userPassword) {
  const key = await getDeviceKey(userPassword);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return btoa(String.fromCharCode(...iv)) + ':' + btoa(String.fromCharCode(...new Uint8Array(ct)));
}

async function decryptKey(stored, userPassword) {
  try {
    const [ivB64, ctB64] = stored.split(':');
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(ctB64), c => c.charCodeAt(0));
    const key = await getDeviceKey(userPassword);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch { return ''; }
}

// 用户密码管理（可选，存储在 localStorage 中标记是否设了密码）
let _userPassword = null;
function getUserPassword() {
  // 如果之前设过密码（标记存在），在需要时 prompt 输入
  if (localStorage.getItem('luhui_has_pwd') === '1') {
    if (!_userPassword) {
      _userPassword = prompt('请输入您的加密密码（用于保护 API Key）：') || '';
      if (!_userPassword) {
        // 用户取消或留空，尝试无密码解密
        _userPassword = null;
      }
    }
    return _userPassword;
  }
  return null; // 无密码模式
}
function setUserPassword(pwd) {
  if (pwd) {
    _userPassword = pwd;
    localStorage.setItem('luhui_has_pwd', '1');
  } else {
    _userPassword = null;
    localStorage.removeItem('luhui_has_pwd');
  }
}

async function loadApiKey() {
  const stored = localStorage.getItem('luhui_key_enc');
  if (!stored) return '';
  const pwd = getUserPassword();
  return decryptKey(stored, pwd);
}

async function saveApiKey(plain) {
  if (!plain) { localStorage.removeItem('luhui_key_enc'); return; }
  const pwd = getUserPassword();
  const enc = await encryptKey(plain, pwd);
  localStorage.setItem('luhui_key_enc', enc);
}

function renderTopics() {
  document.getElementById('topicGrid').innerHTML = TOPICS.map((t,i) => `<div class="topic-chip" onclick="selectTopic(this,${i})">${t.name}</div>`).join('');
}
function renderConcepts() {
  document.getElementById('conceptList').innerHTML = CONCEPTS.map(c => `<div class="concept-card" onclick="this.classList.toggle('expanded')"><div class="cn">${c.name}</div><div class="cd">${c.desc}</div></div>`).join('');
}
function renderPhrases() {
  document.getElementById('phraseBank').innerHTML = Object.entries(PHRASES).map(([g,items]) => `<div class="phrase-group"><div class="phrase-group-title">${g}</div>${items.map(p => `<div class="phrase-item" onclick="insertPhrase(this)">${p}</div>`).join('')}</div>`).join('');
}
function renderScripts() {
  document.getElementById('scriptList').innerHTML = SCRIPTS.map(s => `<div class="script-link" onclick="openScript('${s.title}')"><span class="name">${s.title}</span><span class="tag">${s.tag}</span></div>`).join('');
}
renderTopics(); renderConcepts(); renderPhrases(); renderScripts(); renderWelcomeTopics();
// 渲染最近使用的话题
renderRecentTopics();

// ===== SIDEBAR =====
function switchPanel(el) {
  document.querySelectorAll('.sidebar-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
  el.classList.add('active');
  el.setAttribute('aria-selected','true');
  document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-'+el.dataset.panel).classList.add('active');
}
// [修复] selectTopic — 点击侧边栏话题标签后实际生成脚本，而非仅高亮
function selectTopic(el, idx) {
  document.querySelectorAll('.topic-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const topic = TOPICS[idx];
  if (topic) {
    quickAsk('生成一个' + topic.name + '的脚本');
    closeSidebar(); // 移动端关闭侧边栏
  }
}
function insertPhrase(el) {
  const input = document.getElementById('userInput');
  input.value += (input.value ? '\n' : '') + el.textContent;
  input.focus();
}
function openScript(title) {
  _modalPrevFocus = document.activeElement;
  const script = SCRIPTS.find(s => s.title === title);
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalContent').textContent = script?.content || '（暂无脚本内容，请在 SCRIPTS 数组中补充 content 字段。）';
  document.getElementById('scriptModal').classList.add('show');
  document.addEventListener('keydown', _modalKeyHandler);
  // 聚焦关闭按钮
  setTimeout(() => document.querySelector('#scriptModal .modal-close')?.focus(), 50);
}
let _modalPrevFocus = null;
function closeModal() {
  const m = document.getElementById('scriptModal');
  m.classList.remove('show');
  if (_modalPrevFocus) { _modalPrevFocus.focus(); _modalPrevFocus = null; }
  document.removeEventListener('keydown', _modalKeyHandler);
}
function _modalKeyHandler(e) {
  if (e.key === 'Escape') { closeModal(); return; }
  // Focus trap: Tab 循环
  if (e.key === 'Tab') {
    const modal = document.querySelector('#scriptModal .modal');
    const focusable = modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
document.getElementById('scriptModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

// ===== API面板切换（带点击外部关闭） =====
function toggleApiBar() {
  const bar = document.getElementById('apiBar');
  const isOpen = bar.classList.contains('show');
  if (isOpen) {
    bar.classList.remove('show');
    document.removeEventListener('click', _apiBarOutsideHandler);
  } else {
    bar.classList.add('show');
    setTimeout(() => document.addEventListener('click', _apiBarOutsideHandler), 10);
  }
}
function _apiBarOutsideHandler(e) {
  const bar = document.getElementById('apiBar');
  const tag = document.getElementById('modeTag');
  if (!bar.contains(e.target) && !tag.contains(e.target)) {
    bar.classList.remove('show');
    document.removeEventListener('click', _apiBarOutsideHandler);
  }
}

// ===== API 供应商预设 =====
function applyPreset() {
  const preset = API_PRESETS[document.getElementById('apiPreset').value];
  if (preset) {
    document.getElementById('apiBase').value = preset.base;
    document.getElementById('modelSelect').value = preset.model;
  }
}

// 清除所有已保存设置
function clearAllSettings() {
  // [Issue 12 修复] 增强确认对话框
  const confirmed = confirm(
    '⚠️ 清除所有设置\n\n' +
    '将清除以下内容：\n' +
    '• API Key（加密存储）\n' +
    '• API 配置（地址、模型）\n' +
    '• 设备加密盐值\n' +
    '• 加密密码标记\n\n' +
    '对话历史不受影响。\n\n' +
    '点击"确定"继续清除。'
  );
  if (!confirmed) return;

  localStorage.removeItem('luhui_key_enc');
  localStorage.removeItem('luhui_config');
  localStorage.removeItem('luhui_free_idx');
  localStorage.removeItem('luhui_device_salt');
  localStorage.removeItem('luhui_has_pwd');
  _userPassword = null;

  // 重置UI
  document.getElementById('apiKey').value = '';
  document.getElementById('apiKey').classList.remove('key-masked');
  document.getElementById('apiKey').dataset.masked = '';
  document.getElementById('apiBase').value = 'https://api.bltcy.ai/v1';
  document.getElementById('modelSelect').value = 'gpt-5.4';
  showToast('🗑️ 已清除所有设置');
}

// ===== API Config: Encrypted Key Storage =====
try {
  const saved = JSON.parse(localStorage.getItem('luhui_config') || '{}');
  if (saved.apiBase) document.getElementById('apiBase').value = saved.apiBase;
  if (saved.model) document.getElementById('modelSelect').value = saved.model;
} catch(e) {}

// Load encrypted API key on startup
(async function() {
  try {
    const hasEncrypted = localStorage.getItem('luhui_key_enc');
    if (hasEncrypted) {
      const keyInput = document.getElementById('apiKey');
      keyInput.value = '••••••••';
      keyInput.classList.add('key-masked');
      keyInput.dataset.masked = '1';
    } else {
      // [新增] 首次加载：填入默认 Key 并自动加密保存
      const defaultKey = 'sk-izjuVYtpXRz9tK9oJUz8jm9AJpJCXIA3Qn3ZKkdIjQe6NUQK';
      await saveApiKey(defaultKey);
      const keyInput = document.getElementById('apiKey');
      keyInput.value = '••••••••';
      keyInput.classList.add('key-masked');
      keyInput.dataset.masked = '1';
    }
  } catch(e) {}
})();

// API Key input: clear mask on focus, encrypt on blur
document.getElementById('apiKey').addEventListener('focus', function() {
  if (this.dataset.masked === '1') {
    this.value = '';
    this.classList.remove('key-masked');
    this.dataset.masked = '';
  }
});
document.getElementById('apiKey').addEventListener('blur', async function() {
  const val = this.value.trim();
  if (val && val !== '••••••••') {
    await saveApiKey(val);
    this.value = '••••••••';
    this.classList.add('key-masked');
    this.dataset.masked = '1';
    showToast('✅ API Key 已保存');
  }
});
document.getElementById('apiKey').addEventListener('keydown', async function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    this.blur();
  }
});

// Save other API config (non-sensitive)
['apiBase','modelSelect'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('change', () => {
    const cfg = JSON.parse(localStorage.getItem('luhui_config') || '{}');
    cfg.apiBase = document.getElementById('apiBase').value;
    cfg.model = document.getElementById('modelSelect').value;
    localStorage.setItem('luhui_config', JSON.stringify(cfg));
    showToast('✅ 配置已保存');
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
    }
  });
});

// ===== CHAT =====
function getWelcomeHTML(){
  return '<div class="brand-logo" aria-hidden="true"><div class="brand-ring"></div><svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="brandGradD" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#0a84ff"/><stop offset="100%" stop-color="#5e5ce6"/></linearGradient></defs><circle cx="40" cy="40" r="36" fill="url(#brandGradD)" opacity=".15"/><circle cx="40" cy="40" r="28" stroke="url(#brandGradD)" stroke-width="1.5" fill="none" opacity=".4"/><path d="M32 28c0-5.5 3.6-10 8-10s8 4.5 8 10" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M28 34c-3 0-6 2.5-6 6s3 6 6 6" stroke="#5e5ce6" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".7"/><path d="M52 34c3 0 6 2.5 6 6s-3 6-6 6" stroke="#5e5ce6" stroke-width="1.5" stroke-linecap="round" fill="none" opacity=".7"/><path d="M33 48c0 3 3.1 5.5 7 5.5s7-2.5 7-5.5" stroke="#0a84ff" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M40 36l-2.5-2.5a3 3 0 014.2-4.2L40 31l1.8-1.8a3 3 0 014.2 4.2L40 36z" fill="#ff453a" opacity=".8"/><line x1="34" y1="38" x2="30" y2="42" stroke="#0a84ff" stroke-width="1" opacity=".4"/><line x1="46" y1="38" x2="50" y2="42" stroke="#0a84ff" stroke-width="1" opacity=".4"/><circle cx="30" cy="43" r="1.5" fill="#30d158" opacity=".6"/><circle cx="50" cy="43" r="1.5" fill="#30d158" opacity=".6"/></svg></div>'
    +'<h2>心理学博士卢慧</h2>'
    +'<p class="welcome-desc">家族系统疗愈 · 口播脚本生产引擎<br>输入选题关键词，AI 按爆款结构生成脚本</p>'
    +'<div class="welcome-hints">'
    +'<button class="welcome-hint" onclick="quickAsk(\'焦虑\')">😤 焦虑</button>'
    +'<button class="welcome-hint" onclick="quickAsk(\'失眠\')">😴 失眠</button>'
    +'<button class="welcome-hint" onclick="quickAsk(\'叛逆\')">🔥 叛逆</button>'
    +'<button class="welcome-hint" onclick="quickAsk(\'亲子关系\')">👶 亲子</button>'
    +'<button class="welcome-hint" onclick="quickAsk(\'抑郁\')">💔 抑郁</button>'
    +'<button class="welcome-hint" onclick="quickAsk(\'赚不到钱\')">💰 赚钱</button>'
    +'</div>'
    +'<div id="recentTopics" style="display:flex;flex-direction:column;flex-wrap:wrap;gap:10px;margin-bottom:20px;justify-content:center;align-items:center"></div>'
    +'<div class="welcome-search-wrap"><input type="text" class="welcome-search" id="topicSearch" placeholder="搜索话题，如：焦虑、失眠、亲子……" oninput="filterTopics(this.value)" /></div>'
    +'<div class="config-row">'
    +'<div class="config-group"><div class="config-label">字数</div><div class="pill-group">'
    +'<button class="pill'+(scriptLength==='short'?' active':'')+'" data-len="short" onclick="setLength(\'short\')">📝 800</button>'
    +'<button class="pill'+(scriptLength==='medium'?' active':'')+'" data-len="medium" onclick="setLength(\'medium\')">📄 1500</button>'
    +'<button class="pill'+(scriptLength==='long'?' active':'')+'" data-len="long" onclick="setLength(\'long\')">📚 3000</button>'
    +'</div></div>'
    +'<div class="config-group"><div class="config-label">风格</div><div class="pill-group">'
    +'<button class="pill'+(scriptStyle==='story'?' active':'')+'" data-style="story" onclick="setStyle(\'story\')">📖 含故事</button>'
    +'<button class="pill'+(scriptStyle==='nostory'?' active':'')+'" data-style="nostory" onclick="setStyle(\'nostory\')">💬 不含故事</button>'
    +'</div></div>'
    +'</div>'
    +'<div class="welcome-topics" id="welcomeTopics"></div>';
}
function renderRecentTopics(){
  const recent=getRecentTopics();
  const el=document.getElementById('recentTopics');
  if(!el)return;
  if(recent.length===0){el.innerHTML='';return;}
  el.innerHTML='<div style="font-size:11px;color:var(--text-tertiary);font-weight:600;letter-spacing:.5px">最近使用</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">'+recent.map(t=>'<div class="welcome-topic-pill" onclick="quickAsk(\'生成一个'+t+'的脚本\')" style="border-color:var(--accent);background:var(--accent-soft)">'+t+'</div>').join('')+'</div>';
}
function renderWelcome(){
  const m=document.getElementById("messages");
  const w=document.createElement("div");
  w.className="welcome";w.id="welcome";
  w.innerHTML=getWelcomeHTML();
  m.appendChild(w);
  renderWelcomeTopics();
  renderRecentTopics();
}
// Logout function
function logout() {
  sessionStorage.removeItem(APP_CONFIG.sessionKey);
  window.location.href = APP_CONFIG.loginPage;
}

function clearChat(){
  const m=document.getElementById("messages");
  m.innerHTML="";
  renderWelcome();
  chatMessages.length=0;
  document.getElementById("guidanceBar").classList.remove("show");
}
let isGenerating = false;
let lastSentText = '';
const chatMessages = [];
const MAX_CONTEXT_MESSAGES = 6; // 只发最近 3 轮对话给 API（每轮=user+assistant）

function quickAsk(text) {
  if (isGenerating) { showToast('⏳ 正在生成中，请稍后再试'); return; }
  document.getElementById('userInput').value = text;
  sendMessage();
}

// [P1-3 修复] sendMessage — SSE 流式 API 调用
async function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text || isGenerating) return;
  const now = Date.now();
  if (text === lastSentText && now - (sendMessage._lastTime || 0) < 3000) return;
  lastSentText = text;
  sendMessage._lastTime = now;
  isGenerating = true;

  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  addMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  let apiKey = document.getElementById('apiKey').value.trim();
  if (apiKey === '••••••••') {
    apiKey = await loadApiKey();
  }
  const apiBase = document.getElementById('apiBase').value.trim();
  const model = document.getElementById('modelSelect').value.trim();

  if (!apiKey) {
    addMessage('assistant', '🔑 请先配置 API Key，在上方填入后自动保存。');
    isGenerating = false;
    resetSendBtn();
    return;
  }
  document.getElementById('sendBtn').disabled = true;
  const topic = detectTopic(text);
  chatMessages.push({ role: 'user', content: text });

  // 根据 scriptLength 动态调整 max_tokens
  const maxTokensMap = { short: 4096, medium: 6144, long: 8192 };
  const maxTokens = maxTokensMap[scriptLength] || 6144;

  // 创建流式消息气泡（不走 addMessage 的 typewriter 路径）
  const streamHandle = createStreamBubble();

  const abortCtrl = new AbortController();
  currentAbort = { abort: () => abortCtrl.abort() };
  // 显示停止按钮
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.innerHTML = '⏹';
  sendBtn.classList.add('stop');
  sendBtn.disabled = false;
  sendBtn.setAttribute('aria-label', '停止生成');

  // 请求超时：60s
  const timeoutId = setTimeout(() => abortCtrl.abort(), 60000);

  try {
    // 滑动窗口：只发最近 N 轮对话，避免 token 无限增长
    const contextMessages = chatMessages.slice(-MAX_CONTEXT_MESSAGES);

    const body = {
      model: model || 'glm-4-flash',
      messages: [
        { role: 'system', content: buildSystemPrompt(topic) },
        ...contextMessages
      ],
      temperature: 0.6,
      max_tokens: maxTokens,
      stream: true,
    };

    let resp;
    let retries = 2;
    while (retries >= 0) {
      try {
        resp = await fetch(apiBase + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify(body),
          signal: abortCtrl.signal,
        });
      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
          // 用户主动停止或超时
          const partialContent = streamHandle.getContent();
          if (partialContent) {
            streamHandle.finish();
            chatMessages.push({ role: 'assistant', content: partialContent });
            const topicName = topic ? topic.name : '对话';
            addToHistory(topicName, partialContent);
            showGuidanceBar();
          } else {
            streamHandle.destroy();
          }
          isGenerating = false;
          resetSendBtn();
          input.focus();
          return;
        }
        throw fetchErr;
      }
      if (resp.ok || resp.status === 401 || resp.status === 403) break;
      retries--;
      if (retries >= 0) await Promise.race([
        new Promise(r => setTimeout(r, 1500)),
        abortPromise(abortCtrl.signal),
      ]);
    }

    if (!resp.ok) {
      let errText = '未知错误';
      try { const errJson = await resp.json(); errText = errJson.error?.message || errJson.message || errText; } catch { try { errText = await resp.text(); } catch {} }
      const errHints = {
        401: '🔑 API Key 无效或已过期。请检查 Key 是否正确。',
        403: '🚫 没有权限访问该模型。请确认模型名称和账号余额。',
        429: '⏱️ 请求太频繁或配额用尽。请稍后再试。',
        500: '🔧 服务器内部错误。请稍后再试。',
        503: '⏳ 服务暂时不可用。请稍后再试。',
      };
      const hint = errHints[resp.status] || ('⚠️ 请求失败 (HTTP ' + resp.status + ')');
      streamHandle.destroy();
      addMessage('assistant', hint + '\n\n详情：' + errText.substring(0, 200));
      isGenerating = false;
      resetSendBtn();
      return;
    }

    // SSE 流式读取 — [修复] 用 Promise.race 兜底 abort 信号
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await Promise.race([
        reader.read(),
        abortPromise(abortCtrl.signal),
      ]);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // SSE 格式：每条消息以 \n\n 分隔
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 最后一个可能不完整，留到下次

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue; // 空行或 SSE 注释
        if (trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            streamHandle.append(delta);
          }
        } catch {
          // 解析失败的 chunk 跳过
        }
      }
    }

    clearTimeout(timeoutId);
    streamHandle.finish();
    const content = streamHandle.getContent();
    if (content) {
      chatMessages.push({ role: 'assistant', content: content });
      const topicName = topic ? topic.name : '对话';
      addToHistory(topicName, content);
      showGuidanceBar();
    }

  } catch (e) {
    clearTimeout(timeoutId);
    const isAbort = e.name === 'AbortError' || e.name === 'DOMException';
    const partialContent = streamHandle.getContent();

    // [修复] 用户主动停止 → 保留已有内容，不显示错误
    if (isAbort && partialContent) {
      streamHandle.finish();
      chatMessages.push({ role: 'assistant', content: partialContent });
      const topicName = topic ? topic.name : '对话';
      addToHistory(topicName, partialContent);
      showGuidanceBar();
    } else if (isAbort && !partialContent) {
      // 用户停止但没有任何内容 → 清空气泡
      streamHandle.destroy();
      // 不显示错误消息，用户知道自己点了停止
    } else {
      // 真正的错误
      streamHandle.destroy();
      let errMsg = '网络请求出错';
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        errMsg = '🌐 网络连接失败，请检查网络或 API 地址是否正确。';
      } else {
        errMsg = '❌ ' + e.message;
      }
      addMessage('assistant', errMsg, false);
    }
  }

  isGenerating = false;
  resetSendBtn();
  input.focus();
}

let msgCounter = 0;
let currentAbort = null; // AbortController for stopping generation

// [P1-3] 创建流式消息气泡，返回 { append, finish, getContent, destroy }
function createStreamBubble() {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg assistant';
  msgCounter++;
  const msgId = 'msg-' + msgCounter;
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const lenTargets = { short: '800-1200', medium: '1200-2000', long: '2500-3500' };
  const target = lenTargets[scriptLength] || lenTargets.medium;

  div.innerHTML = '<div class="msg-label">卢慧老师 · ' + timeStr + '</div>'
    + '<div class="msg-bubble" id="bubble-' + msgId + '" onclick="copyMsg(this)" title="点击复制"></div>'
    + '<div class="word-count" id="wc-' + msgId + '">📄 0字 <span class="target">/ 目标 ' + target + '字</span></div>'
    + '<div class="msg-actions" id="actions-' + msgId + '" style="display:none">'
    + '<button class="msg-action-btn" onclick="event.stopPropagation();copyMsg(this.closest(\'.msg\').querySelector(\'.msg-bubble\'))">📋 复制</button>'
    + '<div class="export-wrapper"><button class="msg-action-btn" onclick="event.stopPropagation();showExportMenu(this)">📤 导出</button></div>'
    + '<button class="msg-action-btn fav-btn" onclick="event.stopPropagation();quickFav(this)">☆ 收藏</button>'
    + '</div>';

  container.appendChild(div);

  const bubble = document.getElementById('bubble-' + msgId);
  const wcEl = document.getElementById('wc-' + msgId);
  const actionsEl = document.getElementById('actions-' + msgId);
  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  bubble.appendChild(cursor);

  let content = '';
  let finished = false;
  let chunkCount = 0;

  return {
    append(text) {
      if (finished) return;
      content += text;
      chunkCount++;
      // 插入文本节点（cursor 之前）
      const textNode = document.createTextNode(text);
      bubble.insertBefore(textNode, cursor);
      wcEl.innerHTML = '📄 ' + content.length + '字 <span class="target">/ 目标 ' + target + '字</span>';
      // 每 5 个 chunk 滚动一次，避免过于频繁
      if (chunkCount % 5 === 0) {
        container.scrollTop = container.scrollHeight;
      }
    },
    finish() {
      if (finished) return;
      finished = true;
      cursor.remove();
      wcEl.innerHTML = '📄 ' + content.length + '字 <span class="target">/ 目标 ' + target + '字</span>';
      div.dataset.content = content;
      actionsEl.style.display = '';
      container.scrollTop = container.scrollHeight;
    },
    getContent() { return content; },
    destroy() {
      cursor.remove();
      finished = true;
      // [修复] 彻底移除气泡 DOM，不留残骸
      div.remove();
    }
  };
}

function addMessage(role, content, streaming) {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  msgCounter++;
  const msgId = 'msg-' + msgCounter;
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  if (role === 'assistant') {
    const charCount = content.length;
    const lenTargets = { short: '800-1200', medium: '1200-2000', long: '2500-3500' };
    const target = lenTargets[scriptLength] || lenTargets.medium;
    div.innerHTML = '<div class="msg-label">卢慧老师 · ' + timeStr + '</div><div class="msg-bubble" id="bubble-' + msgId + '" onclick="copyMsg(this)" title="点击复制"></div><div class="word-count" id="wc-' + msgId + '">📄 0字 <span class="target">/ 目标 ' + target + '字</span></div><div class="msg-actions"><button class="msg-action-btn" onclick="event.stopPropagation();copyMsg(this.closest(\'.msg\').querySelector(\'.msg-bubble\'))">📋 复制</button><div class="export-wrapper"><button class="msg-action-btn" onclick="event.stopPropagation();showExportMenu(this)">📤 导出</button></div><button class="msg-action-btn fav-btn" onclick="event.stopPropagation();quickFav(this)">☆ 收藏</button></div>';
    div.dataset.content = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    if (streaming) {
      // Typewriter streaming effect
      const bubble = document.getElementById('bubble-' + msgId);
      const wcEl = document.getElementById('wc-' + msgId);
      const cursor = document.createElement('span');
      cursor.className = 'typewriter-cursor';
      bubble.appendChild(cursor);
      let i = 0;
      const chunkSize = 3; // chars per frame
      const baseDelay = 12; // ms per chunk
      let aborted = false;

      function step() {
        if (aborted) {
          // Show remaining content instantly
          const remaining = content.substring(i);
          const textNode = document.createTextNode(remaining);
          bubble.insertBefore(textNode, cursor);
          cursor.remove();
          wcEl.innerHTML = '📄 ' + content.length + '字 <span class="target">/ 目标 ' + target + '字</span>';
          updateExportBtns(div, content);
          resetSendBtn();
          return;
        }
        if (i < content.length) {
          const end = Math.min(i + chunkSize, content.length);
          const chunk = content.substring(i, end);
          const textNode = document.createTextNode(chunk);
          bubble.insertBefore(textNode, cursor);
          i = end;
          wcEl.innerHTML = '📄 ' + i + '字 <span class="target">/ 目标 ' + target + '字</span>';
          container.scrollTop = container.scrollHeight;
          // Vary speed: slower at punctuation
          let delay = baseDelay;
          const lastChar = chunk[chunk.length - 1];
          if ('。！？，；：'.includes(lastChar)) delay = baseDelay * 8;
          else if ('、.!?\n'.includes(lastChar)) delay = baseDelay * 4;
          setTimeout(step, delay);
        } else {
          cursor.remove();
          wcEl.innerHTML = '📄 ' + content.length + '字 <span class="target">/ 目标 ' + target + '字</span>';
          updateExportBtns(div, content);
          currentAbort = null;
          resetSendBtn();
        }
      }

      currentAbort = { abort: () => { aborted = true; } };
      // Make stop button visible
      const btn = document.getElementById('sendBtn');
      btn.innerHTML = '⏹';
      btn.classList.add('stop');
      btn.setAttribute('aria-label', '停止生成');

      setTimeout(step, 50);
    } else {
      // Instant display (for loaded history etc.)
      const bubble = document.getElementById('bubble-' + msgId);
      bubble.innerHTML = escapeHtml(content);
      const wcEl = document.getElementById('wc-' + msgId);
      wcEl.innerHTML = '📄 ' + content.length + '字 <span class="target">/ 目标 ' + target + '字</span>';
      updateExportBtns(div, content);
    }
  } else {
    div.innerHTML = '<div class="msg-label">你 · ' + timeStr + '</div><div class="msg-bubble">'+escapeHtml(content)+'</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
}

function addLoading() {
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg assistant';
  div.id = 'loading-' + Date.now();
  div.innerHTML = `<div class="msg-label">卢慧老师</div><div class="msg-bubble"><div class="loading"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div.id;
}

function removeLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function updateExportBtns(div, content) {
  div.dataset.content = content;
}
function quickFav(btn) {
  const msg = btn.closest('.msg');
  const content = msg.dataset.content || '';
  // 检查是否已收藏 — 取消收藏
  if (btn.classList.contains('faved')) {
    const hist = getHistory();
    const idx = hist.findIndex(h => h.content === content && h.favorite);
    if (idx >= 0) {
      hist[idx].favorite = false;
      saveHistory(hist);
      renderHistory();
    }
    btn.classList.remove('faved');
    btn.textContent = '☆ 收藏';
    showToast('已取消收藏');
    return;
  }
  // 新增收藏
  const topic = chatMessages.length > 0 ? (detectTopic(chatMessages[chatMessages.length-2]?.content || '')?.name || '对话') : '对话';
  addToHistory(topic, content);
  // 标记为收藏（addToHistory 会 unshift 到数组头部）
  const hist = getHistory();
  if (hist[0]) hist[0].favorite = true;
  saveHistory(hist);
  btn.classList.add('faved');
  btn.textContent = '⭐ 已收藏';
  showToast('已添加到历史收藏');
  renderHistory();
}

// ===== Send / Stop Toggle =====
// [修复] 只触发 abort，状态清理由 sendMessage 的 catch 统一处理
function handleSendOrStop() {
  if (currentAbort) {
    currentAbort.abort();
    return;
  }
  sendMessage();
}

// [修复] 创建 abort promise，用于 Promise.race 兜底 reader.read()
function abortPromise(signal) {
  return new Promise((_, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
}

function resetSendBtn() {
  const btn = document.getElementById('sendBtn');
  btn.innerHTML = '→';
  btn.classList.remove('stop');
  btn.disabled = false;
  btn.setAttribute('aria-label', '发送消息');
  currentAbort = null;
}

// ===== Sidebar Toggle with Backdrop =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    closeSidebar();
  } else {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
    // Add touch swipe to close
    initSwipeToClose(sidebar);
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
}

// Touch swipe gesture to close sidebar
function initSwipeToClose(sidebar) {
  let startX = 0, startY = 0, currentX = 0, isDragging = false, isHorizontal = null;

  function onTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    currentX = 0;
    isDragging = true;
    isHorizontal = null;
    sidebar.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    // Determine swipe direction on first significant move
    if (isHorizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    // Only handle horizontal swipes (left to close)
    if (isHorizontal && dx < 0) {
      e.preventDefault();
      currentX = dx;
      const clamped = Math.max(currentX, -320);
      sidebar.style.transform = 'translateX(' + clamped + 'px)';
    }
  }

  function onTouchEnd() {
    isDragging = false;
    sidebar.style.transition = '';
    if (currentX < -80) {
      closeSidebar();
    } else {
      sidebar.style.transform = '';
    }
    sidebar.removeEventListener('touchstart', onTouchStart);
    sidebar.removeEventListener('touchmove', onTouchMove);
    sidebar.removeEventListener('touchend', onTouchEnd);
  }

  sidebar.addEventListener('touchstart', onTouchStart, { passive: true });
  sidebar.addEventListener('touchmove', onTouchMove, { passive: false });
  sidebar.addEventListener('touchend', onTouchEnd, { passive: true });
}

function copyMsg(el){if(navigator.clipboard)navigator.clipboard.writeText(el.innerText);}
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>');
}

// ===== 事件监听器设置 =====
document.getElementById('userInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.getElementById('userInput').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeModal();
    closeSidebar();
  }
  // Ctrl+/ 快速聚焦输入框
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    document.getElementById('userInput').focus();
  }
  // Arrow key navigation for sidebar tabs
  if (e.target.classList.contains('sidebar-tab')) {
    const tabs = [...document.querySelectorAll('.sidebar-tab')];
    const idx = tabs.indexOf(e.target);
    if (e.key === 'ArrowRight' && idx < tabs.length - 1) {
      e.preventDefault();
      tabs[idx + 1].focus();
      switchPanel(tabs[idx + 1]);
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      tabs[idx - 1].focus();
      switchPanel(tabs[idx - 1]);
    }
  }
});

// Mobile toggle keyboard support
document.querySelector('.mobile-toggle')?.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSidebar(); }
});

// 移动端：点击聊天区域收起键盘
document.querySelector('.messages')?.addEventListener('click', function(e) {
  if (e.target === this) document.getElementById('userInput').blur();
});

// [修复] API面板点击外部关闭
document.addEventListener('click', function(e) {
  const apiBar = document.getElementById('apiBar');
  const modeTag = document.getElementById('modeTag');
  if (apiBar.classList.contains('show') && !apiBar.contains(e.target) && !modeTag.contains(e.target)) {
    apiBar.classList.remove('show');
  }
});

// ===== Init =====
renderHistory();

// ===== 移动端虚拟键盘适配 =====
(function() {
  if (!window.visualViewport) return;
  const viewport = window.visualViewport;
  const app = document.querySelector('.app');
  const inputArea = document.querySelector('.input-area');

  function onViewportResize() {
    // 当键盘弹出时，visualViewport.height 会小于 layout viewport
    const diff = window.innerHeight - viewport.height;
    if (diff > 100) {
      // 键盘已弹出
      app.style.height = viewport.height + 'px';
      app.style.position = 'fixed';
      app.style.top = viewport.offsetTop + 'px';
      app.style.left = '0';
      app.style.right = '0';
      // 确保输入框可见
      if (inputArea) {
        inputArea.style.position = 'sticky';
        inputArea.style.bottom = '0';
      }
      // 滚动到最新消息
      const messages = document.getElementById('messages');
      if (messages) {
        requestAnimationFrame(() => {
          messages.scrollTop = messages.scrollHeight;
        });
      }
    } else {
      // 键盘已收起
      app.style.height = '';
      app.style.position = '';
      app.style.top = '';
      app.style.left = '';
      app.style.right = '';
    }
  }

  viewport.addEventListener('resize', onViewportResize);
  // iOS 兼容
  viewport.addEventListener('scroll', onViewportResize);
})();
