(() => {
  "use strict";
  const core = globalThis.ChatGPTTimeMarkCore;
  const selector = '[data-message-id][data-message-author-role="user"], [data-user-message-bubble="true"]';
  const cache = new Map();
  let route = location.pathname;
  let scheduled = false;
  function syncRoute() {
    const next = location.pathname;
    if (next !== route) {
      if (!(route === "/" && /\/c\/[^/]+$/.test(next))) cache.clear();
      route = next;
      document.querySelectorAll("time[data-chatgpt-timestamp]").forEach(element => element.remove());
      window.postMessage({ type: "CHATGPT_TIMESTAMP_READY_V1" }, location.origin);
    }
  }
  function render() {
    scheduled = false;
    syncRoute();
    document.querySelectorAll('time[data-chatgpt-timestamp]').forEach(stamp => {
      if (!stamp.parentElement?.matches(selector)) stamp.remove();
    });
    document.querySelectorAll(selector).forEach(message => {
      const id = core.messageId(message);
      let seconds = cache.get(id);
      const carrier = message.getAttribute('data-chatgpt-timestamp-record');
      if (carrier && carrier.length <= 512) {
        try {
          const item = JSON.parse(carrier);
          if (item?.route === route && item.id === id && core.validTime(item.seconds)) {
            seconds = item.seconds;
          }
        } catch { /* Malformed page attributes cannot break rendering. */ }
      }
      const label = core.format(seconds);
      let stamp = message.querySelector("time[data-chatgpt-timestamp]");
      if (!label) { stamp?.remove(); return; }
      if (!stamp) {
        stamp = document.createElement("time");
        stamp.setAttribute("data-chatgpt-timestamp", "");
        stamp.className = "chatgpt-timestamp";
        message.prepend(stamp);
      }
      if (stamp.textContent !== label) stamp.textContent = label;
      const iso = new Date(seconds * 1000).toISOString();
      if (stamp.dateTime !== iso) stamp.dateTime = iso;
    });
    document.documentElement?.setAttribute('data-chatgpt-timestamp-status', `0.1.15;records=${cache.size};displayed=${document.querySelectorAll('time[data-chatgpt-timestamp]').length}`);
  }
  function schedule() {
    if (!scheduled) { scheduled = true; setTimeout(render, 100); }
  }
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (data?.type !== "CHATGPT_TIMESTAMP_V1" || !Array.isArray(data.records)
        || data.records.length > core.MAX_RECORDS) return;
    syncRoute();
    if (data.route !== route) return;
    for (const item of data.records) {
      if (!core.validId(item?.id) || !core.validTime(item.seconds)) continue;
      cache.delete(item.id);
      cache.set(item.id, item.seconds);
      if (cache.size > core.MAX_RECORDS) cache.delete(cache.keys().next().value);
    }
    schedule();
  });
  new MutationObserver(schedule).observe(document, { childList: true, subtree: true,
    attributes: true, attributeFilter: ["data-message-id", "data-message-author-role", "data-user-message-bubble", "data-chatgpt-search-message-ids", "data-chatgpt-timestamp-record"] });
  window.addEventListener("popstate", schedule);
  window.postMessage({ type: "CHATGPT_TIMESTAMP_READY_V1" }, location.origin);
  schedule();
})();
