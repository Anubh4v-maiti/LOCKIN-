export function aiConfigured(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() &&
      process.env.ENABLE_AI_INSIGHTS === "true",
  );
}
