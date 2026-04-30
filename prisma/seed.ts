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
  renderPayload: Record<string, unknown>;
  domain: string;
  subdomain: string | null;
  summary: string;
  body: string;
  difficulty: number;
  tags: string[];
  questions: Array<{
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
    renderPayload: {
      latex: "P(A \\mid B)=\\frac{P(B \\mid A)P(A)}{P(B)}",
      explanation: "已知结果发生，反推导致该结果的某个原因的概率。",
      variables: [
        {
          symbol: "P(A \\mid B)",
          name: "后验概率",
          meaning: "已知 B 发生后，A 发生的概率。",
        },
        {
          symbol: "P(B \\mid A)",
          name: "似然",
          meaning: "假设 A 发生时，B 发生的概率。",
        },
        {
          symbol: "P(A)",
          name: "先验概率",
          meaning: "没有观察到 B 之前，A 发生的概率。",
        },
        {
          symbol: "P(B)",
          name: "证据概率",
          meaning: "B 发生的总概率，常用全概率公式计算。",
        },
      ],
    },
    domain: "概率统计",
    subdomain: "条件概率",
    summary: "已知结果发生，反推导致该结果的某个原因的概率。",
    body:
      "贝叶斯定理把先验概率和观测到的证据结合起来，更新某个原因或假设成立的概率。",
    difficulty: 3,
    tags: ["bayes", "conditional-probability", "inverse-inference"],
    questions: [
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
    renderPayload: {
      latex: "P(B)=\\sum_i P(B \\mid A_i)P(A_i)",
      explanation: "把一个结果的总概率拆成多个互斥原因路径再相加。",
      variables: [
        {
          symbol: "A_i",
          name: "原因划分",
          meaning: "一组互斥且完备的事件。",
        },
        {
          symbol: "P(B \\mid A_i)",
          name: "路径条件概率",
          meaning: "在原因 A_i 发生时，结果 B 发生的概率。",
        },
        {
          symbol: "P(A_i)",
          name: "路径权重",
          meaning: "原因 A_i 本身发生的概率。",
        },
      ],
    },
    domain: "概率统计",
    subdomain: "条件概率",
    summary: "把一个结果的总概率拆成多个互斥原因路径再相加。",
    body:
      "当样本空间被一组互斥且完备的事件划分时，某个结果 B 的概率可以按每条路径加权求和。",
    difficulty: 2,
    tags: ["total-probability", "conditional-probability", "partition"],
    questions: [
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
    renderPayload: {
      latex: "E(aX+bY)=aE(X)+bE(Y)",
      explanation: "把复杂随机变量的平均值拆成多个简单部分的平均值。",
      variables: [
        {
          symbol: "E(X)",
          name: "X 的期望",
          meaning: "随机变量 X 的长期平均值。",
        },
        {
          symbol: "a,b",
          name: "常数系数",
          meaning: "线性组合中的固定倍数。",
        },
      ],
    },
    domain: "概率统计",
    subdomain: "随机变量",
    summary: "把复杂随机变量的平均值拆成多个简单部分的平均值。",
    body:
      "无论随机变量是否独立，期望都满足线性加法和数乘规则。",
    difficulty: 2,
    tags: ["expectation", "linearity", "random-variable"],
    questions: [
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
    renderPayload: {
      latex: "\\operatorname{Var}(aX+b)=a^2\\operatorname{Var}(X)",
      explanation: "判断随机变量线性变换后离散程度如何变化。",
      variables: [
        {
          symbol: "\\operatorname{Var}(X)",
          name: "X 的方差",
          meaning: "随机变量 X 相对其均值的平均平方偏离。",
        },
        {
          symbol: "a",
          name: "缩放系数",
          meaning: "会以平方倍数影响方差。",
        },
        {
          symbol: "b",
          name: "平移常数",
          meaning: "只移动位置，不改变方差。",
        },
      ],
    },
    domain: "概率统计",
    subdomain: "随机变量",
    summary: "判断随机变量线性变换后离散程度如何变化。",
    body:
      "加常数只移动中心，不改变离散程度；乘常数会让方差按常数平方缩放。",
    difficulty: 2,
    tags: ["variance", "random-variable", "scale-shift"],
    questions: [
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
      definition: "偏离常态的事物或异常情况。",
      examples: ["The sudden spike was an aberration, not a trend."],
    },
    domain: "英语词汇",
    subdomain: "学术词汇",
    summary: "表示异常、偏离常态的情况。",
    body: "aberration 常用于描述与正常模式不一致、不能代表长期趋势的异常点。",
    difficulty: 2,
    tags: ["vocabulary", "academic"],
    questions: [
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
    difficulty: 1,
    tags: ["process", "review"],
    questions: [
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
        renderPayload: knowledgeItem.renderPayload as Prisma.InputJsonValue,
        domain: knowledgeItem.domain,
        subdomain: knowledgeItem.subdomain,
        summary: knowledgeItem.summary,
        body: knowledgeItem.body,
        difficulty: knowledgeItem.difficulty,
        tags: knowledgeItem.tags,
      },
    });

    created.set(knowledgeItem.slug, item.id);

    for (const question of knowledgeItem.questions) {
      await prisma.question.create({
        data: {
          type: question.type,
          prompt: question.prompt,
          options: questionOptionsForSeedQuestion(question),
          answer: questionAnswerForSeedQuestion(question) as Prisma.InputJsonValue,
          answerAliases: [question.answer],
          explanation: question.explanation,
          difficulty: question.difficulty,
          tags: knowledgeItem.tags,
          gradingMode:
            question.type === QuestionType.short_answer
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

function questionOptionsForSeedQuestion(question: SeedKnowledgeItem["questions"][number]) {
  if (question.type !== QuestionType.single_choice) {
    return undefined;
  }

  return [
    { id: "a", text: question.answer },
    { id: "b", text: "以上都不适合" },
    { id: "c", text: "需要先补充题目条件" },
  ] satisfies Prisma.InputJsonValue;
}

function questionAnswerForSeedQuestion(question: SeedKnowledgeItem["questions"][number]) {
  if (question.type === QuestionType.single_choice) {
    return { optionId: "a" };
  }

  return { text: question.answer };
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
