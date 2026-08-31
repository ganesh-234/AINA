import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";

const api = import.meta.env.VITE_SERVER_URL;

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
  const [streamText, setStreamText] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [answerCitations, setAnswerCitations] = useState([]);
  const [asking, setAsking] = useState(false);

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
  }, [headers]);

  const loadReports = useCallback(async () => {
    try {
      const r = await axios.get(api + "/api/reports", { headers });
      setReports(r.data.reports || []);
    } catch { /* non-fatal */ }
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
    setBusy("generate"); setError(""); setReport(null); setStreamText("");
    try {
      if (perSource) {
        const r = await axios.post(api + "/api/reports/batch",
          { perSource: true, objective, template, sourceIds: selected }, { headers });
        flash(`Batch complete: ${r.data.results.filter((x) => x.status === "complete").length}/${r.data.count} reports.`);
        await loadReports();
        const firstOk = r.data.results.find((x) => x.reportId);
        if (firstOk) await openReport(firstOk.reportId);
      } else if (useStream) {
        await streamGenerate();
      } else {
        const r = await axios.post(api + "/api/reports/generate",
          { title, objective, template, sourceIds: selected }, { headers });
        setReport(r.data.report);
        await loadReports();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Could not generate the report.");
    } finally { setBusy(""); }
  };

  // Streaming generation via fetch + SSE parsing (EventSource can't send auth headers).
  const streamGenerate = async () => {
    setStreamText("");
    const resp = await fetch(api + "/api/reports/generate/stream", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title, objective, template, sourceIds: selected }),
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
            else if (event === "done") { doneId = j.reportId; }
            else if (event === "error") { throw new Error(j.error || "Generation failed."); }
          } catch (e) { if (event === "error") throw e; }
        }
      }
    }
    await loadReports();
    if (doneId) { setStreamText(""); await openReport(doneId); }
  };

  /* --------------------- ask your documents -------------------- */
  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selected.length) { setError("Select at least one source and type a question."); return; }
    setAsking(true); setError(""); setAnswer(null); setAnswerCitations([]);
    try {
      const r = await axios.post(api + "/api/reports/ask", { question, sourceIds: selected }, { headers });
      setAnswer(r.data.answer); setAnswerCitations(r.data.citations || []);
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
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch { setError("Could not open that report."); }
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
    () => (report ? DOMPurify.sanitize(marked.parse(report.content || "", { gfm: true })) : ""),
    [report]
  );
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

        {error && <p className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {notice && <p className="mb-4 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ---------------- Source library ---------------- */}
          <section className="rounded-2xl bg-white p-5 shadow dark:bg-slate-900">
            <h2 className="text-xl font-semibold">1. Source library</h2>

            <div className="mt-3 flex gap-2">
              <button onClick={() => setTab("upload")} className={tabCls("upload")}>Upload files</button>
              <button onClick={() => setTab("link")} className={tabCls("link")}>Add link</button>
              <button onClick={() => setTab("paste")} className={tabCls("paste")}>Paste text</button>
            </div>

            {tab === "upload" && (
              <form onSubmit={uploadFiles} className="mt-4 space-y-3">
                <input type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFiles(e.target.files)} className={inputCls} />
                <p className="text-xs text-slate-500">PDF, Word (.docx), text, or images. Up to 20 files, 25&nbsp;MB each.</p>
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
              {sources.length ? sources.map((s) => (
                <div key={s._id} className="flex items-center gap-3 rounded border border-slate-200 p-3 dark:border-slate-700">
                  <input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggle(s._id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.title}</span>
                      <SourceBadge type={s.sourceType} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.chunkCount} chunks · {(s.charCount || 0).toLocaleString()} chars{s.pages ? ` · ${s.pages} pages` : ""}
                    </div>
                  </div>
                  <button onClick={() => removeSource(s._id)} className="text-xs text-slate-400 hover:text-red-600">Remove</button>
                </div>
              )) : <p className="text-slate-500">Add a source to begin.</p>}
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
              <p className="text-xs text-slate-500">{selected.length} source(s) selected.</p>
              <button disabled={busy === "generate" || !selected.length}
                className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
                {busy === "generate" ? "Working…" : perSource ? "Generate batch" : "Generate structured report"}
              </button>
            </form>

            {reports.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent reports</h3>
                <div className="mt-2 max-h-56 space-y-1 overflow-auto">
                  {reports.map((r) => (
                    <div key={r._id} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700">
                      <button onClick={() => openReport(r._id)} className="min-w-0 flex-1 truncate text-left hover:text-orange-600" title="Open">
                        {r.title}
                        <span className="ml-2 text-xs text-slate-400">{r.templateLabel || r.template}</span>
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
            <button disabled={asking || !selected.length || !question.trim()}
              className="rounded bg-orange-600 px-4 py-2 text-white disabled:opacity-50">
              {asking ? "Thinking…" : "Ask"}
            </button>
          </form>
          {answer && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="report-prose leading-7" dangerouslySetInnerHTML={{ __html: answerRendered }} />
              {answerCitations.length > 0 && <CitationList citations={answerCitations} />}
            </div>
          )}
        </section>

        {/* ---------------- Live streaming view ---------------- */}
        {busy === "generate" && useStream && !perSource && streamText && (
          <article className="mt-6 rounded-2xl border-2 border-orange-200 bg-white p-6 shadow dark:border-orange-900 dark:bg-slate-900">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-orange-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-500" /> Writing report…
            </p>
            <div className="report-prose leading-7" dangerouslySetInnerHTML={{ __html: streamRendered }} />
          </article>
        )}

        {/* ---------------- Report viewer ---------------- */}
        {report && (
          <article className="mt-6 rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-bold">{report.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{report.templateLabel || report.template}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => download(report._id, "pdf")} disabled={busy === "export-pdf"}
                  className="rounded bg-orange-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">Download PDF</button>
                <button onClick={() => download(report._id, "docx")} disabled={busy === "export-docx"}
                  className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">Download Word</button>
                <button onClick={() => download(report._id, "md")} disabled={busy === "export-md"}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">Markdown</button>
              </div>
            </div>
            <div className="report-prose leading-7" dangerouslySetInnerHTML={{ __html: rendered }} />
            {report.citations && report.citations.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                <CitationList citations={report.citations} mode={report.retrievalMode} />
              </div>
            )}
          </article>
        )}
      </div>
    </main>
  );
}

function CitationList({ citations, mode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Evidence used{mode ? ` · ${mode === "semantic-rag" ? "semantic retrieval" : "full-document context"}` : ""}
      </h3>
      <div className="mt-2 space-y-2">
        {citations.map((c, i) => (
          <div key={i} className="rounded border border-slate-200 p-2.5 text-sm dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">{c.sourceTitle}</span>
              {typeof c.score === "number" && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                  {(c.score * 100).toFixed(0)}% match
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">{c.snippet}…</p>
          </div>
        ))}
      </div>
    </div>
  );
}
