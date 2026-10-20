import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { VoiceInput, ReadAloud } from "../components/Accessibility";

const api = import.meta.env.VITE_SERVER_URL;

const toPlain = (md) =>
  String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// The backend stores a citation map for every new report. Convert only known
// [Source N] markers into in-page links; unknown markers remain plain text so
// older reports continue to render normally.
const linkCitationRefs = (markdown, citations = []) => {
  const numbers = new Set(
    citations.map((citation) => Number(citation.citationNumber)).filter((number) => Number.isInteger(number) && number > 0)
  );
  return String(markdown || "").replace(/\[Source\s+(\d+)\]/gi, (label, rawNumber) => {
    const number = Number(rawNumber);
    return numbers.has(number) ? `[${label}](#citation-${number})` : label;
  });
};

const TYPE_BADGE = {
  pdf: "PDF",
  "pdf-ai": "PDF (AI)",
  image: "Image (AI)",
  "url-pdf": "PDF link",
  docx: "DOCX",
  text: "Text",
  url: "Link",
  paste: "Pasted",
  file: "File",
};

const DOC_BADGE = {
  "research-paper": "Research",
  "clinical-trial": "Trial",
  "medical-report": "Medical",
  "review": "Review",
  "case-study": "Case study",
  guideline: "Guideline",
  dataset: "Dataset",
};

function SourceBadge({ type }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {TYPE_BADGE[type] || "Source"}
    </span>
  );
}

export default function ReportStudio() {
  const { token } = useSelector((s) => s.auth);
  const headers = useMemo(() => ({ Authorization: "Bearer " + token }), [token]);

  const [tab, setTab] = useState("upload"); // upload | link | paste
  const [templates, setTemplates] = useState([]);
  const [sources, setSources] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportSearch, setReportSearch] = useState("");
  const [selected, setSelected] = useState([]);

  const [files, setFiles] = useState([]);
  const [aiExtract, setAiExtract] = useState(false);
  const [url, setUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [template, setTemplate] = useState("medical");
  const [perSource, setPerSource] = useState(false);

  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [providers, setProviders] = useState([]);
  const [health, setHealth] = useState({});
  const [checking, setChecking] = useState(false);
  const [useStream, setUseStream] = useState(true);
  const [chainMode, setChainMode] = useState(true);
  const [parallelMode, setParallelMode] = useState(false);
  const [chainStep, setChainStep] = useState("");
  const [streamText, setStreamText] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [answerCitations, setAnswerCitations] = useState([]);
  const [answerCached, setAnswerCached] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [compactReport, setCompactReport] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [activeCitationNumber, setActiveCitationNumber] = useState(null);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await axios.get(api + "/api/reports/templates", { headers });
      setTemplates(r.data.templates || []);
    } catch { /* non-fatal */ }
  }, [headers]);

  const loadSources = useCallback(async () => {
    try {
      const r = await axios.get(api + "/api/reports/sources", { headers });
      setSources(r.data.sources || []);
    } catch { setError("Could not load your source library."); }
    finally { setSourcesLoaded(true); }
  }, [headers]);

  const loadReports = useCallback(async () => {
    try {
      const r = await axios.get(api + "/api/reports", { headers });
      setReports(r.data.reports || []);
    } catch { /* non-fatal */ }
    finally { setReportsLoaded(true); }
  }, [headers]);

  const loadProviders = useCallback(async () => {
    try {
      const r = await axios.get(api + "/api/reports/providers", { headers });
      setProviders(r.data.providers || []);
    } catch { /* non-fatal */ }
  }, [headers]);

  const runHealth = useCallback(async () => {
    setChecking(true);
    try {
      const r = await axios.get(api + "/api/reports/providers/health", { headers });
      const map = {};
      (r.data.providers || []).forEach((p) => { map[p.key] = p; });
      setHealth(map);
    } catch { /* non-fatal */ } finally { setChecking(false); }
  }, [headers]);

  useEffect(() => { loadTemplates(); loadSources(); loadReports(); loadProviders(); runHealth(); }, [loadTemplates, loadSources, loadReports, loadProviders, runHealth]);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(""), 4000); };

  const copyText = async (text, label) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text || "");
      else {
        const ta = document.createElement("textarea");
        ta.value = text || ""; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      flash((label || "Text") + " copied to clipboard.");
    } catch { setError("Could not copy to clipboard."); }
  };

  /* ------------------------- ingestion ------------------------- */
  const uploadFiles = async (e) => {
    e.preventDefault();
    if (!files.length) return;
    setBusy("upload"); setError("");
    try {
      const fd = new FormData();
      [...files].forEach((f) => fd.append("files", f));
      fd.append("mode", aiExtract ? "ai" : "auto");
      const r = await axios.post(api + "/api/reports/sources/upload", fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      setFiles([]);
      const failed = r.data.failed || [];
      flash(`Added ${r.data.sources.length} source(s).` + (failed.length ? ` ${failed.length} failed.` : ""));
      if (failed.length) setError(failed.map((f) => `${f.name}: ${f.error}`).join(" | "));
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed.");
    } finally { setBusy(""); }
  };

  const addUrl = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy("url"); setError("");
    try {
      await axios.post(api + "/api/reports/sources/url", { url }, { headers });
      setUrl(""); flash("Link added to your source library.");
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Could not read that URL.");
    } finally { setBusy(""); }
  };

  const addPaste = async (e) => {
    e.preventDefault();
    setBusy("paste"); setError("");
    try {
      await axios.post(api + "/api/reports/sources", { title: sourceTitle, content: sourceContent }, { headers });
      setSourceTitle(""); setSourceContent(""); flash("Source saved.");
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save source.");
    } finally { setBusy(""); }
  };

  const removeSource = async (id) => {
    if (!window.confirm("Remove this source from your library? Reports already generated are not affected.")) return;
    try {
      await axios.delete(api + "/api/reports/sources/" + id, { headers });
      setSelected((x) => x.filter((v) => v !== id));
      await loadSources();
    } catch { setError("Could not delete source."); }
  };

  const toggle = (id) => setSelected((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));

  /* ------------------------- generation ------------------------ */
  const generate = async (e) => {
    e.preventDefault();
    if (!selected.length) return;
    setBusy("generate"); setError(""); setReport(null); setStreamText(""); setChainStep(""); setActiveCitationNumber(null);
    try {
      if (perSource) {
        await streamBatch();
      } else if (useStream) {
        await streamGenerate();
      } else {
        const r = await axios.post(api + "/api/reports/generate",
          { title, objective, template, sourceIds: selected, chain: chainMode, parallel: parallelMode }, { headers });
        setReport(r.data.report);
        await loadReports();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Could not generate the report.");
    } finally { setBusy(""); setChainStep(""); setBatchProgress(null); }
  };

  // Keyboard shortcuts: Ctrl/Cmd+Enter generates, Esc closes an open report.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (selected.length && !busy) { e.preventDefault(); generate({ preventDefault() {} }); }
      } else if (e.key === "Escape" && report) {
        setReport(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, busy, report]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Streaming batch generation: live per-report progress over SSE.
  const streamBatch = async () => {
    setBatchProgress({ done: 0, total: selected.length });
    const resp = await fetch(api + "/api/reports/batch/stream", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ perSource: true, objective, template, sourceIds: selected, chain: chainMode, parallel: parallelMode }),
    });
    if (!resp.ok || !resp.body) {
      const j = await resp.json().catch(() => ({}));
      throw new Error(j.error || "Batch streaming failed to start.");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", event = "", firstId = null, summary = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (line.startsWith("event:")) { event = line.slice(6).trim(); continue; }
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          try {
            const j = JSON.parse(data);
            if (event === "start") setBatchProgress({ done: 0, total: j.total });
            else if (event === "progress") setBatchProgress({ done: j.done, total: j.total });
            else if (event === "done") { summary = j; firstId = j.firstReportId; }
            else if (event === "error") throw new Error(j.error || "Batch failed.");
          } catch (e) { if (event === "error") throw e; }
        }
      }
    }
    await loadReports();
    setBatchProgress(null);
    if (summary) flash(`Batch complete: ${summary.completed}/${summary.count} reports.`);
    if (firstId) await openReport(firstId);
  };

  // Streaming generation via fetch + SSE parsing (EventSource can't send auth headers).
  const streamGenerate = async () => {
    setStreamText("");
    const resp = await fetch(api + "/api/reports/generate/stream", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title, objective, template, sourceIds: selected, chain: chainMode, parallel: parallelMode }),
    });
    if (!resp.ok || !resp.body) {
      const j = await resp.json().catch(() => ({}));
      throw new Error(j.error || "Streaming failed to start.");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", acc = "", event = "", doneId = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (line.startsWith("event:")) { event = line.slice(6).trim(); continue; }
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          try {
            const j = JSON.parse(data);
            if (event === "token" && j.t) { acc += j.t; setStreamText(acc); }
            else if (event === "step") { setChainStep(j.label || ""); }
            else if (event === "final" && typeof j.content === "string") { acc = j.content; setStreamText(acc); }
            else if (event === "done") { doneId = j.reportId; }
            else if (event === "error") { throw new Error(j.error || "Generation failed."); }
          } catch (e) { if (event === "error") throw e; }
        }
      }
    }
    setChainStep("");
    await loadReports();
    if (doneId) { setStreamText(""); await openReport(doneId); }
  };

  /* --------------------- ask your documents -------------------- */
  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selected.length) { setError("Select at least one source and type a question."); return; }
    setAsking(true); setError(""); setAnswer(null); setAnswerCitations([]); setAnswerCached(false);
    try {
      const r = await axios.post(api + "/api/reports/ask", { question, sourceIds: selected }, { headers });
      setAnswer(r.data.answer); setAnswerCitations(r.data.citations || []); setAnswerCached(!!r.data.cached);
    } catch (err) {
      setError(err.response?.data?.error || "Could not answer that question.");
    } finally { setAsking(false); }
  };

  /* --------------------- report management --------------------- */
  const renameRpt = async (id, current) => {
    const t = window.prompt("Rename report:", current || "");
    if (!t || !t.trim()) return;
    try {
      await axios.patch(api + "/api/reports/" + id, { title: t.trim() }, { headers });
      await loadReports();
      if (report && report._id === id) setReport({ ...report, title: t.trim() });
    } catch { setError("Could not rename report."); }
  };
  const duplicateRpt = async (id) => {
    try { const r = await axios.post(api + "/api/reports/" + id + "/duplicate", {}, { headers }); await loadReports(); flash("Report duplicated."); await openReport(r.data.report._id); }
    catch { setError("Could not duplicate report."); }
  };
  const deleteRpt = async (id) => {
    if (!window.confirm("Delete this report? This cannot be undone.")) return;
    try {
      await axios.delete(api + "/api/reports/" + id, { headers });
      if (report && report._id === id) setReport(null);
      await loadReports();
    } catch { setError("Could not delete report."); }
  };

  const openReport = async (id) => {
    try {
      const r = await axios.get(api + "/api/reports/" + id, { headers });
      setReport(r.data.report);
      setActiveCitationNumber(null);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch { setError("Could not open that report."); }
  };

  const regenerate = async (rpt) => {
    const ids = (rpt.sourceIds || []).map((x) => (x && x._id ? x._id : x)).filter(Boolean).map(String);
    if (!ids.length) { setError("This report has no linked sources to regenerate from."); return; }
    setBusy("generate"); setError(""); setStreamText(""); setChainStep("");
    try {
      const r = await axios.post(api + "/api/reports/generate",
        { title: rpt.title, objective: rpt.objective, template: rpt.template, sourceIds: ids, chain: chainMode, parallel: parallelMode }, { headers });
      setReport(r.data.report);
      await loadReports();
      flash("Report regenerated.");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.error || "Could not regenerate the report.");
    } finally { setBusy(""); setChainStep(""); }
  };

  const download = async (id, format) => {
    setBusy("export-" + format);
    try {
      const r = await axios.get(api + "/api/reports/" + id + "/export?format=" + format, {
        headers, responseType: "blob",
      });
      const blob = new Blob([r.data]);
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = r.headers["content-disposition"] || "";
      const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || `report.${format}`;
      a.href = href; a.download = name; document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(href);
    } catch { setError("Export failed."); }
    finally { setBusy(""); }
  };

  const rendered = useMemo(
    () => (report ? DOMPurify.sanitize(marked.parse(linkCitationRefs(report.content, report.citations), { gfm: true })) : ""),
    [report]
  );
  const activeCitation = useMemo(
    () => (report?.citations || []).find((citation) => Number(citation.citationNumber) === activeCitationNumber) || null,
    [report, activeCitationNumber]
  );
  const selectCitation = (citationNumber) => {
    setActiveCitationNumber(citationNumber);
    window.setTimeout(() => document.getElementById("evidence-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  };
  const handleReportCitationClick = (event) => {
    const link = event.target?.closest?.("a[href^='#citation-']");
    if (!link) return;
    const citationNumber = Number(link.getAttribute("href")?.replace("#citation-", ""));
    if (!Number.isInteger(citationNumber)) return;
    event.preventDefault();
    selectCitation(citationNumber);
  };
  const answerRendered = useMemo(
    () => (answer ? DOMPurify.sanitize(marked.parse(answer, { gfm: true })) : ""),
    [answer]
  );
  const streamRendered = useMemo(
    () => (streamText ? DOMPurify.sanitize(marked.parse(streamText, { gfm: true })) : ""),
    [streamText]
  );

  /* ----------------------------- UI ---------------------------- */
  const inputCls = "w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800";
  const tabCls = (t) =>
    "px-3 py-1.5 text-sm font-medium rounded-lg " +
    (tab === t ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300");

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">AINA Report Studio</p>
            <h1 className="text-3xl font-bold">Evidence-grounded reports</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Upload documents, add links, or paste text, then generate structured medical &amp; research reports and export to PDF or Word.
            </p>
          </div>
          <a href="/chat" className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700">Back to chat</a>
        </div>

        {/* AI provider pool status */}
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">AI providers</span>
          {providers.length === 0 && <span className="text-xs text-slate-400">none configured</span>}
          {providers.map((p) => {
            const h = health[p.key];
            const state = !p.configured ? "off" : checking && !h ? "checking" : h ? (h.ok ? "up" : "down") : "unknown";
            const dot = { up: "bg-emerald-500", down: "bg-red-500", checking: "bg-amber-400 animate-pulse", off: "bg-slate-300", unknown: "bg-slate-400" }[state];
            const title = !p.configured ? "No API key set" : h ? (h.ok ? `Online · ${h.ms}ms` : `Down: ${h.error || "error"}`) : "Not checked yet";
            return (
              <span key={p.key} title={title}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700">
                <span className={"inline-block h-2 w-2 rounded-full " + dot} />
                <span className="font-medium">{p.label}</span>
                <span className="text-slate-400">{p.model}</span>
                {h && h.ok && <span className="text-emerald-600 dark:text-emerald-400">{h.ms}ms</span>}
              </span>
            );
          })}
          <button onClick={runHealth} disabled={checking}
            className="ml-auto rounded-lg border border-slate-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-slate-600">
            {checking ? "Testing…" : "Test providers"}
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            <span>{error}</span>
            <button onClick={() => setError("")} className="shrink-0 text-red-500 hover:text-red-700" title="Dismiss">✕</button>
          </div>
        )}
        {notice && <p className="mb-4 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ---------------- Source library ---------------- */}
          <section className="rounded-2xl bg-white p-5 shadow dark:bg-slate-900">
            <h2 className="text-xl font-semibold">1. Source library</h2>
            <div className="mt-1 flex gap-3 text-xs text-slate-500">
              <button type="button" onClick={() => setSelected(sources.map((s) => s._id))} className="hover:text-orange-600">Select all</button>
              <button type="button" onClick={() => setSelected([])} className="hover:text-orange-600">Clear</button>
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={() => setTab("upload")} className={tabCls("upload")}>Upload files</button>
              <button onClick={() => setTab("link")} className={tabCls("link")}>Add link</button>
              <button onClick={() => setTab("paste")} className={tabCls("paste")}>Paste text</button>
            </div>

            {tab === "upload" && (
              <form onSubmit={uploadFiles} className="mt-4 space-y-3">
                <input type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFiles(e.target.files)} className={inputCls} />
                <p className="text-xs text-slate-500">PDF, Word (.docx), text, or images. Up to 8 files, 15&nbsp;MB each.</p>
                <label className="flex items-start gap-2 rounded-lg bg-orange-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <input type="checkbox" checked={aiExtract} onChange={(e) => setAiExtract(e.target.checked)} className="mt-0.5" />
                  <span><strong>High-accuracy AI extraction</strong> — best for complex tables and scanned documents. Reads the pages with AI (uses your Gemini key) instead of plain text parsing. Slower but far more accurate. Scanned PDFs and images always use this.</span>
                </label>
                <button disabled={busy === "upload" || !files.length}
                  className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
                  {busy === "upload" ? (aiExtract ? "Reading with AI…" : "Extracting…") : "Upload & extract"}
                </button>
              </form>
            )}

            {tab === "link" && (
              <form onSubmit={addUrl} className="mt-4 space-y-3">
                <input value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://… article or PDF link" className={inputCls} />
                <button disabled={busy === "url" || !url.trim()}
                  className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
                  {busy === "url" ? "Fetching…" : "Fetch & add"}
                </button>
              </form>
            )}

            {tab === "paste" && (
              <form onSubmit={addPaste} className="mt-4 space-y-3">
                <input required value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)}
                  placeholder="Source title" className={inputCls} />
                <textarea required value={sourceContent} onChange={(e) => setSourceContent(e.target.value)}
                  rows="6" placeholder="Paste notes, findings, or a transcript" className={inputCls} />
                <button disabled={busy === "paste"} className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
                  {busy === "paste" ? "Saving…" : "Add source"}
                </button>
              </form>
            )}

            <div className="mt-5 space-y-2">
              {!sourcesLoaded ? (
                [0, 1, 2].map((i) => (
                  <div key={"sk" + i} className="h-14 animate-pulse rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
                ))
              ) : sources.length ? sources.map((s) => (
                <div key={s._id} className="flex items-center gap-3 rounded border border-slate-200 p-3 dark:border-slate-700">
                  <input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggle(s._id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.title}</span>
                      <SourceBadge type={s.sourceType} />
                      {s.documentType && s.documentType !== "unknown" && (
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                          {DOC_BADGE[s.documentType] || s.documentType}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.chunkCount} chunks · {(s.charCount || 0).toLocaleString()} chars{s.pages ? ` · ${s.pages} pages` : ""}
                    </div>
                  </div>
                  <button onClick={() => removeSource(s._id)} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                </div>
              )) : <p className="text-slate-500">No sources yet. Upload a file, add a link, or paste text to begin.</p>}
            </div>
          </section>

          {/* ---------------- Generate ---------------- */}
          <section className="rounded-2xl bg-white p-5 shadow dark:bg-slate-900">
            <h2 className="text-xl font-semibold">2. Generate report</h2>
            <form onSubmit={generate} className="mt-4 space-y-3">
              {!perSource && (
                <input required={!perSource} value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Report title" className={inputCls} />
              )}
              <textarea required value={objective} onChange={(e) => setObjective(e.target.value)}
                rows="3" placeholder="What should this report answer?" className={inputCls} />
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className={inputCls}>
                {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={perSource} onChange={(e) => setPerSource(e.target.checked)} />
                Generate one report per selected source (batch)
              </label>
              {!perSource && (
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} />
                  Stream the report live as it is written
                </label>
              )}
              <label className="flex items-start gap-2 rounded-lg bg-orange-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <input type="checkbox" checked={chainMode} onChange={(e) => setChainMode(e.target.checked)} className="mt-0.5" />
                <span><strong>Deep reasoning (multi-step)</strong> — the model first extracts a grounded evidence brief, then drafts, then (for non-streamed reports) verifies every claim against your sources. Higher quality and fewer errors; a little slower. Turn off for the fastest single-pass draft.</span>
              </label>
              <label className="flex items-start gap-2 rounded-lg bg-orange-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <input type="checkbox" checked={parallelMode} onChange={(e) => setParallelMode(e.target.checked)} className="mt-0.5" />
                <span><strong>Fast parallel (multi-model)</strong> — for 2+ sources, each source is analysed at the same time on a different AI provider, then combined into one report. Faster for multi-document reports and avoids truncation. Uses more of your provider quota.</span>
              </label>
              <p className="text-xs text-slate-500">{selected.length} source(s) selected.</p>
              <button disabled={busy === "generate" || !selected.length}
                className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
                {busy === "generate" ? "Working…" : perSource ? "Generate batch" : "Generate structured report"}
              </button>
              {busy === "generate" && perSource && batchProgress && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                    {batchProgress.done} of {batchProgress.total} report{batchProgress.total === 1 ? "" : "s"} done…
                  </p>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                    <div className="h-full bg-orange-500 transition-all"
                      style={{ width: `${batchProgress.total ? Math.round((batchProgress.done / batchProgress.total) * 100) : 0}%` }} />
                  </div>
                </div>
              )}
            </form>

            {(!reportsLoaded || reports.length > 0) && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent reports</h3>
                {!reportsLoaded && (
                  <div className="mt-2 space-y-1">
                    {[0, 1].map((i) => (
                      <div key={"rsk" + i} className="h-8 animate-pulse rounded border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />
                    ))}
                  </div>
                )}
                <input value={reportSearch} onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Search reports…" className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <div className="mt-2 max-h-56 space-y-1 overflow-auto">
                  {reports.filter((r) => !reportSearch || ((r.title || "") + " " + (r.templateLabel || r.template || "")).toLowerCase().includes(reportSearch.toLowerCase())).map((r) => (
                    <div key={r._id} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700">
                      <button onClick={() => openReport(r._id)} className="min-w-0 flex-1 truncate text-left hover:text-orange-600" title="Open">
                        {r.title}
                        <span className="ml-2 text-xs text-slate-400">{r.templateLabel || r.template}</span>
                        {r.generationMode && r.generationMode !== "single-pass" && (
                          <span className="ml-2 rounded bg-orange-100 px-1 text-[10px] text-orange-700 dark:bg-orange-950 dark:text-orange-300">{r.generationMode.includes("parallel") ? "parallel" : r.generationMode.includes("verified") ? "verified" : "multi-step"}</span>
                        )}
                      </button>
                      <button onClick={() => renameRpt(r._id, r.title)} title="Rename" className="rounded px-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">✎</button>
                      <button onClick={() => duplicateRpt(r._id)} title="Duplicate" className="rounded px-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">⧉</button>
                      <button onClick={() => deleteRpt(r._id)} title="Delete" className="rounded px-1.5 text-xs text-slate-400 hover:text-red-600">🗑</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ---------------- Ask your documents (RAG Q&A) ---------------- */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Ask your documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ask a question and get an answer grounded in your selected sources, with citations. {selected.length} source(s) selected.
          </p>
          <form onSubmit={ask} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What were the main adverse events reported?" className={inputCls + " flex-1"} />
            <VoiceInput value={question} onChange={(e) => setQuestion(e.target.value)} />
            <button disabled={asking || !selected.length || !question.trim()}
              className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
              {asking ? "Thinking…" : "Ask"}
            </button>
          </form>
          {answer && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex-1">{answer && <ReadAloud text={toPlain(answer)} className="" />}</div>
                <div className="flex shrink-0 items-center gap-2">
                  {answerCached && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800" title="Served from cache">cached</span>}
                  <button onClick={() => copyText(answer, "Answer")} className="rounded border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600">Copy</button>
                </div>
              </div>
              <div className="report-prose leading-7" dangerouslySetInnerHTML={{ __html: answerRendered }} />
              {answerCitations.length > 0 && <CitationList citations={answerCitations} />}
            </div>
          )}
        </section>

        {/* ---------------- Live streaming view ---------------- */}
        {busy === "generate" && useStream && !perSource && (streamText || chainStep) && (
          <article className="mt-6 rounded-2xl border-2 border-orange-200 bg-white p-6 shadow dark:border-orange-900 dark:bg-slate-900">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-orange-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" /> {chainStep || "Writing report…"}
            </p>
            {streamText
              ? <div className="report-prose leading-7" dangerouslySetInnerHTML={{ __html: streamRendered }} />
              : <p className="text-sm text-slate-500">Reading your sources and preparing a grounded evidence brief…</p>}
          </article>
        )}

        {/* ---------------- Report viewer ---------------- */}
        {report && (
          <article className="mt-6 rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-bold">{report.title}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>{report.templateLabel || report.template}</span>
                  <span className="text-slate-400">· {(report.content || "").split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
                  {report.generationMode && report.generationMode !== "single-pass" && (
                    <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                      title="Generated with the multi-step chain: evidence brief → draft → verify">
                      {report.generationMode.includes("verified") ? "Multi-step · verified" : "Multi-step"}
                    </span>
                  )}
                </p>
                {report.objective && <p className="mt-1 text-xs text-slate-400">{report.objective}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => download(report._id, "pdf")} disabled={busy === "export-pdf"}
                  className="rounded bg-orange-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">Download PDF</button>
                <button onClick={() => download(report._id, "docx")} disabled={busy === "export-docx"}
                  className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">Download Word</button>
                <button onClick={() => download(report._id, "md")} disabled={busy === "export-md"}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">Markdown</button>
                <button onClick={() => copyText(report.content, "Report")}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">Copy</button>
                <button onClick={() => regenerate(report)} disabled={busy === "generate"}
                  className="rounded border border-orange-300 px-3 py-1.5 text-sm text-orange-700 disabled:opacity-50 dark:border-orange-800 dark:text-orange-300">
                  {busy === "generate" ? "Regenerating…" : "Regenerate"}</button>
                <button onClick={() => setCompactReport((v) => !v)}
                  title="Toggle reading density"
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">
                  {compactReport ? "Comfortable" : "Compact"}</button>
                <button onClick={() => setReport(null)} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">Close</button>
              </div>
            </div>
            {report && <ReadAloud text={toPlain(report.content)} className="mb-4" />}
            {report.citations?.some((citation) => Number.isInteger(Number(citation.citationNumber))) && (
              <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Select any <strong>[Source N]</strong> citation in the report to inspect the evidence passage used for that label.
              </p>
            )}
            <div
              onClick={handleReportCitationClick}
              className={"report-prose " + (compactReport ? "text-sm leading-6" : "leading-7")}
              dangerouslySetInnerHTML={{ __html: rendered }}
            />
            {activeCitation && (
              <aside id="evidence-panel" className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30" aria-label={`Evidence for Source ${activeCitation.citationNumber}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">Evidence for Source {activeCitation.citationNumber}</p>
                    <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{activeCitation.sourceTitle}</h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {[activeCitation.section, activeCitation.page ? `Page ${activeCitation.page}` : ""].filter(Boolean).join(" · ") || "Source excerpt"}
                    </p>
                  </div>
                  <button onClick={() => setActiveCitationNumber(null)} className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-700 dark:border-orange-800 dark:text-orange-300">Close evidence</button>
                </div>
                {activeCitation.evidenceMatch && (
                  <span className="mt-3 inline-flex rounded bg-white px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    {activeCitation.evidenceMatch}
                  </span>
                )}
                <blockquote className="mt-3 whitespace-pre-wrap border-l-4 border-orange-300 pl-3 text-sm leading-6 text-slate-700 dark:border-orange-700 dark:text-slate-200">
                  {activeCitation.excerpt || activeCitation.snippet}
                </blockquote>
                <p className="mt-3 text-xs text-slate-500">This is the source passage supplied to the model for this citation label. Check the original document before relying on a generated claim.</p>
              </aside>
            )}
            {report.outline && report.outline.trim() && (
              <details className="mt-6 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">
                  Evidence brief (facts extracted from your sources before drafting)
                </summary>
                <div className="report-prose mt-3 leading-7"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(report.outline, { gfm: true })) }} />
              </details>
            )}
            {report.citations && report.citations.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                <CitationList
                  citations={report.citations}
                  mode={report.retrievalMode}
                  activeCitationNumber={activeCitationNumber}
                  onSelect={selectCitation}
                />
              </div>
            )}
          </article>
        )}
      </div>
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Back to top"
          className="fixed bottom-6 right-6 z-40 rounded-full bg-orange-600 px-4 py-3 text-sm text-white shadow-lg hover:bg-orange-700">
          ↑ Top
        </button>
      )}
    </main>
  );
}

function CitationList({ citations, mode, activeCitationNumber, onSelect }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Evidence used{mode ? ` · ${mode === "semantic-rag" ? "semantic retrieval" : "full-document context"}` : ""}
      </h3>
      {onSelect && <p className="mt-1 text-xs text-slate-500">Select an evidence card to view its full stored excerpt.</p>}
      <div className="mt-2 space-y-2">
        {citations.map((c, i) => (
          <button
            key={c.citationNumber || i}
            id={c.citationNumber ? `citation-${c.citationNumber}` : undefined}
            type="button"
            onClick={() => c.citationNumber && onSelect?.(Number(c.citationNumber))}
            disabled={!c.citationNumber || !onSelect}
            aria-pressed={Number(c.citationNumber) === activeCitationNumber}
            className={`w-full rounded border p-2.5 text-left text-sm transition-colors ${
              Number(c.citationNumber) === activeCitationNumber
                ? "border-orange-400 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30"
                : "border-slate-200 dark:border-slate-700"
            } ${c.citationNumber && onSelect ? "hover:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400" : "cursor-default"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {c.citationNumber ? `Source ${c.citationNumber} · ` : ""}{c.sourceTitle}
              </span>
              {typeof c.score === "number" && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                  {(c.score * 100).toFixed(0)}% match
                </span>
              )}
            </div>
            {(c.section || c.page || c.evidenceMatch) && (
              <p className="mt-1 text-xs text-slate-500">
                {[c.section, c.page ? `Page ${c.page}` : "", c.evidenceMatch].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">{c.snippet}…</p>
          </button>
        ))}
      </div>
    </div>
  );
}
