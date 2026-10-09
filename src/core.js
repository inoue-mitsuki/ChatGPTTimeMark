/* Shared pure functions. No message text is retained or returned. */
(() => {
  "use strict";
  const MAX_RECORDS = 2000;
  const validId = id => typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
  const validTime = seconds => typeof seconds === "number" && Number.isFinite(seconds)
    && seconds >= 1577836800 && seconds <= Date.now() / 1000 + 86400;
  const isDotsRoute = path => typeof path === "string" && /^\/dots\/[a-zA-Z0-9_-]+\/?$/.test(path);
  function record(message, allowAssistant = false) {
    if (!message || !validId(message.id) || !(message.author?.role === "user" || (allowAssistant && message.author?.role === "assistant"))
        || !validTime(message.create_time)) return null;
    return { id: message.id, seconds: message.create_time };
  }
  function extract(data) {
    const records = [];
    const add = message => {
      const item = record(message);
      if (item && records.length < MAX_RECORDS) records.push(item);
    };
    if (!data || typeof data !== "object") return records;
    if (data.mapping && typeof data.mapping === "object") {
      let count = 0;
      for (const key in data.mapping) {
        if (++count > 10000) break;
        if (Object.hasOwn(data.mapping, key)) add(data.mapping[key]?.message);
      }
    }
    add(data.message);
    add(data.input_message);
    add(data.v?.message);
    return records;
  }
  function format(seconds) {
    if (!validTime(seconds)) return null;
    const date = new Date(seconds * 1000);
    const pad = value => String(value).padStart(2, "0");
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  function messageId(element, allowAssistant = false) {
    if (element.matches('[data-message-id][data-message-author-role="user"]') || (allowAssistant && element.matches('[data-message-id][data-message-author-role="assistant"]'))) {
      const id = element.getAttribute('data-message-id');
      return validId(id) ? id : null;
    }
    const ids = element.closest('[data-chatgpt-search-message-ids]')?.getAttribute('data-chatgpt-search-message-ids');
    // Never guess from turn position, text, or a list of ambiguous IDs.
    return validId(ids) ? ids : null;
  }
  function committedPath(start) {
    const chain = [];
    const seen = new Set();
    let node = start;
    while (node && chain.length < 400 && !seen.has(node)) {
      seen.add(node); chain.push(node);
      if (node.tag === 3) break;
      node = node.return;
    }
    if (chain.at(-1)?.tag !== 3) return null;
    const root = chain.at(-1).stateNode?.current;
    if (root !== chain.at(-1) && root !== chain.at(-1).alternate) return null;
    const path = [root];
    let work = 0;
    for (let index = chain.length - 2; index >= 0; index--) {
      let child = path.at(-1).child;
      let match = null;
      const siblings = new Set();
      while (child) {
        if (++work > 4096 || siblings.has(child)) return null;
        siblings.add(child);
        if (child === chain[index] || child === chain[index].alternate) {
          if (match) return null;
          match = child;
        }
        child = child.sibling;
      }
      if (!match) return null;
      path.push(match);
    }
    return chain.at(-1).stateNode.current === root ? path.reverse() : null;
  }
  function snapshotRecord(path, id, conversationId, allowAssistant = false) {
    if (!validId(conversationId)) return null;
    const entry = path.map(node => node.memoizedProps?.entry).find(value =>
      value?.conversationId === conversationId && Array.isArray(value.turn?.items));
    if (!entry || !entry.turn.items.some(item => (item.type === 'user-message' || (allowAssistant && item.type === 'assistant-message'))
      && (item.messageId === id || item.serverMessageId === id))) return null;
    let result = null;
    let mapping = null;
    let conflict = false;
    let budget = 4096;
    const inspect = value => {
      if (--budget < 0) return;
      if (!Array.isArray(value?.renderedTurns) || !value.renderedConversation?.mapping) return;
      const turns = value.renderedTurns;
      if (turns.length > 10000 || turns.filter(turn => turn.id === entry.id && turn.turn === entry.turn).length !== 1) return;
      const candidateMapping = value.renderedConversation.mapping;
      const candidateNode = candidateMapping[id];
      const candidate = candidateNode?.id === id ? record(candidateNode.message, allowAssistant) : null;
      if (!candidate) return;
      if (mapping && mapping !== candidateMapping) conflict = true;
      mapping = candidateMapping;
      result = candidate;
    };
    for (const owner of path) {
      if (owner.memoizedProps?.conversationId !== conversationId) continue;
      let hook = owner.memoizedState;
      const seen = new Set();
      while (hook && budget > 0) {
        if (seen.has(hook)) return null;
        seen.add(hook);
        inspect(hook.memoizedState);
        if (Array.isArray(hook.memoizedState)) inspect(hook.memoizedState[0]);
        hook = hook.next;
      }
      if (hook) return null;
      const rows = owner.updateQueue?.memoCache?.data;
      if (!Array.isArray(rows) || rows.length > 32) continue;
      for (const row of rows) {
        if (!Array.isArray(row) || row.length > 1024) continue;
        for (const value of row) {
          if (budget <= 0) return null;
          inspect(value);
        }
      }
    }
    return conflict ? null : result;
  }
  function reactRecord(element, conversationId, allowAssistant = false) {
    const id = messageId(element, allowAssistant);
    if (!id) return null;
    // Read only nearby message props, never search the whole application state.
    for (let dom = element, level = 0; dom && level < 8; dom = dom.parentElement, level++) {
      const key = Object.keys(dom).find(name => name.startsWith('__reactFiber$'));
      if (!key) continue;
      const fiber = dom[key];
      for (const start of [fiber, fiber?.alternate]) {
        const path = committedPath(start);
        if (!path) continue;
        const current = snapshotRecord(path, id, conversationId, allowAssistant);
        if (current) return current;
        let item = null;
        let conflict = false;
        for (const node of path) {
          const messages = node.memoizedProps?.messages;
          if (Array.isArray(messages)) {
            for (const message of messages.slice(0, MAX_RECORDS)) {
              if (message?.id !== id) continue;
              const candidate = record(message, allowAssistant);
              if (candidate) {
                if (item && item.seconds !== candidate.seconds) conflict = true;
                item = candidate;
              }
            }
          }
        }
        if (item && !conflict) return item;
      }
    }
    return null;
  }
  function streamParser(emit) {
    let pending = "";
    return chunk => {
      pending += chunk;
      if (pending.length > 1024 * 1024) { pending = ""; return; }
      let match;
      while ((match = /\r?\n\r?\n/.exec(pending))) {
        const event = pending.slice(0, match.index);
        pending = pending.slice(match.index + match[0].length);
        const text = event.split(/\r?\n/).filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).replace(/^ /, "")).join("\n");
        if (!text || text === "[DONE]") continue;
        try { const records = extract(JSON.parse(text)); if (records.length) emit(records); }
        catch { /* Unknown stream formats are ignored. */ }
      }
    };
  }
  const api = Object.freeze({ MAX_RECORDS, isDotsRoute, validId, validTime, extract, format, streamParser, messageId, reactRecord });
  globalThis.ChatGPTTimeMarkCore = api;
  if (typeof module === "object" && module?.exports) module.exports = api;
})();
