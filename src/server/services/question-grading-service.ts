import { chatJson, type AiEnv } from "@/server/ai/openai-compatible";
import type {
  QuestionAnswer,
  QuestionAttemptResult,
  QuestionGrade,
  QuestionType,
} from "@/types/question";

type GradeQuestion = {
  type: QuestionType;
  prompt?: string;
  answer: QuestionAnswer;
  answerAliases: string[];
  explanation?: string | null;
};

export type AiShortAnswerGrade = {
  result: QuestionAttemptResult;
  score: number;
  feedback: string;
};

export type QuestionAiGrader = (input: {
  prompt: string;
  referenceAnswer: string;
  explanation: string;
  submittedAnswer: string;
}) => Promise<AiShortAnswerGrade>;

export async function gradeQuestionAnswer({
  question,
  submittedAnswer,
  aiGrader,
  env,
  fetcher,
}: {
  question: GradeQuestion;
  submittedAnswer: QuestionAnswer;
  aiGrader?: QuestionAiGrader;
  env?: AiEnv;
  fetcher?: typeof fetch;
}): Promise<QuestionGrade> {
  if (question.type === "short_answer") {
    return gradeShortAnswer({
      question,
      submittedAnswer,
      aiGrader,
      env,
      fetcher,
    });
  }

  const correct = gradeRuleAnswer(question, submittedAnswer);

  return {
    result: correct ? "correct" : "incorrect",
    score: correct ? 1 : 0,
    feedback: correct ? "回答正确。" : "回答不正确。",
  };
}

function gradeRuleAnswer(question: GradeQuestion, submittedAnswer: QuestionAnswer) {
  if (question.type === "single_choice") {
    return "optionId" in question.answer &&
      "optionId" in submittedAnswer &&
      question.answer.optionId === submittedAnswer.optionId;
  }

  if (question.type === "multiple_choice") {
    return "optionIds" in question.answer &&
      "optionIds" in submittedAnswer &&
      sameSet(question.answer.optionIds, submittedAnswer.optionIds);
  }

  if (question.type === "true_false") {
    return "value" in question.answer &&
      "value" in submittedAnswer &&
      question.answer.value === submittedAnswer.value;
  }

  if (question.type === "fill_blank") {
    return "text" in question.answer &&
      "text" in submittedAnswer &&
      acceptedFillBlankAnswers(question).has(normalizeAnswerText(submittedAnswer.text));
  }

  return false;
}

async function gradeShortAnswer({
  question,
  submittedAnswer,
  aiGrader,
  env,
  fetcher,
}: {
  question: GradeQuestion;
  submittedAnswer: QuestionAnswer;
  aiGrader?: QuestionAiGrader;
  env?: AiEnv;
  fetcher?: typeof fetch;
}) {
  if (!("text" in question.answer) || !("text" in submittedAnswer)) {
    throw new Error("short answer grading requires text answers");
  }

  const input = {
    prompt: question.prompt ?? "",
    referenceAnswer: question.answer.text,
    explanation: question.explanation ?? "",
    submittedAnswer: submittedAnswer.text,
  };
  const grade = aiGrader
    ? await aiGrader(input)
    : await gradeShortAnswerWithAi({ ...input, env, fetcher });

  return normalizeAiGrade(grade);
}

async function gradeShortAnswerWithAi({
  prompt,
  referenceAnswer,
  explanation,
  submittedAnswer,
  env,
  fetcher,
}: {
  prompt: string;
  referenceAnswer: string;
  explanation: string;
  submittedAnswer: string;
  env?: AiEnv;
  fetcher?: typeof fetch;
}) {
  return chatJson<AiShortAnswerGrade>({
    env,
    fetcher,
    maxTokens: 180,
    temperature: 0,
    mockText: JSON.stringify({
      result: "partial",
      score: 0.5,
      feedback: "AI 判分未启用时返回中性结果。",
    }),
    messages: [
      {
        role: "system",
        content:
          '你是 KnowledgeVault 的简答题判分助手。只返回 JSON：{"result":"correct|partial|incorrect","score":0到1之间的数字,"feedback":"中文反馈"}。',
      },
      {
        role: "user",
        content: [
          `题目：${prompt}`,
          `参考答案：${referenceAnswer}`,
          `解释：${explanation}`,
          `学习者答案：${submittedAnswer}`,
        ].join("\n"),
      },
    ],
  });
}

function normalizeAiGrade(grade: AiShortAnswerGrade): QuestionGrade {
  const result =
    grade.result === "correct" ||
    grade.result === "partial" ||
    grade.result === "incorrect"
      ? grade.result
      : "incorrect";
  const score = clamp(Number(grade.score) || 0, 0, 1);

  return {
    result,
    score,
    feedback: typeof grade.feedback === "string" ? grade.feedback.trim() : "",
  };
}

function acceptedFillBlankAnswers(question: GradeQuestion) {
  const answers = new Set<string>();

  if ("text" in question.answer) {
    answers.add(normalizeAnswerText(question.answer.text));
  }

  question.answerAliases.forEach((alias) => {
    answers.add(normalizeAnswerText(alias));
  });

  return answers;
}

function normalizeAnswerText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:\s]+/g, "");
}

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
