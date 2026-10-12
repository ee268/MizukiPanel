/** Detect common OpenAI/Anthropic tokens without returning or logging their value. */
export function containsApiCredential(text: string): boolean {
  return (
    /\bsk-(?:ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}/.test(text) ||
    /["']?(?:api[_-]?key|OPENAI_API_KEY|ANTHROPIC_API_KEY)["']?\s*[:=]\s*["'][^"'\s{}$]{16,}["']/i.test(
      text,
    ) ||
    /^(?:export\s+)?(?:OPENAI|ANTHROPIC|AI)_API_KEY\s*=\s*[^\s"'${}]{16,}\s*$/m.test(text)
  );
}
