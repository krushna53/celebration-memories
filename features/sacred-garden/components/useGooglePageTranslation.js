"use client";
import { useEffect } from "react";

const translated = new WeakMap();
const responseCache = new Map();
const SKIP = "script,style,noscript,svg,[data-no-translate],[aria-hidden='true']";

function textNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    const value = node.nodeValue;
    if (!value?.trim() || node.parentElement?.closest(SKIP)) continue;
    nodes.push(node);
  }
  return nodes;
}

async function translateBatch(nodes, target, current) {
  const pending = nodes.filter((node) => {
    if (!node.isConnected) return false;
    const previous = translated.get(node);
    if (previous?.target === target && node.nodeValue === previous.value) return false;
    if (previous) {
      if (node.nodeValue === previous.value) node.nodeValue = previous.source;
      translated.delete(node);
    }
    return true;
  });
  for (let start = 0; start < pending.length; start += 100) {
    if (!current()) return;
    const batch = pending.slice(start, start + 100);
    const source = batch.map((node) => node.nodeValue);
    const unseen = [...new Set(source.filter((value) => !responseCache.has(`${target}\0${value}`)))];
    try {
      if (unseen.length) {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, text: unseen }),
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!current() || !Array.isArray(result.translations) || result.translations.length !== unseen.length) return;
        unseen.forEach((value, i) => responseCache.set(`${target}\0${value}`, result.translations[i]));
      }
      if (!current()) return;
      batch.forEach((node, i) => {
        const value = responseCache.get(`${target}\0${source[i]}`);
        if (node?.isConnected && node.nodeValue === source[i] && typeof value === "string") {
          translated.set(node, { target, source: source[i], value });
          node.nodeValue = value;
        }
      });
    } catch {
      // The invitation's built-in copy remains available when translation is offline.
    }
  }
}

export function useGooglePageTranslation(target) {
  useEffect(() => {
    const root = document.querySelector("[data-invite-shell]");
    if (!root) return undefined;
    const nodes = textNodes(root);
    if (!target || target === "en") {
      nodes.forEach((node) => {
        const previous = translated.get(node);
        if (!previous) return;
        if (node.nodeValue === previous.value) node.nodeValue = previous.source;
        translated.delete(node);
      });
      return undefined;
    }
    nodes.forEach((node) => {
      const previous = translated.get(node);
      if (!previous) return;
      if (node.nodeValue === previous.value) node.nodeValue = previous.source;
      translated.delete(node);
    });
    let active = true;
    let timer;
    const current = () => active;
    const translate = (nodes) => translateBatch(nodes, target, current);
    translate(nodes);

    const observer = new MutationObserver((records) => {
      const changed = new Set();
      for (const record of records) {
        if (record.type === "characterData") changed.add(record.target);
        for (const added of record.addedNodes ?? []) {
          if (added.nodeType === Node.TEXT_NODE) changed.add(added);
          else if (added.nodeType === Node.ELEMENT_NODE && !added.matches(SKIP)) textNodes(added).forEach((node) => changed.add(node));
        }
      }
      if (changed.size) {
        clearTimeout(timer);
        timer = setTimeout(() => translate([...changed]), 80);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => { active = false; clearTimeout(timer); observer.disconnect(); };
  }, [target]);
}
