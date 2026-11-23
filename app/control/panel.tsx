"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Gauge, ListChecks, ScrollText, ShieldCheck, Users } from "lucide-react";
import { copy, storedLanguage, type Lang } from "../lib/locale";
import { Accounts, Roles } from "./accounts";
import { Reports } from "./reports";
import { Audit, Server } from "./server";
import { admin, allowed, type Actor, type Permission } from "./shared";
import "./control.css";
const sections = {
  reports: { icon: ListChecks, permits: ["reports.review"] },
  accounts: { icon: Users, permits: ["accounts.read", "accounts.review.create"] },
  roles: { icon: ShieldCheck, permits: ["admins.read", "admins.grant"] },
  server: { icon: Gauge, permits: ["ops.read", "ops.restart", "ops.env.write"] },
  audit: { icon: ScrollText, permits: ["audit.read"] },
} satisfies Record<string, { icon: typeof Users; permits: Permission[] }>;
type Section = keyof typeof sections;
export function Administration({ socialOrigin }: { socialOrigin: string }) {
  const [lang, setLang] = useState<Lang>("ru");
  const [actor, setActor] = useState<Actor | null | undefined>(undefined);
  const [section, setSection] = useState<Section>("reports");
  const request = useRef<Promise<Actor> | null>(null);
  const t = copy[lang].admin;
  useEffect(() => {
    setLang(storedLanguage());
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && Object.hasOwn(sections, requested)) setSection(requested as Section);
    if (!request.current) {
      const url = new URL(window.location.href);
      const ticket = url.searchParams.get("ticket");
      if (ticket) {
        url.searchParams.delete("ticket");
        history.replaceState(null, "", url);
      }
      request.current = ticket
        ? admin<Actor>("session/claim", { ticket }).catch(() => admin<Actor>("session"))
        : admin<Actor>("session");
    }
    void request.current.then(setActor, () => setActor(null));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.title} · killerwave`;
  }, [lang, t.title]);
  const languages = <div className="control-language">{(["ru", "en"] as const).map(value =>
    <button type="button" key={value} aria-pressed={value === lang} onClick={() => {
      setLang(value);
      localStorage.setItem("killerwave.lang", value);
    }}>{value === "ru" ? copy.ru.ruLabel : copy.en.enLabel}</button>)}</div>;
  if (!actor) return <main className="control control-entry">
    <header><img src="/logo.svg" width={28} height={28} alt="" />{t.title}</header>
    <section className="control-box">
      {actor === undefined ? <p role="status">{copy[lang].loading}</p> : <>
        <p>{t.signInHint}</p>
        <a className="control-button control-primary" href={`${socialOrigin}/api/admin/session/start`}>{t.signIn}<ArrowUpRight size={15} /></a>
      </>}
      {languages}
    </section>
  </main>;
  const visible = (Object.keys(sections) as Section[]).filter(key => sections[key].permits.some(permit => allowed(actor, permit)));
  const active = visible.includes(section) ? section : visible[0];
  const props = { lang, actor, t, socialOrigin };
  function navigate(next: Section) {
    setSection(next);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    history.replaceState(null, "", url);
  }
  return <main className="control control-shell">
    <header className="control-top">
      <div className="control-top-inner">
        <div className="control-brand"><img src="/logo.svg" width={23} height={23} alt="" /><span>{t.title}</span></div>
        <div className="control-utilities">
          <span className="control-actor">@{actor.name}</span>{languages}
          <a href={socialOrigin} className="control-social-link" aria-label={t.back} title={t.back}>
            <ArrowUpRight size={16} aria-hidden="true" /><span>{t.back}</span>
          </a>
        </div>
        <nav aria-label={t.title} className="control-navigation">{visible.map(item => {
          const Icon = sections[item].icon;
          return <button type="button" key={item} aria-current={item === active ? "page" : undefined} onClick={() => navigate(item)}>
            <Icon size={16} aria-hidden="true" />{t[item]}
          </button>;
        })}</nav>
      </div>
    </header>
    <section className="control-workspace">
      <header className="control-heading"><h1>{active ? t[active] : t.title}</h1></header>
      {active === "reports" && <Reports {...props} />}
      {active === "accounts" && <Accounts {...props} />}
      {active === "roles" && <Roles {...props} />}
      {active === "audit" && <Audit {...props} />}
      {active === "server" && <Server {...props} />}
      {!active && <p>{t.empty}</p>}
    </section>
  </main>;
}
