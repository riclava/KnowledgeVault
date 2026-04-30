import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  KnowledgeItemType,
  KnowledgeItemRelationType,
  Prisma,
  PrismaClient,
  QuestionGradingMode,
  QuestionType,
} from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  }),
});

type SeedKnowledgeItem = {
  slug: string;
  title: string;
  contentType: KnowledgeItemType;
  renderPayload: string | Record<string, unknown>;
  domain: string;
  subdomain: string | null;
  summary: string;
  body: string;
  intuition: string | null;
  deepDive: string | null;
  useConditions: string[];
  nonUseConditions: string[];
  antiPatterns: string[];
  typicalProblems: string[];
  examples: string[];
  difficulty: number;
  tags: string[];
  variables: Array<{
    symbol: string;
    name: string;
    description: string;
    unit?: string | null;
  }>;
  reviewItems: Array<{
    type: QuestionType;
    prompt: string;
    answer: string;
    explanation: string;
    difficulty: number;
  }>;
};

const knowledgeItems: SeedKnowledgeItem[] = [
  {
    slug: "bayes-theorem",
    title: "贝叶斯定理",
    contentType: KnowledgeItemType.math_formula,
    renderPayload: "P(A \\mid B)=\\frac{P(B \\mid A)P(A)}{P(B)}",
    domain: "概率统计",
    subdomain: "条件概率",
    summary: "已知结果发生，反推导致该结果的某个原因的概率。",
    body:
      "贝叶斯定理把先验概率和观测到的证据结合起来，更新某个原因或假设成立的概率。",
    intuition:
      "它像一次证据更新：先有一个初始判断，再用新看到的结果重新调整判断。",
    deepDive:
      "由条件概率定义 P(A|B)=P(A∩B)/P(B) 与 P(B|A)=P(A∩B)/P(A) 联立得到。",
    useConditions: [
      "题目要求从结果 B 反推原因 A 的概率。",
      "题目给出了 P(B|A) 这类正向条件概率，但要求 P(A|B)。",
      "分母 P(B) 可以直接给出，或能用全概率公式展开。",
    ],
    nonUseConditions: [
      "题目只要求结果 B 的总概率，而不是从结果反推原因。",
      "A 与 B 明确独立且直接有 P(A|B)=P(A)，无需额外反推。",
    ],
    antiPatterns: [
      "把 P(A|B) 和 P(B|A) 当成同一个概率。",
      "忘记用全概率公式展开 P(B)，只计算了分子。",
      "忽略先验概率 P(A)，导致罕见事件被高估。",
    ],
    typicalProblems: ["医疗检测", "质量检测", "垃圾邮件判断", "原因反推"],
    examples: [
      "某疾病发病率为 1%，检测对患病者阳性的概率为 99%，对未患病者误报阳性的概率为 5%。若检测阳性，求真正患病的概率。",
    ],
    difficulty: 3,
    tags: ["bayes", "conditional-probability", "inverse-inference"],
    variables: [
      {
        symbol: "P(A \\mid B)",
        name: "后验概率",
        description: "已知 B 发生后，A 发生的概率。",
      },
      {
        symbol: "P(B \\mid A)",
        name: "似然",
        description: "假设 A 发生时，B 发生的概率。",
      },
      {
        symbol: "P(A)",
        name: "先验概率",
        description: "没有观察到 B 之前，A 发生的概率。",
      },
      {
        symbol: "P(B)",
        name: "证据概率",
        description: "B 发生的总概率，常用全概率公式计算。",
      },
    ],
    reviewItems: [
      {
        type: QuestionType.fill_blank,
        prompt: "写出贝叶斯定理的核心表达式。",
        answer: "P(A|B)=P(B|A)P(A)/P(B)",
        explanation: "注意竖线两侧的方向：它是从 B 反推 A。",
        difficulty: 2,
      },
      {
        type: QuestionType.single_choice,
        prompt:
          "题目给出“患病时检测阳性的概率”，却要求“检测阳性时患病的概率”，应优先想到什么公式？",
        answer: "贝叶斯定理。",
        explanation: "这是典型的从结果反推原因。",
        difficulty: 2,
      },
      {
        type: QuestionType.short_answer,
        prompt:
          "A 线生产 60% 零件，次品率 1%；B 线生产 40% 零件，次品率 2%。抽到一个次品，求它来自 A 线的概率。",
        answer:
          "P(A|次)=0.01*0.6/(0.01*0.6+0.02*0.4)=0.006/0.014=3/7。",
        explanation: "分母是抽到次品的总概率。",
        difficulty: 3,
      },
    ],
  },
  {
    slug: "law-of-total-probability",
    title: "全概率公式",
    contentType: KnowledgeItemType.math_formula,
    renderPayload: "P(B)=\\sum_i P(B \\mid A_i)P(A_i)",
    domain: "概率统计",
    subdomain: "条件概率",
    summary: "把一个结果的总概率拆成多个互斥原因路径再相加。",
    body:
      "当样本空间被一组互斥且完备的事件划分时，某个结果 B 的概率可以按每条路径加权求和。",
    intuition: "像树状图上每条通往 B 的路径概率相加。",
    deepDive: "由 B=(B∩A1)∪...∪(B∩An) 且各部分互斥可得。",
    useConditions: [
      "原因集合 A_i 两两互斥且覆盖全部可能。",
      "题目要求某个结果 B 的总概率。",
      "每条路径的条件概率 P(B|A_i) 和权重 P(A_i) 可知。",
    ],
    nonUseConditions: [
      "题目要求的是 P(A|B) 这类反向条件概率时，不能只停在全概率公式。",
      "原因路径不是互斥且完备划分时，不能直接套用。",
    ],
    antiPatterns: [
      "原因集合没有覆盖全部情况。",
      "把不同路径概率直接相加但漏乘路径权重。",
      "和贝叶斯公式混淆，没有看清要求的是总概率还是反推原因。",
    ],
    typicalProblems: ["抽样来源混合", "生产线次品率", "分层人群事件率"],
    examples: [
      "A 线生产 60% 零件且次品率 1%，B 线生产 40% 零件且次品率 2%，随机抽到次品的总概率是多少？",
    ],
    difficulty: 2,
    tags: ["total-probability", "conditional-probability", "partition"],
    variables: [
      {
        symbol: "A_i",
        name: "原因划分",
        description: "一组互斥且完备的事件。",
      },
      {
        symbol: "P(B \\mid A_i)",
        name: "路径条件概率",
        description: "在原因 A_i 发生时，结果 B 发生的概率。",
      },
      {
        symbol: "P(A_i)",
        name: "路径权重",
        description: "原因 A_i 本身发生的概率。",
      },
    ],
    reviewItems: [
      {
        type: QuestionType.fill_blank,
        prompt: "写出离散划分下的全概率公式。",
        answer: "P(B)=Σ P(B|A_i)P(A_i)",
        explanation: "每条路径先乘条件概率和路径权重，再求和。",
        difficulty: 2,
      },
      {
        type: QuestionType.single_choice,
        prompt:
          "题目要求“随机抽到一个次品的总概率”，且给出各生产线占比和次品率，应优先想到什么公式？",
        answer: "全概率公式。",
        explanation: "生产线是互斥路径，次品是结果。",
        difficulty: 2,
      },
      {
        type: QuestionType.short_answer,
        prompt: "A 线占 60%，次品率 1%；B 线占 40%，次品率 2%。求总体次品率。",
        answer: "0.6*0.01+0.4*0.02=0.014，即 1.4%。",
        explanation: "按两条来源路径加权求和。",
        difficulty: 2,
      },
    ],
  },
  {
    slug: "expectation-linearity",
    title: "期望的线性性质",
    contentType: KnowledgeItemType.math_formula,
    renderPayload: "E(aX+bY)=aE(X)+bE(Y)",
    domain: "概率统计",
    subdomain: "随机变量",
    summary: "把复杂随机变量的平均值拆成多个简单部分的平均值。",
    body:
      "无论随机变量是否独立，期望都满足线性加法和数乘规则。",
    intuition: "平均值可以先拆账再合账，不需要每个部分互不影响。",
    deepDive: "由期望定义和求和/积分的线性性质得到。",
    useConditions: [
      "需要计算多个随机变量线性组合的期望。",
      "只涉及加法、减法和常数倍。",
      "不需要随机变量相互独立。",
    ],
    nonUseConditions: [
      "题目涉及乘积期望 E(XY) 时，不能直接把线性性套到乘法上。",
      "题目要求的是方差、协方差，而不是期望时，需要换公式。",
    ],
    antiPatterns: [
      "误以为必须独立才能使用期望线性性。",
      "把 E(XY)=E(X)E(Y) 也当成无条件成立。",
      "遗漏常数项的期望。",
    ],
    typicalProblems: ["总收益期望", "指示变量法", "抽奖平均收益"],
    examples: [
      "掷 10 次硬币，令 X 为正面次数，可把 X 拆成 10 个指示变量求期望。",
    ],
    difficulty: 2,
    tags: ["expectation", "linearity", "random-variable"],
    variables: [
      {
        symbol: "E(X)",
        name: "X 的期望",
        description: "随机变量 X 的长期平均值。",
      },
      {
        symbol: "a,b",
        name: "常数系数",
        description: "线性组合中的固定倍数。",
      },
    ],
    reviewItems: [
      {
        type: QuestionType.fill_blank,
        prompt: "写出两个随机变量线性组合的期望公式。",
        answer: "E(aX+bY)=aE(X)+bE(Y)",
        explanation: "不需要 X 与 Y 独立。",
        difficulty: 1,
      },
      {
        type: QuestionType.single_choice,
        prompt: "计算总收益的平均值，收益可拆成多个部分相加，应优先想到什么性质？",
        answer: "期望的线性性质。",
        explanation: "平均值对加法和数乘保持线性。",
        difficulty: 1,
      },
      {
        type: QuestionType.short_answer,
        prompt: "若 E(X)=3，E(Y)=5，求 E(2X-4Y+7)。",
        answer: "2*3-4*5+7=-7。",
        explanation: "常数 7 的期望仍是 7。",
        difficulty: 1,
      },
    ],
  },
  {
    slug: "variance-shift-scale",
    title: "方差的平移与缩放",
    contentType: KnowledgeItemType.math_formula,
    renderPayload: "\\operatorname{Var}(aX+b)=a^2\\operatorname{Var}(X)",
    domain: "概率统计",
    subdomain: "随机变量",
    summary: "判断随机变量线性变换后离散程度如何变化。",
    body:
      "加常数只移动中心，不改变离散程度；乘常数会让方差按常数平方缩放。",
    intuition: "整体平移不改变散开程度，拉伸两倍会让平方距离变成四倍。",
    deepDive:
      "由 Var(X)=E[(X-E(X))^2] 代入 aX+b 后，b 与均值平移相互抵消，a 被平方提出。",
    useConditions: [
      "随机变量发生线性变换 aX+b。",
      "需要比较或计算方差。",
      "只讨论离散程度，不讨论均值本身。",
    ],
    nonUseConditions: [
      "题目要求期望线性变换时，不能把方差公式直接拿来用。",
      "线性变换之外的非线性函数（如 X²）不能直接套 Var(aX+b)。",
    ],
    antiPatterns: [
      "误以为加常数 b 会增加方差。",
      "忘记缩放系数 a 要平方。",
      "把方差变换和期望线性变换混在一起。",
    ],
    typicalProblems: ["标准化", "单位换算", "线性变换后的波动"],
    examples: [
      "若 Var(X)=9，求 Var(2X+10)。答案是 4*9=36。",
    ],
    difficulty: 2,
    tags: ["variance", "random-variable", "scale-shift"],
    variables: [
      {
        symbol: "\\operatorname{Var}(X)",
        name: "X 的方差",
        description: "随机变量 X 相对其均值的平均平方偏离。",
      },
      {
        symbol: "a",
        name: "缩放系数",
        description: "会以平方倍数影响方差。",
      },
      {
        symbol: "b",
        name: "平移常数",
        description: "只移动位置，不改变方差。",
      },
    ],
    reviewItems: [
      {
        type: QuestionType.fill_blank,
        prompt: "写出 Var(aX+b) 的公式。",
        answer: "Var(aX+b)=a²Var(X)",
        explanation: "b 不影响方差，a 要平方。",
        difficulty: 2,
      },
      {
        type: QuestionType.single_choice,
        prompt:
          "题目问单位换算后方差如何变化，例如 X 从米变成厘米，应想到哪个公式？",
        answer: "方差的平移与缩放公式。",
        explanation: "单位缩放会按比例的平方影响方差。",
        difficulty: 2,
      },
      {
        type: QuestionType.short_answer,
        prompt: "若 Var(X)=4，求 Var(3X-2)。",
        answer: "Var(3X-2)=9*4=36。",
        explanation: "平移 -2 不影响方差。",
        difficulty: 2,
      },
    ],
  },
  {
    slug: "aberration",
    title: "aberration",
    contentType: KnowledgeItemType.vocabulary,
    renderPayload: {
      term: "aberration",
      phonetic: "/ab-er-ay-shun/",
      partOfSpeech: "noun",
      definition: "偏离常态的事物或异常情况。",
      examples: ["The sudden spike was an aberration, not a trend."],
    },
    domain: "英语词汇",
    subdomain: "学术词汇",
    summary: "表示异常、偏离常态的情况。",
    body: "aberration 常用于描述与正常模式不一致、不能代表长期趋势的异常点。",
    intuition: "把它记成数据图上突然偏出去的一个点。",
    deepDive: null,
    useConditions: ["描述异常现象、异常数据点或偏离常规的行为。"],
    nonUseConditions: ["描述普通变化或长期趋势时，不要用 aberration。"],
    antiPatterns: ["把 aberration 当成普通 mistake 使用，忽略它的“异常偏离”含义。"],
    typicalProblems: ["阅读理解中的异常点判断", "学术写作中的趋势排除"],
    examples: ["The result was an aberration caused by a temporary sensor error."],
    difficulty: 2,
    tags: ["vocabulary", "academic"],
    variables: [],
    reviewItems: [
      {
        type: QuestionType.fill_blank,
        prompt: "回忆 aberration 的核心释义。",
        answer: "异常情况；偏离常态的事物。",
        explanation: "重点是 departure from what is normal。",
        difficulty: 2,
      },
      {
        type: QuestionType.single_choice,
        prompt: "看到 a sudden spike was not a trend，应想到哪个表示异常点的词？",
        answer: "aberration",
        explanation: "它强调该现象偏离常态，不能代表趋势。",
        difficulty: 2,
      },
      {
        type: QuestionType.short_answer,
        prompt: "用 aberration 表达“这次下降只是异常，不是长期趋势”。",
        answer: "The drop was an aberration, not a long-term trend.",
        explanation: "not a trend 能强化它的异常含义。",
        difficulty: 3,
      },
    ],
  },
  {
    slug: "daily-review-checklist",
    title: "每日复习检查清单",
    contentType: KnowledgeItemType.plain_text,
    renderPayload: {
      text: "先完成到期复习，再处理 Again 和 Hard，最后为最卡的一条补一句下次提示。",
    },
    domain: "学习方法",
    subdomain: "复习流程",
    summary: "每日复习按到期、补弱、提示三步推进。",
    body: "这条清单用于防止复习时只刷题不修复记忆线索。每天结束前至少为一个薄弱知识项写下自己的提示。",
    intuition: "先清队列，再修最弱点，最后留下下次能接住自己的线索。",
    deepDive: null,
    useConditions: ["开始每日复习或复盘一次训练结果时。"],
    nonUseConditions: ["只是在快速浏览资料、没有进入训练闭环时。"],
    antiPatterns: ["只完成题目数量，不处理 Again/Hard 暴露的问题。"],
    typicalProblems: ["训练后复盘", "补弱入口选择", "下次提示整理"],
    examples: ["今天先做 due now，再打开补弱列表，最后给最弱的一条写 memory hook。"],
    difficulty: 1,
    tags: ["process", "review"],
    variables: [],
    reviewItems: [
      {
        type: QuestionType.fill_blank,
        prompt: "每日复习检查清单的三步是什么？",
        answer: "到期复习、处理 Again/Hard、补一句下次提示。",
        explanation: "顺序是先完成队列，再修复薄弱点。",
        difficulty: 1,
      },
      {
        type: QuestionType.single_choice,
        prompt: "如果今天出现 Again，复习结束前至少要补什么？",
        answer: "为最卡的一条补一句下次提示。",
        explanation: "提示能降低下次重新启动记忆的成本。",
        difficulty: 1,
      },
      {
        type: QuestionType.short_answer,
        prompt: "今天复习后有 2 条 Hard，你下一步怎么做？",
        answer: "打开补弱列表，优先处理 Hard/Again，并为最弱项写提示。",
        explanation: "不要只看完成数量，要修复暴露出的薄弱点。",
        difficulty: 2,
      },
    ],
  },
];

const relations: Array<{
  from: string;
  to: string;
  relationType: KnowledgeItemRelationType;
  note: string;
}> = [
  {
    from: "bayes-theorem",
    to: "law-of-total-probability",
    relationType: KnowledgeItemRelationType.prerequisite,
    note: "全概率公式常用于展开贝叶斯分母 P(B)。",
  },
  {
    from: "law-of-total-probability",
    to: "bayes-theorem",
    relationType: KnowledgeItemRelationType.related,
    note: "先算结果总概率，再支持反推原因。",
  },
  {
    from: "expectation-linearity",
    to: "variance-shift-scale",
    relationType: KnowledgeItemRelationType.confusable,
    note: "期望对 aX+b 是线性的，方差对缩放系数要平方且不受平移影响。",
  },
  {
    from: "variance-shift-scale",
    to: "expectation-linearity",
    relationType: KnowledgeItemRelationType.confusable,
    note: "不要把 Var(aX+b) 错写成 aVar(X)+b。",
  },
];

async function main() {
  await prisma.questionAttempt.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.diagnosticAttempt.deleteMany();
  await prisma.userKnowledgeItemState.deleteMany();
  await prisma.knowledgeItemMemoryHook.deleteMany();
  await prisma.questionKnowledgeItem.deleteMany();
  await prisma.question.deleteMany();
  await prisma.knowledgeItemRelation.deleteMany();
  await prisma.knowledgeItem.deleteMany();

  const created = new Map<string, string>();

  for (const knowledgeItem of knowledgeItems) {
    const item = await prisma.knowledgeItem.create({
      data: {
        slug: knowledgeItem.slug,
        title: knowledgeItem.title,
        contentType: knowledgeItem.contentType,
        renderPayload: normalizeSeedRenderPayload(knowledgeItem) as Prisma.InputJsonValue,
        domain: knowledgeItem.domain,
        subdomain: knowledgeItem.subdomain,
        summary: knowledgeItem.summary,
        body: knowledgeItem.body,
        difficulty: knowledgeItem.difficulty,
        tags: knowledgeItem.tags,
      },
    });

    created.set(knowledgeItem.slug, item.id);

    for (const reviewItem of knowledgeItem.reviewItems) {
      await prisma.question.create({
        data: {
          type: reviewItem.type,
          prompt: reviewItem.prompt,
          options: questionOptionsForSeedReviewItem(reviewItem),
          answer: questionAnswerForSeedReviewItem(reviewItem) as Prisma.InputJsonValue,
          answerAliases: [reviewItem.answer],
          explanation: reviewItem.explanation,
          difficulty: reviewItem.difficulty,
          tags: knowledgeItem.tags,
          gradingMode:
            reviewItem.type === QuestionType.short_answer
              ? QuestionGradingMode.ai
              : QuestionGradingMode.rule,
          knowledgeItems: {
            create: {
              knowledgeItemId: item.id,
            },
          },
        },
      });
    }
  }

  for (const relation of relations) {
    const fromKnowledgeItemId = created.get(relation.from);
    const toKnowledgeItemId = created.get(relation.to);

    if (!fromKnowledgeItemId || !toKnowledgeItemId) {
      throw new Error(`Missing relation knowledgeItem: ${relation.from} -> ${relation.to}`);
    }

    await prisma.knowledgeItemRelation.create({
      data: {
        fromKnowledgeItemId,
        toKnowledgeItemId,
        relationType: relation.relationType,
        note: relation.note,
      },
    });
  }
}

function normalizeSeedRenderPayload(knowledgeItem: SeedKnowledgeItem) {
  if (typeof knowledgeItem.renderPayload !== "string") {
    return knowledgeItem.renderPayload;
  }

  if (knowledgeItem.contentType === KnowledgeItemType.plain_text) {
    return { text: knowledgeItem.renderPayload };
  }

  if (knowledgeItem.contentType === KnowledgeItemType.math_formula) {
    return {
      latex: knowledgeItem.renderPayload,
      explanation: knowledgeItem.summary,
      variables: knowledgeItem.variables.map((variable) => ({
        symbol: variable.symbol,
        name: variable.name,
        meaning: variable.description,
      })),
    };
  }

  return { text: knowledgeItem.renderPayload };
}

function questionOptionsForSeedReviewItem(reviewItem: SeedKnowledgeItem["reviewItems"][number]) {
  if (reviewItem.type !== QuestionType.single_choice) {
    return undefined;
  }

  return [
    { id: "a", text: reviewItem.answer },
    { id: "b", text: "以上都不适合" },
    { id: "c", text: "需要先补充题目条件" },
  ] satisfies Prisma.InputJsonValue;
}

function questionAnswerForSeedReviewItem(reviewItem: SeedKnowledgeItem["reviewItems"][number]) {
  if (reviewItem.type === QuestionType.single_choice) {
    return { optionId: "a" };
  }

  return { text: reviewItem.answer };
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
