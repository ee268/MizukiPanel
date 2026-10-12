import { useEffect, useRef, useState } from "react";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";
import { usePersonalSettings } from "../settings/PersonalSettingsProvider";
import { aiCredentials } from "./credentials";
import { useAiCredential } from "./useAiCredential";
import { sessionLifecycle } from "../auth/session-lifecycle";
import {
  aiWritingActions,
  type AiWritingContext,
  type AiWritingAction,
  type AiWritingResult,
  type AiWritingSettings,
} from "../../shared/ai-writing";
import { containsApiCredential } from "../../shared/api-credentials";

export function useAiWriting(context: AiWritingContext, title: string) {
  const preferences = usePersonalSettings();
  const [settings, setSettings] = useState<AiWritingSettings>(preferences.saved.ai);
  const openaiKey = useAiCredential("openai");
  const anthropicKey = useAiCredential("anthropic");
  const [action, setAction] = useState<AiWritingAction>(context.selection ? "polish" : "continue");
  const [instruction, setInstruction] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [result, setResult] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  function cancel() {
    sequence.current++;
    request.current?.abort();
    request.current = null;
    setLoading(false);
  }
  useEffect(
    () => () => {
      sequence.current++;
      request.current?.abort();
    },
    [],
  );
  useEffect(
    () =>
      sessionLifecycle.subscribe(() => {
        if (sessionLifecycle.getState().exit) cancel();
      }),
    [],
  );
  async function generate() {
    if (loading || request.current) return;
    const key = aiCredentials.get(settings.provider);
    if (!key) {
      setError("请填写本次会话的 API Key。");
      return;
    }
    if (
      ![settings.openaiModel, settings.anthropicModel][
        settings.provider === "openai" ? 0 : 1
      ].trim()
    ) {
      setError("请填写模型 ID。");
      return;
    }
    if (action === "custom" && !instruction.trim()) {
      setError("请填写自定义写作要求。");
      return;
    }
    const current = ++sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setLoading(true);
    setError("");
    setResult("");
    setTruncated(false);
    try {
      const response = await api<AiWritingResult>("/api/article/ai-writing", {
        ...json("POST", {
          settings,
          apiKey: key,
          action,
          instruction,
          title,
          context: includeContext ? context.body : "",
          selection: context.selection,
        }),
        signal: abort.signal,
      });
      if (current !== sequence.current || abort.signal.aborted) return;
      setResult(response.text);
      setTruncated(response.truncated);
    } catch (cause) {
      if (current === sequence.current && !abort.signal.aborted)
        setError(errorMessage(cause, "AI 写作请求失败，请重试。"));
    } finally {
      if (current === sequence.current) {
        request.current = null;
        setLoading(false);
      }
    }
  }
  const canApply =
    Boolean(result.trim()) &&
    !containsApiCredential(result) &&
    ![openaiKey, anthropicKey].some((key) => key && result.includes(key));
  return {
    settings,
    setSettings,
    action,
    setAction,
    instruction,
    setInstruction,
    includeContext,
    setIncludeContext,
    result,
    setResult,
    truncated,
    error,
    setError,
    loading,
    generate,
    cancel,
    canApply,
    actions: aiWritingActions,
  };
}
