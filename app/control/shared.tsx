"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { errorText } from "../lib/errors";

export type AdminCopy = (typeof copy)[Lang]["admin"];
export type Permission = keyof AdminCopy["permissions"];
export type Kind = keyof AdminCopy["kinds"];
export type Actor = { id: string; name: string; owner: boolean; permissions: Permission[] };
export type AdminProps = { lang: Lang; t: AdminCopy; actor: Actor; socialOrigin: string };

export function allowed(actor: Actor, permission: Permission) {
  return actor.owner || actor.permissions.includes(permission);
}

export function admin<T>(path: string, input?: object | FormData, signal?: AbortSignal) {
  return api<T>(`admin/${path}`, input, signal);
}

export function useAdminData<T>(path: string | null, lang: Lang) {
  const [result, setResult] = useState<{ path: string; value: T } | null>(null);
  const [failure, setFailure] = useState<{ path: string; error: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setFailure(null);
    admin<T>(path, undefined, controller.signal).then(value => {
      if (!controller.signal.aborted) setResult({ path, value });
    }).catch(error => {
      if (!controller.signal.aborted) setFailure({ path, error: errorText(lang, error) });
    });
    return () => controller.abort();
  }, [path, lang, revision]);
  return { value: result?.path === path ? result?.value : undefined, error: failure?.path === path ? failure?.error : undefined, reload };
}

export function useOperation(lang: Lang) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>, done?: () => void) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await action(); done?.(); }
    catch (cause) { setError(errorText(lang, cause)); }
    finally { setBusy(false); }
  }
  return { run, busy, error, reset: () => setError("") };
}

export function date(lang: Lang, seconds?: number | null) {
  return seconds == null ? copy[lang].admin.unknown
    : new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(seconds * 1000).toLowerCase();
}

export function ErrorNotice({ error }: { error?: string }) {
  return error ? <p className="control-error" role="alert">{error}</p> : null;
}

export function Confirm({ title, t, children, cancel, confirm, error, disabled, danger }: {
  title: string; t: AdminCopy; children?: ReactNode; cancel: () => void; confirm: () => void; error?: string; disabled?: boolean; danger?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const current = dialog.current;
    if (!current) return;
    current.showModal();
    return () => current.close();
  }, []);
  return <dialog ref={dialog} className="control-confirm" aria-label={title} onCancel={event => {
    event.preventDefault();
    if (!disabled) cancel();
  }} onClick={event => {
    if (event.target !== event.currentTarget || disabled) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) cancel();
  }}>
      <h2>{title}</h2>{children}<ErrorNotice error={error} />
      <div className="control-actions">
        <button type="button" onClick={cancel} autoFocus disabled={disabled}>{t.cancel}</button>
        <button type="button" className={danger ? "control-danger" : "control-primary"} onClick={confirm} disabled={disabled}>{t.confirm}</button>
      </div>
  </dialog>;
}

export function submit(event: FormEvent<HTMLFormElement>, callback: (data: FormData) => void) {
  event.preventDefault();
  callback(new FormData(event.currentTarget));
}
