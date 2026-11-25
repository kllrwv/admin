"use client";
import { useState } from "react";
import { admin, Confirm, ErrorNotice, submit, useAdminData, useOperation, type AdminProps } from "./shared";
type Alias = { username: string; enabled: boolean };
export function AliasEditor({ id, username, t, lang, refresh }: Pick<AdminProps, "t" | "lang"> & {
  id: string; username: string; refresh: () => void;
}) {
  const path = `accounts/${id}/usernames`;
  const aliases = useAdminData<Alias[]>(path, lang);
  const operation = useOperation(lang);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  function update() {
    aliases.reload();
    refresh();
  }
  return <section className="control-stack" aria-label={t.aliasesTitle}>
    <h3>{t.aliasesTitle}</h3>
    <p>{t.aliasesHint.replace("{username}", `@${username}`)}</p>
    <ErrorNotice error={aliases.error} />
    {!removing && <ErrorNotice error={operation.error} />}
    {aliases.value && <>
      <p className="control-alias-count">{aliases.value.length} / 72</p>
      <form className="control-inline control-alias-form" onSubmit={event => {
        const form = event.currentTarget;
        submit(event, input => void operation.run(() => admin(path, { op: "add", username: input.get("username") }), () => {
          form.reset(); update();
        }));
      }}>
        <input name="username" required minLength={3} maxLength={55} autoCapitalize="none" spellCheck={false}
          aria-label={t.aliasNew} placeholder={t.aliasNew} disabled={operation.busy || aliases.value.length >= 72} />
        <button className="control-primary" disabled={operation.busy || aliases.value.length >= 72}>{t.aliasAdd}</button>
      </form>
      {aliases.value.length === 0 ? <p>{t.aliasesEmpty}</p> : <ul className="control-alias-list">
        {aliases.value.map(alias => <li key={alias.username}>
          {editing === alias.username ? <form className="control-inline control-alias-form" onSubmit={event => submit(event, input => {
            void operation.run(() => admin(path, { op: "rename", existing: alias.username, username: input.get("username") }), () => {
              setEditing(null); update();
            });
          })}>
            <input name="username" defaultValue={alias.username} required minLength={3} maxLength={55} autoCapitalize="none" spellCheck={false} aria-label={t.aliasNew} />
            <button disabled={operation.busy}>{t.save}</button>
            <button type="button" disabled={operation.busy} onClick={() => { operation.reset(); setEditing(null); }}>{t.cancel}</button>
          </form> : <>
            <div className="control-alias-identity"><strong>@{alias.username}</strong><small>{alias.enabled ? t.aliasActive : t.aliasInactive}</small></div>
            <div className="control-actions control-wrap">
              <button type="button" disabled={operation.busy} onClick={() => { operation.reset(); setEditing(alias.username); }}>{t.aliasRename}</button>
              <button type="button" className="control-danger" disabled={operation.busy} onClick={() => { operation.reset(); setRemoving(alias.username); }}>{t.remove}</button>
            </div>
          </>}
        </li>)}
      </ul>}
    </>}
    {removing && <Confirm title={t.aliasConfirmRemove.replace("{username}", `@${removing}`)} t={t} error={operation.error} disabled={operation.busy}
      cancel={() => { operation.reset(); setRemoving(null); }} confirm={() => void operation.run(() => admin(path, { op: "remove", username: removing }), () => {
        setRemoving(null); update();
      })} />}
  </section>;
}
