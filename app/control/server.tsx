"use client";

import { useMemo, useState } from "react";
import { admin, allowed, Confirm, date, ErrorNotice, submit, useAdminData, useOperation, type AdminProps } from "./shared";

type Entry = { id: string; actor: string; action: string; target: string | null; details: Record<string, unknown>;
  at: number; undone: boolean; delivered: boolean; can_undo: boolean };

export function Audit({ actor, lang, t }: AdminProps) {
  const [offset,setOffset] = useState(0);
  const data = useAdminData<Entry[]>(`audit?offset=${offset}`,lang);
  const [entry,setEntry] = useState<Entry | null>(null);
  const operation = useOperation(lang);
  return <section className="control-box">
    <ErrorNotice error={data.error}/>
    {data.value?.length ? <div className="control-table-wrap"><table className="control-table">
      <thead><tr><th scope="col">{t.action}</th><th scope="col">{t.actor}</th><th scope="col">{t.eventTime}</th><th scope="col">{t.target}</th><th scope="col"><span className="sr-only">{t.undo}</span></th></tr></thead>
      <tbody>{data.value.map(item => <tr className="control-audit-item" key={item.id}>
        <td><strong>{t.actions[item.action as keyof typeof t.actions] ?? t.action}</strong>
          {Object.keys(item.details).length>0 && <small>{Object.entries(item.details).map(([key,value]) =>
            `${t.auditDetails[key as keyof typeof t.auditDetails] ?? key} · ${String(value)}`).join(" · ")}</small>}
          {item.delivered && <small>{t.issued}</small>}</td>
        <td>@{item.actor}</td><td><time>{date(lang,item.at)}</time></td>
        <td>{item.target ? <code title={item.target}>{item.target}</code> : "—"}</td>
        <td>{item.undone ? <span className="control-chip">{t.undone}</span>
          : item.can_undo && allowed(actor,"audit.undo") && <button type="button" onClick={() => {operation.reset();setEntry(item);}}>{t.undo}</button>}</td>
      </tr>)}</tbody>
    </table></div> : null}
    {data.value?.length === 0 && <p className="control-empty">{t.journalEmpty}</p>}
    <div className="control-actions">
      <button type="button" disabled={offset === 0} onClick={() => setOffset(offset-50)}>{t.previous}</button>
      <button type="button" disabled={(data.value?.length ?? 0) < 50} onClick={() => setOffset(offset+50)}>{t.next}</button>
    </div>
    {entry && <Confirm title={t.confirmUndo} t={t} cancel={() => setEntry(null)} confirm={() => void operation.run(
      () => admin(`audit/${entry.id}/undo`,{}),() => {setEntry(null);data.reload();}
    )} error={operation.error} disabled={operation.busy}/>}
  </section>;
}

type Service = { name: string; state?: string; health?: string; uptime?: number; cpu?: string; memory?: string };
type ServerState = {
  managed: boolean;
  accounts?: { total: number; online: number; deleted: number }; countries?: Record<string,number>;
  s3?: { bytes: number; measured: number; objects: number }; s3_configured?: boolean; audit_configured?: boolean;
  host: { uptime: number; cpu: string; memory: string; disk: string } | null; services: Service[] | null;
  env: { key: string; set: boolean }[] | null; jobs: { id: string; at: number; dispatched: boolean }[];
  results: Record<string,{ success: boolean }> | null;
};

export function Server({ actor, t, lang }: AdminProps) {
  const data = useAdminData<ServerState>("server",lang);
  const operation = useOperation(lang);
  const [pending,setPending] = useState<{ title: string; path: string; data: object; irreversible?: boolean } | null>(null);
  const formatter = useMemo(() => new Intl.DisplayNames([lang],{type:"region"}),[lang]);
  const number = new Intl.NumberFormat(lang);
  const server = data.value;
  const names = t.serviceLabels as Record<string,string>;
  const metric = (value: number) => `${number.format(Math.floor(value/3600))} ${t.hours} ${number.format(Math.floor(value/60)%60)} ${t.minutes}`;
  return <div className="control-stack">
    <div><button type="button" onClick={data.reload}>{t.refresh}</button></div>
    <ErrorNotice error={data.error}/>
    {server?.accounts && server.s3 && <section className="control-box control-metrics"><dl className="control-facts">
      <div><dt>{t.total}</dt><dd>{number.format(server.accounts.total)}</dd></div>
      <div><dt>{t.online}</dt><dd>{number.format(server.accounts.online)}</dd></div>
      <div><dt>{t.deleted}</dt><dd>{number.format(server.accounts.deleted)}</dd></div>
      <div><dt>{t.s3}</dt><dd>{server.s3_configured ? `${number.format(server.s3.bytes)} ${t.bytes}` : t.notConfigured}</dd></div>
      <div><dt>{t.storageMeasured}</dt><dd>{server.s3.measured} / {server.s3.objects}</dd></div>
      {!server.audit_configured && <div><dt>{t.audit}</dt><dd>{t.missingAudit}</dd></div>}
    </dl></section>}
    {server?.countries && <section className="control-box"><h2>{t.countries}</h2><dl className="control-facts">
      {Object.entries(server.countries).sort((a,b) => b[1]-a[1]).map(([id,value]) =>
        <div key={id}><dt>{id === "unknown" ? t.unknown : formatter.of(id)?.toLowerCase() ?? id.toLowerCase()}</dt><dd>{number.format(value)}</dd></div>)}
    </dl></section>}
    {server && <section className="control-box control-stack"><h2>{t.services}</h2>
      {!server.managed && <p>{t.missingAgent}</p>}
      {server.host && <dl className="control-facts">
        <div><dt>{t.uptime}</dt><dd>{metric(server.host.uptime)}</dd></div>
        <div><dt>{t.cpu}</dt><dd>{server.host.cpu}</dd></div>
        <div><dt>{t.memory}</dt><dd>{server.host.memory}</dd></div>
        <div><dt>{t.disk}</dt><dd>{server.host.disk}</dd></div>
      </dl>}
      {server.services?.map(service => <div className="control-row control-service" key={service.name}><div><strong>{names[service.name] ?? service.name}</strong>
        {service.state && <span className="control-service-state" data-health={service.health || service.state}>
          {t[service.state as keyof typeof t] as string ?? t.unknown}{service.health && ` · ${t[service.health as keyof typeof t] as string}`}</span>}
        {(service.uptime != null || service.cpu || service.memory) && <small>
          {[service.uptime!=null && metric(service.uptime),service.cpu && `${t.cpu} ${service.cpu}`,service.memory && `${t.memory} ${service.memory}`].filter(Boolean).join(" · ")}
        </small>}</div>
        {allowed(actor,"ops.restart") && service.state !== "missing" && <button type="button" className="control-danger" onClick={() => {
          operation.reset();setPending({title:t.confirmRestart,path:"server/restart",data:{service:service.name},irreversible:true});
        }}>{t.restart}</button>}
      </div>)}
      {server.managed && allowed(actor,"ops.restart") && <div><button type="button" className="control-danger" onClick={() => {
        operation.reset();setPending({title:t.confirmRestart,path:"server/restart",data:{service:"all"},irreversible:true});
      }}>{t.restart} · {t.allServices}</button></div>}
    </section>}
    {server?.env && server.managed && <form className="control-box control-stack" onSubmit={event => submit(event,data => {
      event.currentTarget.reset();
      operation.reset();setPending({title:t.confirmEnv,path:"server/env",data:{key:data.get("key"),value:data.get("value")}});
    })}>
      <h2>{t.env}</h2><div className="control-fields">
        <select name="key" aria-label={t.env}>{server.env.map(item =>
          <option key={item.key} value={item.key}>{item.key.toLowerCase()} · {item.set ? t.configured : t.notConfigured}</option>)}</select>
        <input type="password" name="value" placeholder={t.settingValue} aria-label={t.settingValue} autoComplete="off" maxLength={4096}/>
      </div><div><button className="control-primary">{t.save}</button></div>
    </form>}
    {server?.jobs.length ? <section className="control-box"><h2>{t.jobs}</h2>{server.jobs.map(item => {
      const result = server.results?.[item.id];
      return <div className="control-row" key={item.id}><small>{item.id} · {date(lang,item.at)}</small>
        <span className={result && !result.success ? "control-error" : undefined}>{result ? result.success ? t.done : t.failed : t.queued}</span></div>;
    })}</section> : null}
    {pending && <Confirm title={pending.title} t={t} danger={pending.irreversible} error={operation.error} disabled={operation.busy}
      cancel={() => setPending(null)} confirm={() => void operation.run(() => admin(pending.path,pending.data),() => {setPending(null);data.reload();})}>
      {pending.irreversible && <p>{t.cannotReverse}</p>}
    </Confirm>}
  </div>;
}
