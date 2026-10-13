import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, json } from "../api";
import { errorMessage } from "../shared/errors";

export function useLogin() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", json("POST", { token }));
      navigate("/", { replace: true });
    } catch (cause) {
      setError(errorMessage(cause, "登录失败"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return { token, setToken, error, busy, submit };
}
