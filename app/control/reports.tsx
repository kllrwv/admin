"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { admin, allowed, Confirm, date, ErrorNotice, useAdminData, useOperation, type AdminProps, type Kind } from "./shared";

type State = "pending" | "accepted" | "dismissed";
type Report = { id: string; target: string; kind: Kind; part: number; reporter: string; author: string | null;
  reason: keyof AdminProps["t"]["reasons"]; description: string; body: string | null; created: number; target_deleted: boolean; note: string;
  media: { part: number; kind: "image" | "audio" | "video"; title: string }[]; poll: { question: string; options: string[] } | null;
  legacy_image: boolean; avatar: boolean; banner: boolean };

export function Reports({ t, lang, actor, socialOrigin }: AdminProps) {
  const [state, setState] = useState<State>("pending");
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const list = useAdminData<Report[]>(`reports?state=${state}&offset=${offset}`, lang);
  const item = list.value?.[index];
  const operation = useOperation(lang);
  const [selected, select] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [remove, setRemove] = useState(false);
  const [x, setX] = useState(0);
  const drag = useRef<{ start: number; id: number } | null>(null);
  const detail = useRef<HTMLDivElement>(null);
  const canRemove = item != null && !item.target_deleted && allowed(actor, item.kind === "account" ? "accounts.lifecycle" : "content.moderate");

  function prepare(choice: "approve" | "reject") {
    operation.reset(); setNote(""); setRemove(choice === "approve" && canRemove); select(choice);
  }

  function down(event: PointerEvent<HTMLElement>) {
    if (state !== "pending" || selected || event.button !== 0 || !(event.target instanceof Element)
      || event.target.closest("a,button,input,select,textarea,video,audio")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { start:event.clientX,id:event.pointerId };
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (drag.current?.id === event.pointerId) setX(Math.max(-160,Math.min(160,event.clientX - drag.current.start)));
  }

  function end(event: PointerEvent<HTMLElement>) {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const distance = event.clientX - drag.current.start;
    drag.current = null; setX(0);
    if (event.type !== "pointercancel" && Math.abs(distance) >= 80) prepare(distance > 0 ? "approve" : "reject");
  }

  const asset = (part: number) => `/api/admin/reports/${item?.id}/media/${part}`;
  const profile = item?.author ? `${socialOrigin}/@${encodeURIComponent(item.author)}` : null;

  return <div className="control-report-area">
    <div className="control-tabs control-report-filter">{(["pending","accepted","dismissed"] as const).map(value => <button key={value} type="button"
      aria-pressed={value === state} onClick={() => {setState(value);setIndex(0);setOffset(0);select(null);}}>{t[value]}</button>)}</div>
    <ErrorNotice error={list.error}/>
    {list.value && list.value.length===0 && <div className="control-empty control-box">{t.noReports}</div>}
    {list.value && list.value.length>0 && <div className="control-columns control-report-layout">
      <section className="control-box control-rail">
        <header className="control-section-head"><h2>{t.reportQueue}</h2><span>{offset+1}–{offset+list.value.length}</span></header>
        <div className="control-list control-rail-list">
          {list.value.map((entry,position) => <button type="button" key={entry.id} aria-pressed={position===index} onClick={() => {
            setIndex(position);
            if (window.matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => detail.current?.scrollIntoView({block:"start"}));
          }}>
            <span><strong>{t.reasons[entry.reason]}</strong>
              <small>{t.kinds[entry.kind]}{entry.author && <> · @{entry.author}</>}</small>
              {entry.description && <small className="control-truncate">{entry.description}</small>}</span>
            <ArrowRight size={14} aria-hidden="true"/>
          </button>)}
        </div>
        <div className="control-actions control-rail-footer">
          <button type="button" disabled={offset===0} onClick={() => {setOffset(offset-25);setIndex(0);}}>{t.previous}</button>
          <button type="button" disabled={list.value.length<25} onClick={() => {setOffset(offset+25);setIndex(0);}}>{t.next}</button>
        </div>
      </section>
      <div className="control-report-detail" ref={detail}>
    {item && <>
      <div className="control-report-stage" data-choice={selected ?? (x > 70 ? "approve" : x < -70 ? "reject" : "")}>
        <article key={item.id} className="control-box control-report" onPointerDown={down} onPointerMove={move}
          onPointerUp={end} onPointerCancel={end} style={{transform:`translateX(${x || (selected === "approve" ? 38 : selected === "reject" ? -38 : 0)}px) rotate(${x / 17}deg)`}}>
          <header><span className="control-chip">{t.kinds[item.kind]}</span><time>{date(lang,item.created)}</time></header>
          <h2>{t.reasons[item.reason]}</h2>
          {item.description && <p className="control-content">{item.description}</p>}
          <div className="control-report-context">
            <h3>{t.reportedContent}</h3>
            <div className="control-row">{profile && <a href={profile} target="_blank" rel="noreferrer">@{item.author}</a>}
              {item.target_deleted && <span className="control-error">{t.deleted}</span>}</div>
            {item.body && <p className="control-content">{item.body}</p>}
            {item.avatar && <img src={asset(-1)} alt={t.avatar} loading="lazy"/>}
            {item.banner && <img src={asset(-2)} alt={t.banner} loading="lazy"/>}
            {item.legacy_image && <img src={asset(-1)} alt={t.kinds.attachment} loading="lazy"/>}
            {item.media.map(media => media.kind === "image" ? <img key={media.part} src={asset(media.part)} alt={media.title || t.kinds.attachment} loading="lazy"/>
              : media.kind === "video" ? <video key={media.part} src={asset(media.part)} controls preload="none" aria-label={media.title || t.kinds.attachment}/>
              : <audio key={media.part} src={asset(media.part)} controls preload="none" aria-label={media.title || t.kinds.attachment}/>)}
            {item.poll && <div><strong>{item.poll.question}</strong><ul>{item.poll.options?.map((option,i) => <li key={i}>{option}</li>)}</ul></div>}
          </div>
          <small>{t.reporter} · {item.reporter}</small>
          {item.note && <p className="control-content">{t.note} · {item.note}</p>}
        </article>
        {state === "pending" && <div className="control-review-actions">
          <button type="button" className="control-danger" onClick={() => prepare("reject")}><X size={17}/>{t.dismiss}<ArrowLeft size={15}/></button>
          <span className="control-swipe-hint">{t.swipeHelp}</span>
          <button type="button" className="control-approve" onClick={() => prepare("approve")}><Check size={17}/>{t.accept}<ArrowRight size={15}/></button>
        </div>}
      </div>
      {selected && <Confirm title={selected === "approve" ? t.approveTitle : t.dismissTitle} t={t} danger={selected === "reject"}
        cancel={() => select(null)} disabled={operation.busy} error={operation.error} confirm={() => void operation.run(
          () => admin(`reports/${item.id}/review`,{accept:selected === "approve",remove,note}),
          () => {select(null);setIndex(0);list.reload();}
        )}>
        <label>{t.noteOptional}<textarea maxLength={1000} value={note} onChange={event => setNote(event.target.value)}/></label>
        {selected === "approve" && canRemove && <label className="control-check"><input type="checkbox" checked={remove}
          onChange={event => setRemove(event.target.checked)}/>{t.removeTarget}</label>}
      </Confirm>}
    </>}
      </div>
    </div>}
  </div>;
}
