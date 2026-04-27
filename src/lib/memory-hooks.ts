export const GUIDED_MEMORY_PROMPTS = [
  "这条知识项最容易卡在哪里？",
  "下次看到题目时，第一步该提醒自己什么？",
  "它通常适合什么题型，什么时候不能用？",
  "有没有一句自己的话能帮你想起它？",
] as const;

export function formatMemoryHookUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(updatedAt));
}
