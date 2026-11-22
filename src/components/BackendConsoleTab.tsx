import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Server,
  Database,
  Play,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Cpu,
  Layers,
  Copy,
  Check,
  Send,
  Code,
  Activity,
  FileCode,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { ConfirmDialog } from './ConfirmDialog';

interface ApiPreset {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  body?: string;
  description: string;
}

const API_PRESETS: ApiPreset[] = [
  {
    name: 'लेख सूची (Get All Articles)',
    method: 'GET',
    endpoint: '/api/articles?limit=5',
    description: 'Fetch latest articles with optional category and limit filters.',
  },
  {
    name: 'राज्य समाचार - दिल्ली (State News Delhi)',
    method: 'GET',
    endpoint: '/api/state-news?state=दिल्ली',
    description: 'Regional news feed for National Capital Region (Delhi-NCR).',
  },
  {
    name: 'राज्य समाचार - महाराष्ट्र (State News Maharashtra)',
    method: 'GET',
    endpoint: '/api/state-news?state=महाराष्ट्र',
    description: 'Regional news for Mumbai, Pune, Nagpur & Vidarbha.',
  },
  {
    name: 'वीडियो बुलेटिन (Video Bulletins)',
    method: 'GET',
    endpoint: '/api/videos',
    description: 'List high-resolution news videos with anchor metadata.',
  },
  {
    name: 'संपादक व एंकर मंडल (Editorial Board)',
    method: 'GET',
    endpoint: '/api/editors',
    description: 'Editorial anchors roster, designations, and prime time shows.',
  },
  {
    name: 'प्लेटफॉर्म एनालिटिक्स (Analytics Dashboard)',
    method: 'GET',
    endpoint: '/api/analytics/dashboard',
    description: 'Editorial content distribution across desks and states.',
  },
  {
    name: 'सिस्टम व डेटाबेस स्थिति (System Health)',
    method: 'GET',
    endpoint: '/api/system/health',
    description: 'Check memory usage, collection counts, and uptime.',
  },
  {
    name: 'एपीआई दस्तावेज़ (API Documentation Specs)',
    method: 'GET',
    endpoint: '/api/docs',
    description: 'Machine-readable schema and documentation of all REST routes.',
  },
];

export function BackendConsoleTab({
  onDatabaseReset,
}: {
  onDatabaseReset?: () => Promise<void> | void;
}) {
  // System Health State
  const [healthData, setHealthData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState<boolean>(true);
  const [consoleFeedback, setConsoleFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // API Explorer State
  const [selectedMethod, setSelectedMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [endpointUrl, setEndpointUrl] = useState<string>('/api/articles?limit=3');
  const [requestBody, setRequestBody] = useState<string>('');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseLatency, setResponseLatency] = useState<number | null>(null);
  const [responsePayload, setResponsePayload] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  const currentOrigin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';

  useEffect(() => {
    loadHealthAndLogs();
  }, []);

  const loadHealthAndLogs = async () => {
    setIsLoadingHealth(true);
    try {
      const [h, l] = await Promise.all([api.getSystemHealth(), api.getSystemLogs()]);
      setHealthData(h);
      setLogs(l || []);
    } catch (err) {
      console.error('Error fetching backend health:', err);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const handleSelectPreset = (preset: ApiPreset) => {
    setSelectedMethod(preset.method);
    setEndpointUrl(preset.endpoint);
    setRequestBody(preset.body || '');
  };

  const handleSendRequest = async () => {
    setIsSending(true);
    setResponseStatus(null);
    setResponsePayload('Processing request...');
    const t0 = performance.now();

    try {
      const options: RequestInit = {
        method: selectedMethod,
        headers: api.getAuthHeaders({ 'Content-Type': 'application/json' }),
      };

      if (['POST', 'PUT', 'PATCH'].includes(selectedMethod) && requestBody.trim()) {
        try {
          JSON.parse(requestBody); // validate
          options.body = requestBody;
        } catch (e: any) {
          setResponsePayload(`JSON Parse Error in Request Body: ${e.message}`);
          setIsSending(false);
          return;
        }
      }

      const res = await fetch(endpointUrl, options);
      const latency = Math.round(performance.now() - t0);
      setResponseLatency(latency);
      setResponseStatus(res.status);

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        setResponsePayload(JSON.stringify(json, null, 2));
      } else {
        const text = await res.text();
        setResponsePayload(text);
      }

      // Refresh audit logs
      api.getSystemLogs().then((l) => setLogs(l || [])).catch(() => {});
    } catch (err: any) {
      const latency = Math.round(performance.now() - t0);
      setResponseLatency(latency);
      setResponseStatus(500);
      setResponsePayload(JSON.stringify({ error: err.message || 'Request Failed' }, null, 2));
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyResponse = () => {
    if (!responsePayload) return;
    navigator.clipboard.writeText(responsePayload);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleResetDatabase = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmResetDatabase = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await api.resetData();
      setShowResetConfirm(false);
      setConsoleFeedback({
        type: 'success',
        message: 'डेटाबेस सफलतापूर्वक डिफ़ॉल्ट संपादकीय स्थिति पर रीसेट हो गया है।',
      });
      await loadHealthAndLogs();
      if (onDatabaseReset) await Promise.resolve(onDatabaseReset());
    } catch (err: any) {
      setShowResetConfirm(false);
      setConsoleFeedback({
        type: 'error',
        message: `त्रुटि: ${err?.message || 'डेटाबेस रीसेट विफल रहा'}`,
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const blob = await api.exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'akp-news-backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setConsoleFeedback({
        type: 'success',
        message: 'डेटाबेस बैकअप (akp-news-backup.json) डाउनलोड शुरू हो गया है।',
      });
    } catch (err: any) {
      setConsoleFeedback({
        type: 'error',
        message: `त्रुटि: ${err?.message || 'बैकअप निर्यात विफल रहा'}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="डेटाबेस फ़ैक्टरी रीसेट की पुष्टि"
        message="क्या आप सचमुच डेटाबेस को फ़ैक्टरी डिफ़ॉल्ट पर रीसेट करना चाहते हैं? सभी हालिया संपादकीय परिवर्तन और नए जोड़े गए आइटम हट जाएंगे।"
        confirmLabel="हाँ, डेटाबेस रीसेट करें"
        cancelLabel="रद्द करें"
        tone="danger"
        theme="dark"
        isProcessing={isResetting}
        onConfirm={handleConfirmResetDatabase}
        onCancel={() => {
          if (!isResetting) setShowResetConfirm(false);
        }}
      />

      {consoleFeedback && (
        <div
          role={consoleFeedback.type === 'error' ? 'alert' : 'status'}
          className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            consoleFeedback.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {consoleFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-700" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            )}
            <span>{consoleFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setConsoleFeedback(null)}
            aria-label="Dismiss console feedback"
            className="p-1 rounded hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. System Architecture & Diagnostics Overview */}
      <div className="bg-zinc-950 text-white rounded-2xl p-6 border border-zinc-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-hindi-brand font-bold text-lg text-white">
                  आज का प्रहरी — बैकएंड आर्किटेक्चर एवं डेटाबेस कंसोल
                </h3>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE (v2.4.0)</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-hindi-brand mt-0.5">
                Node.js Express REST API + फाइल-आधारित निरंतर JSON डेटा स्टोर + AI न्यूज़रूम इंजन
              </p>
            </div>
          </div>

          {/* Quick Database Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs px-3 py-2 rounded-xl font-hindi-brand font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>डेटाबेस बैकअप (JSON)</span>
            </button>

            <button
              onClick={handleResetDatabase}
              className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 text-xs px-3 py-2 rounded-xl font-hindi-brand font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>डेटाबेस रीसेट</span>
            </button>

            <button
              onClick={loadHealthAndLogs}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2 rounded-xl border border-zinc-700 transition-all cursor-pointer"
              title="रिफ्रेश करें"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* System Diagnostics Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-5">
          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Server Engine</span>
            <span className="text-sm font-bold font-mono text-zinc-200 mt-1 block">Express Runtime</span>
            <span
              data-testid="server-port-note"
              className="text-[10px] text-emerald-400 mt-0.5 flex items-start gap-1 leading-snug"
            >
              <Activity className="w-2.5 h-2.5 shrink-0 mt-0.5" />
              <span>Server port is determined by the deployment environment.</span>
            </span>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Storage Mode</span>
            <span className="text-sm font-bold font-mono text-zinc-200 mt-1 block">JSON Store</span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block truncate">data/store.json</span>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Total Records</span>
            <span className="text-sm font-bold font-mono text-amber-400 mt-1 block">
              {healthData?.database?.totalRecords || '...'}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">Articles, States, Videos</span>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Memory (Heap)</span>
            <span className="text-sm font-bold font-mono text-cyan-400 mt-1 block">
              {healthData?.memory?.heapUsedMb ? `${healthData.memory.heapUsedMb} MB` : '...'}
            </span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">RSS: {healthData?.memory?.rssMb || 0} MB</span>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Server Uptime</span>
            <span className="text-sm font-bold font-mono text-zinc-200 mt-1 block">
              {healthData?.uptimeSeconds !== undefined ? `${healthData.uptimeSeconds}s` : '...'}
            </span>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">Zero Downtime</span>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block">Collections</span>
            <span className="text-sm font-bold font-mono text-rose-400 mt-1 block">5 Active</span>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">Read-Only Public + CMS</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive REST API Explorer */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        {/* Explorer Header */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-red-700" />
            <h4 className="font-hindi-brand font-bold text-zinc-900 text-base">
              लाइव एपीआई एक्सप्लोरर एवं रिक्वेस्ट टेस्टर (Interactive REST Playground)
            </h4>
          </div>

          {/* Quick Presets Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-hindi-brand font-semibold shrink-0">प्रीसेट एंडपॉइंट्स:</span>
            <select
              onChange={(e) => {
                const preset = API_PRESETS[parseInt(e.target.value, 10)];
                if (preset) handleSelectPreset(preset);
              }}
              className="bg-white border border-zinc-300 text-xs rounded-lg px-2.5 py-1.5 text-zinc-800 font-hindi-brand font-medium focus:ring-1 focus:ring-red-600 focus:outline-hidden"
            >
              {API_PRESETS.map((preset, idx) => (
                <option key={preset.name} value={idx}>
                  [{preset.method}] {preset.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Method + URL Input Bar */}
          <div className="flex items-center gap-2">
            {/* Method Select */}
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value as any)}
              className={`text-xs font-mono font-bold px-3 py-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                selectedMethod === 'GET'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : selectedMethod === 'POST'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : selectedMethod === 'PUT'
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-red-50 border-red-300 text-red-700'
              }`}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>

            {/* URL Input */}
            <div className="flex flex-1 items-center bg-zinc-50 border border-zinc-300 rounded-xl overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-red-600">
              {currentOrigin && (
                <span
                  data-testid="api-explorer-origin"
                  className="px-3 py-2.5 text-xs font-mono text-zinc-500 bg-zinc-100 border-r border-zinc-200 select-none shrink-0"
                >
                  {currentOrigin}
                </span>
              )}
              <input
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="/api/articles"
                className="w-full px-3 py-2.5 text-xs font-mono bg-transparent focus:outline-hidden text-zinc-900"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendRequest}
              disabled={isSending}
              className="bg-red-700 hover:bg-red-800 text-white px-5 py-2.5 rounded-xl font-hindi-brand font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>भेजा जा रहा है...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>अनुरोध भेजें (Send)</span>
                </>
              )}
            </button>
          </div>

          {/* Request Body (only for POST/PUT) */}
          {['POST', 'PUT', 'PATCH'].includes(selectedMethod) && (
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 font-mono mb-1">
                <span>Request Payload (JSON Body):</span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      setRequestBody(JSON.stringify(JSON.parse(requestBody), null, 2));
                    } catch (e) {}
                  }}
                  className="text-red-700 hover:underline text-[11px]"
                >
                  Format JSON
                </button>
              </div>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                rows={4}
                placeholder='{\n  "key": "value"\n}'
                className="w-full text-xs font-mono p-3 bg-zinc-900 text-zinc-100 rounded-xl border border-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-red-500"
              />
            </div>
          )}

          {/* Response Box */}
          <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-3 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono text-zinc-400 font-semibold">Response:</span>

                {responseStatus !== null && (
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                      responseStatus >= 200 && responseStatus < 300
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}
                  >
                    HTTP {responseStatus}
                  </span>
                )}

                {responseLatency !== null && (
                  <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{responseLatency} ms</span>
                  </span>
                )}
              </div>

              {responsePayload && (
                <button
                  onClick={handleCopyResponse}
                  className="text-zinc-400 hover:text-white flex items-center gap-1 text-[11px] font-mono transition-colors"
                >
                  {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedResponse ? 'Copied' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96 leading-relaxed select-text">
              {responsePayload || '// Click "Send Request" to test any endpoint and view live JSON output...'}
            </pre>
          </div>
        </div>
      </div>

      {/* 3. Live Server Audit & Mutation Log Stream */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-5">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-700" />
            <h4 className="font-hindi-brand font-bold text-zinc-900 text-sm">
              लाइव सर्वर ऑडिट व म्यूटेशन लॉग्स (Recent Server Operations)
            </h4>
          </div>
          <span className="text-xs text-zinc-400 font-mono">{logs.length} logged events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-400 font-semibold text-[11px]">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Route</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-zinc-400 font-hindi-brand">
                    कोई सर्वर म्यूटेशन रिकॉर्ड नहीं है।
                  </td>
                </tr>
              ) : (
                logs.slice(0, 8).map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-2.5 text-zinc-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('hi-IN')}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.method === 'POST'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.method === 'PUT'
                            ? 'bg-amber-100 text-amber-800'
                            : log.method === 'DELETE'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="py-2.5 font-bold text-zinc-800 whitespace-nowrap">{log.endpoint}</td>
                    <td className="py-2.5 text-zinc-500 max-w-xs truncate">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
