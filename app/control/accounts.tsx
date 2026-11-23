"use client";

import { useRef, useState } from "react";
import { ChevronRight, Search, UserPlus, UserRound } from "lucide-react";
import { Verified } from "../ui/verified";
import { admin, allowed, Confirm, date, ErrorNotice, submit, useAdminData, useOperation,
  type AdminProps, type Permission } from "./shared";

type Person = {
  id: string; username: string | null; name: string | null; verified: boolean;
  deleted: boolean; avatar: boolean; review_account: boolean;
};
type Device = { id: string; device: string | null; seen: number; expires: number };
type Account = Person & {
  bio: string; created: number; last_seen: number | null; banner: boolean; avatar_hidden: boolean; banner_hidden: boolean; totp: boolean;
  email?: string | null; phone?: string | null; phone_tail?: string | null; telegram?: string | null; sessions?: Device[];
  followers: number; following: number; posts: number; comments: number;
  theme: string; wall_access: string; like_access: string; message_access: string; show_online: boolean;
  notice_preferences: Record<string, boolean>; owner?: boolean; permissions?: Permission[];
};
type Role = Person & { owner: boolean; permissions: Permission[] };

export function Accounts(props: AdminProps) {
  const { lang, t, actor } = props;
  const canRead = allowed(actor, "accounts.read");
  const canCreate = allowed(actor, "accounts.review.create");
  const [creating, setCreating] = useState(!canRead);
  const [created, setCreated] = useState("");
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, select] = useState<string | null>(null);
  const editor = useRef<HTMLElement>(null);
  const listing = useAdminData<Person[]>(canRead ? `accounts?q=${encodeURIComponent(term)}&offset=${offset}` : null, lang);
  const detail = useAdminData<Account>(canRead && selected ? `accounts/${selected}` : null, lang);
  return <div className="control-columns">
    <section className="control-box control-rail">
      {canCreate && <div className="control-actions">
        <button type="button" className="control-primary" onClick={() => { setCreated(""); setCreating(true); }}>
          <UserPlus size={16} aria-hidden="true" />{t.createReviewAccount}
        </button>
      </div>}
      {canRead && <>
      <form className="control-inline" onSubmit={event => submit(event, data => { setOffset(0); setTerm(String(data.get("q") ?? "")); })}>
        <input type="search" name="q" placeholder={t.search} aria-label={t.search} maxLength={120}/><button aria-label={t.find} title={t.find}><Search size={16}/></button>
      </form>
      <ErrorNotice error={listing.error} />
      {listing.value?.length === 0 && <p>{t.empty}</p>}
      <div className="control-list control-rail-list">{listing.value?.map(person => <button type="button" key={person.id} aria-pressed={person.id === selected}
        onClick={() => {
          setCreating(false);
          setCreated("");
          select(person.id);
          if (window.matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => editor.current?.scrollIntoView({block:"start"}));
        }}>
        <UserRound size={18} /><span><strong>{person.name ?? person.id}{person.verified && <Verified lang={lang} size={15} />}</strong>
          {person.username && <small>@{person.username}</small>}
          {person.review_account && <small>{t.reviewAccount}</small>}
          {person.deleted && <small className="control-error">{t.deletedAccount}</small>}</span>
        <ChevronRight size={16} />
      </button>)}</div>
      <div className="control-actions control-rail-footer"><button type="button" disabled={offset === 0} onClick={() => setOffset(offset - 50)}>{t.previous}</button>
        <button type="button" disabled={(listing.value?.length ?? 0) < 50} onClick={() => setOffset(offset + 50)}>{t.next}</button></div>
      </>}
    </section>
    <section className="control-box control-editor" ref={editor}>
      {created && <p role="status">{t.reviewAccountCreated.replace("{username}", `@${created}`)}</p>}
      {creating && canCreate ? <CreateReviewAccount {...props} cancel={canRead ? () => setCreating(false) : undefined}
        created={({id, username}) => {
          setCreated(username);
          if (canRead) {
            setCreating(false);
            select(id);
            setTerm("");
            setOffset(0);
            listing.reload();
          }
        }} /> : <>
        <ErrorNotice error={detail.error} />
        {!selected && <p className="control-empty">{t.chooseAccount}</p>}
        {detail.value && <AccountEditor key={detail.value.id} {...props} account={detail.value} reload={() => { detail.reload(); listing.reload(); }} />}
      </>}
    </section>
  </div>;
}

type CreatedReviewAccount = { id: string; username: string };

function CreateReviewAccount({ t, lang, cancel, created }: AdminProps & {
  cancel?: () => void; created: (value: CreatedReviewAccount) => void;
}) {
  const operation = useOperation(lang);
  return <form className="control-stack" onSubmit={event => {
    const form = event.currentTarget;
    submit(event, data => {
      void operation.run(async () => {
        const account = await admin<CreatedReviewAccount>("accounts", {
          name: String(data.get("name") ?? ""),
          username: String(data.get("username") ?? ""),
          password: String(data.get("password") ?? ""),
        });
        form.reset();
        created(account);
      });
    });
  }}>
    <h2>{t.createReviewAccount}</h2>
    <p>{t.reviewAccountHint}</p>
    <div className="control-fields">
      <label>{t.name}<input name="name" required maxLength={80} /></label>
      <label>{t.username}<input name="username" required minLength={3} maxLength={55} autoCapitalize="none" spellCheck={false} /></label>
      <label>{t.password}<input name="password" type="password" required minLength={10} maxLength={512} autoComplete="new-password" /></label>
    </div>
    <ErrorNotice error={operation.error} />
    <div className="control-actions">
      {cancel && <button type="button" onClick={cancel} disabled={operation.busy}>{t.cancel}</button>}
      <button type="submit" className="control-primary" disabled={operation.busy}>{t.createReviewAccount}</button>
    </div>
  </form>;
}

function AccountEditor({ account, reload, ...props }: AdminProps & { account: Account; reload: () => void }) {
  const { t, lang, actor } = props;
  const operation = useOperation(lang);
  const path = `accounts/${account.id}`;
  const [tab,setTab] = useState<"profileTab" | "securityTab" | "sessionsTab">("profileTab");
  const [pending, setPending] = useState<{ label: string; run: () => Promise<unknown>; irreversible?: boolean } | null>(null);
  const can = (permission: Permission) => allowed(actor, permission) &&
    (!account.owner || actor.id === account.id) && (account.permissions?.every(perm => allowed(actor, perm)) ?? true);
  const update = (data: object) => admin(path, data);
  const request = (label: string, data: object, irreversible?: boolean) => {
    operation.reset();
    setPending({ label, run: () => update(data), irreversible });
  };
  const noticeKeys = ["all", "sound", "messages", "follow", "wall", "like", "reply", "mention"];
  const noticeLabels = [t.everyone, t.notices, t.messageAccess, t.following, t.wallAccess, t.likeAccess, t.comments, t.description];

  return <div className="control-stack">
    <div className="control-account-head">
      <div className="control-account-identity">
      {account.avatar ? <img src={`/api/admin/accounts/${account.id}/avatar`} alt={t.avatar} width={48} height={48} />
        : <span className="control-avatar-fallback"><UserRound size={22}/></span>}
      <div><h2>{account.name ?? account.id} {account.verified && <Verified lang={lang} size={18} />}</h2>
        {account.username && <p>@{account.username}</p>}
        {account.review_account && <p>{t.reviewAccount}</p>}<small>{account.id}</small>
        {account.deleted && <p className="control-error">{t.deletedAccount}</p>}</div>
      </div>
      <div className="control-actions control-wrap">
        {can("accounts.badge") && <button type="button" onClick={() => request(account.verified ? t.unverify : t.verify,
          { op:"badge",value:!account.verified })}>{account.verified ? t.unverify : t.verify}</button>}
        {can("accounts.lifecycle") && !account.deleted && account.id !== actor.id &&
          <button className="control-danger" type="button" onClick={() => {
            operation.reset();
            setPending({ label:t.confirmRemove,run:()=>admin(`targets/account/${account.id}/delete`,{}) });
          }}>{t.remove}</button>}
      </div>
    </div>
    <div className="control-tabs control-editor-tabs">
      {(["profileTab","securityTab","sessionsTab"] as const).filter(key=>key!=="sessionsTab" || account.sessions!=null).map(key=>
        <button type="button" key={key} aria-pressed={tab===key} onClick={() => {operation.reset();setTab(key);}}>{t[key]}</button>)}
    </div>
    {!pending && <ErrorNotice error={operation.error} />}
    <section className="control-stack" hidden={tab!=="profileTab"} aria-label={t.profileTab}>
    <dl className="control-facts">
      <div><dt>{t.created}</dt><dd>{date(lang,account.created)}</dd></div><div><dt>{t.lastSeen}</dt><dd>{date(lang,account.last_seen)}</dd></div>
      <div><dt>{t.posts}</dt><dd>{account.posts}</dd></div><div><dt>{t.comments}</dt><dd>{account.comments}</dd></div>
      <div><dt>{t.followers}</dt><dd>{account.followers}</dd></div><div><dt>{t.following}</dt><dd>{account.following}</dd></div>
    </dl>
    {can("accounts.profile.write") && <form className="control-stack" onSubmit={event => submit(event, data => {
      const value = (key: string) => String(data.get(key) ?? "");
      void operation.run(() => update({
        op: "profile", name: value("name"), username: value("username"), bio: value("bio"), theme: value("theme"),
        wall_access: value("wall"), like_access: value("likes"), message_access: value("message"),
        show_online: data.has("online"), notice_preferences: Object.fromEntries(noticeKeys.map(key => [key,data.has(`notice_${key}`)])),
      }), reload);
    })}>
      <div className="control-fields">
        <label>{t.name}<input name="name" defaultValue={account.name ?? ""} required maxLength={80}/></label>
        <label>{t.username}<input name="username" defaultValue={account.username ?? ""} required minLength={3} maxLength={54}/></label>
      </div>
      <label>{t.bio}<textarea name="bio" defaultValue={account.bio} maxLength={500}/></label>
      <div className="control-fields">
        <label>{t.theme}<select name="theme" defaultValue={account.theme}><option value="dark">{t.dark}</option>
          <option value="light">{t.light}</option><option value="system">{t.system}</option></select></label>
        {([["wall", t.wallAccess, account.wall_access], ["likes", t.likeAccess, account.like_access],
          ["message",t.messageAccess,account.message_access]]).map(([key,label,value]) => <label key={key}>{label}
          <select name={key} defaultValue={value}><option value="everyone">{t.everyone}</option>
            <option value="followers">{t.followers}</option><option value="nobody">{t.nobody}</option></select></label>)}
      </div>
      <label className="control-check"><input type="checkbox" name="online" defaultChecked={account.show_online}/>{t.showOnline}</label>
      <details><summary>{t.notices}</summary><div className="control-permissions">
        {noticeKeys.map((key,index) => <label className="control-check" key={key}><input type="checkbox" name={`notice_${key}`}
          defaultChecked={account.notice_preferences[key] ?? key !== "sound"} />{noticeLabels[index]}</label>)}
      </div></details>
      <div><button className="control-primary" disabled={operation.busy}>{t.save}</button></div>
    </form>}
    {can("accounts.profile.write") && <div className="control-actions control-wrap">
      <label className="control-button">{t.uploadAvatar}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp"
        onChange={event => { const file = event.target.files?.[0]; if (file) {
          const data = new FormData(); data.set("avatar", file);
          void operation.run(() => admin(`${path}/avatar`, data), reload);
        } }}/></label>
      {account.avatar && !account.avatar_hidden && <button className="control-danger" onClick={() => request(t.hideAvatar, { op:"remove_avatar" })}>{t.hideAvatar}</button>}
      {account.banner && !account.banner_hidden && <button className="control-danger" onClick={() => request(t.hideBanner, { op:"remove_banner" })}>{t.hideBanner}</button>}
    </div>}
    </section>
    <section className="control-stack" hidden={tab!=="securityTab"} aria-label={t.securityTab}>
    <dl className="control-facts">
      {account.email !== undefined && <>
        <div><dt>{t.email}</dt><dd>{account.email ?? t.contactNotLinked}</dd></div>
        <div><dt>{t.phone}</dt><dd>{account.phone ?? (account.phone_tail ? `•••• ${account.phone_tail}` : account.review_account ? t.contactNotLinked : t.unknown)}</dd></div>
        <div><dt>{t.telegram}</dt><dd>{account.telegram ?? t.contactNotLinked}</dd></div>
      </>}
      <div><dt>{t.totp}</dt><dd>{account.totp ? t.yes : t.no}</dd></div>
    </dl>
    <div className="control-fields">
      {([
        ["email", t.email, "email", "accounts.contacts.write"], ["phone", t.phone, "tel", "accounts.contacts.write"],
        ["telegram", t.telegram, "text", "accounts.telegram.write"], ["password", t.password, "password", "accounts.password.reset"],
      ] as const).filter(([, , ,permission]) => can(permission)).map(([key,label,type]) =>
        <form key={key} className="control-security-action" onSubmit={event => submit(event,data => {
          const form = event.currentTarget;
          const value = String(data.get("value") ?? "");
          if (key === "password") form.reset();
          request(label,{ op:key, value });
        })}>
          <label>{label}<input name="value" type={type} autoComplete={type === "password" ? "new-password" : "off"}
            required minLength={type === "password" ? 10 : undefined} maxLength={512}/></label>
          <div><button type="submit">{t.save}</button></div>
        </form>)}
    </div>
    {can("accounts.totp.reset") && account.totp && <div><button type="button" className="control-danger" onClick={() => request(t.resetTotp,{ op:"reset_totp" },true)}>{t.resetTotp}</button></div>}
    </section>
    {account.sessions && <section className="control-stack" hidden={tab!=="sessionsTab"} aria-label={t.sessionsTab}>
      {account.sessions.length===0 && <p className="control-empty">{t.empty}</p>}
      {account.sessions.map(device => <div key={device.id} className="control-row"><span>{device.device ?? t.device} · {date(lang,device.seen)}</span>
        {can("accounts.sessions.revoke") && <button className="control-danger" type="button"
          onClick={() => request(t.revoke,{ op:"revoke_sessions",session:device.id },true)}>{t.revoke}</button>}</div>)}
      {account.sessions.length > 0 && can("accounts.sessions.revoke") && <div><button type="button" className="control-danger"
        onClick={() => request(t.revokeAll,{ op:"revoke_sessions" },true)}>{t.revokeAll}</button></div>}
    </section>}
    {pending && <Confirm title={pending.label} t={t} confirm={() => void operation.run(pending.run,() => { setPending(null); reload(); })}
      cancel={() => setPending(null)} error={operation.error} disabled={operation.busy} danger>
      {pending.irreversible && <p>{t.cannotReverse}</p>}
    </Confirm>}
  </div>;
}

export function Roles({ lang, t, actor }: AdminProps) {
  const roles = useAdminData<Role[]>("roles", lang);
  const operation = useOperation(lang);
  const [target, setTarget] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const editable = allowed(actor,"admins.grant");
  const options = (Object.keys(t.permissions) as Permission[]).filter(permission => allowed(actor,permission));
  const groups = [
    { title:t.accounts, prefixes:["accounts"] },
    { title:t.reports, prefixes:["content","reports"] },
    { title:t.rolesTab, prefixes:["admins","audit"] },
    { title:t.server, prefixes:["ops"] },
  ];
  return <div className="control-columns">
    <section className="control-box"><ErrorNotice error={roles.error}/><div className="control-list">
      {roles.value?.map(role => <button type="button" key={role.id} disabled={!editable || role.owner || actor.id === role.id ||
        role.permissions.some(permission => !allowed(actor,permission))} onClick={() => { setTarget(role.id); setPermissions(role.permissions); }}>
        <span><strong>{role.name ?? role.id}</strong><small>{role.owner ? t.owner : role.username && `@${role.username}`}</small></span>
        <span>{role.permissions.length}</span></button>)}
    </div>{roles.value?.length === 0 && <p>{t.empty}</p>}</section>
    {editable && <form className="control-box control-stack" onSubmit={event => {
      event.preventDefault();
      void operation.run(() => admin(`roles/${encodeURIComponent(target.trim().replace(/^@/, ""))}`, { permissions }), roles.reload);
    }}>
      <label>{t.roleTarget}<input value={target} onChange={event => setTarget(event.target.value)} required maxLength={80}/></label>
      <div className="control-fields">{groups.map(group => {
        const members=options.filter(permission=>group.prefixes.some(prefix=>permission.startsWith(`${prefix}.`)));
        return members.length>0 && <fieldset className="control-permissions" key={group.title}><legend>{group.title}</legend>
          {members.map(permission => <label className="control-check" key={permission}>
            <input type="checkbox" checked={permissions.includes(permission)} onChange={event => setPermissions(before =>
              event.target.checked ? [...before,permission] : before.filter(value => value !== permission))}/>{t.permissions[permission]}</label>)}
        </fieldset>;
      })}</div>
      <ErrorNotice error={operation.error}/><div><button className="control-primary" disabled={operation.busy}>{t.grant}</button></div>
    </form>}
  </div>;
}
