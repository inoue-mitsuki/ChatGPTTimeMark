(() => {
  "use strict";
  const core = globalThis.ChatGPTTimeMarkCore;
  if (!core || window.__chatGPTTimeMarkInstalled) return;
  window.__chatGPTTimeMarkInstalled = true;
  const TYPE = "CHATGPT_TIMESTAMP_V1";
  const originalFetch = window.fetch;
  const cache = new Map();
  let requests = 0;
  let fetchCalls = 0;
  const endpoints = new Map();
  function status() {
    if (typeof document !== 'undefined') document.documentElement?.setAttribute('data-chatgpt-timestamp-network', `0.1.15;fetches=${fetchCalls};requests=${requests};records=${cache.size};api=${JSON.stringify([...endpoints])}`);
  }
  status();
  let route = location.pathname;
  function syncRoute() {
    const next = location.pathname;
    if (next !== route) {
      if (!(route === "/" && /\/c\/[^/]+$/.test(next))) cache.clear();
      route = next;
    }
  }
  function publish(records, sourceRoute) {
    syncRoute();
    if (sourceRoute !== route && !(sourceRoute === "/" && /\/c\/[^/]+$/.test(route))) return;
    for (const item of records) {
      cache.delete(item.id);
      cache.set(item.id, item);
      if (cache.size > core.MAX_RECORDS) cache.delete(cache.keys().next().value);
    }
    if (records.length) window.postMessage({ type: TYPE, route, records }, location.origin);
    status();
  }
  async function observe(response, kind, sourceRoute) {
    if (!response.ok || !response.body) return;
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    const feed = core.streamParser(records => publish(records, sourceRoute));
    const timer = setTimeout(() => { void reader.cancel().catch(() => {}); }, 120000);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024) { void reader.cancel().catch(() => {}); return; }
        const chunk = decoder.decode(value, { stream: true });
        if (kind === "stream") feed(chunk); else text += chunk;
      }
      if (kind === "stream") feed(decoder.decode() + "\n\n");
      else publish(core.extract(JSON.parse(text + decoder.decode())), sourceRoute);
    } finally { clearTimeout(timer); reader.releaseLock(); }
  }
  window.fetch = function (...args) {
    fetchCalls++;
    syncRoute();
    const sourceRoute = route;
    let kind = null;
    try {
      const input = args[0];
      const url = new URL(input instanceof Request ? input.url : String(input), location.href);
      const method = String(args[1]?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.origin === location.origin) {
        // Only fixed endpoint group names are recorded. No URL parameters, IDs,
        // request bodies, response bodies, or credentials enter diagnostics.
        const group = /^\/backend-api\/([a-z-]{1,40})(?:\/|$)/.exec(url.pathname)?.[1];
        if (group && endpoints.size < 40) endpoints.set(group, (endpoints.get(group) || 0) + 1);
        if (method === "GET" && /^\/backend-api\/conversation\/[a-f0-9-]{20,}$/i.test(url.pathname)) kind = "detail";
        if (method === "POST" && /^\/backend-api\/(?:f\/)?conversation$/.test(url.pathname)) kind = "stream";
      }
    } catch { /* Never block the original request. */ }
    const result = originalFetch.apply(this, args);
    if (kind) requests++;
    status();
    if (kind) void result.then(response => {
      if (kind === "stream" && !response.headers.get("content-type")?.includes("text/event-stream")) return;
      return observe(response, kind, sourceRoute);
    }).catch(() => {});
    return result;
  };
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== "CHATGPT_TIMESTAMP_READY_V1") return;
    syncRoute();
    if (cache.size) window.postMessage({ type: TYPE, route, records: [...cache.values()] }, location.origin);
  });
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      syncRoute();
      const records = [];
      const elements = document.querySelectorAll('[data-message-id][data-message-author-role="user"], [data-user-message-bubble="true"]');
      for (const element of Array.from(elements).slice(0, core.MAX_RECORDS)) {
        const conversationId = route.match(/\/c\/([^/]+)$/)?.[1];
        const item = core.reactRecord(element, conversationId);
        // Share verified records through DOM without relying on postMessage delivery.
        // Carry only a verified message ID, timestamp and route, never message text.
        if (item) {
          const value = JSON.stringify({ ...item, route });
          if (element.getAttribute('data-chatgpt-timestamp-record') !== value)
            element.setAttribute('data-chatgpt-timestamp-record', value);
        } else element.removeAttribute('data-chatgpt-timestamp-record');
        if (item && cache.get(item.id)?.seconds !== item.seconds) records.push(item);
      }
      if (records.length) publish(records, route);
    };
    const schedule = () => {
      if (!scheduled) { scheduled = true; setTimeout(scan, 200); }
    };
    new MutationObserver(schedule).observe(document, { childList: true, subtree: true,
      attributes: true, attributeFilter: ['data-message-id', 'data-message-author-role', 'data-user-message-bubble', 'data-chatgpt-search-message-ids'] });
    window.addEventListener('popstate', schedule);
    schedule();
  }
})();
