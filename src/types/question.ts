export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "short_answer";

export type QuestionGradingMode = "rule" | "ai";
export type QuestionAttemptResult = "correct" | "partial" | "incorrect";

export type QuestionOption = {
  id: string;
  text: string;
};

export type SingleChoiceAnswer = {
  optionId: string;
};

export type MultipleChoiceAnswer = {
  optionIds: string[];
};

export type TrueFalseAnswer = {
  value: boolean;
};

export type TextAnswer = {
  text: string;
};

export type QuestionAnswer =
  | SingleChoiceAnswer
  | MultipleChoiceAnswer
  | TrueFalseAnswer
  | TextAnswer;

export type NormalizedQuestion = {
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  answer: QuestionAnswer;
  answerAliases: string[];
  explanation: string | null;
  difficulty: number;
  tags: string[];
  gradingMode: QuestionGradingMode;
};

export type QuestionGrade = {
  result: QuestionAttemptResult;
  score: number;
  feedback: string;
};
