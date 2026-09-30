(() => {
  'use strict';

  const HOST_ID = 'gh-quick-jump-host';
  const POS_KEY = 'gh-quick-jump-pos';
  const CUSTOM_KEY = 'gh-quick-jump-custom';
  const FAB_SIZE = 48;
  const EDGE_MARGIN = 12;
  const DRAG_THRESHOLD = 4;

  const SERVICES = [
    { id: 'gitdiagram', label: 'GitDiagram', desc: '看架构图', url: (o, r) => `https://gitdiagram.com/${o}/${r}` },
    { id: 'deepwiki', label: 'DeepWiki', desc: '读项目讲解', url: (o, r) => `https://deepwiki.com/${o}/${r}` },
    { id: 'gitingest', label: 'Gitingest', desc: '整理给 AI', url: (o, r) => `https://gitingest.com/${o}/${r}` },
    { id: 'github1s', label: 'GitHub1s', desc: '在线读源码', url: (o, r) => `https://github1s.com/${o}/${r}` },
    { id: 'githubdev', label: 'GitHub.dev', desc: '在线改代码', url: (o, r) => `https://github.dev/${o}/${r}` },
    { id: 'stackblitz', label: 'StackBlitz', desc: '在线运行', url: (o, r) => `https://stackblitz.com/github/${o}/${r}` },
    { id: 'github', label: 'GitHub', desc: '回到仓库页', url: (o, r) => `https://github.com/${o}/${r}` }
  ];

  const RESERVED = new Set([
    'settings', 'notifications', 'marketplace', 'explore', 'topics', 'trending',
    'collections', 'events', 'sponsors', 'sponsoring', 'orgs', 'users', 'new',
    'login', 'logout', 'join', 'signup', 'features', 'enterprise', 'pricing',
    'security', 'about', 'site', 'contact', 'dashboard', 'pulls', 'issues',
    'codespaces', 'apps', 'search', 'gist', 'home', 'organizations', 'account',
    'sessions', 'stars', 'watching', 'following', 'discussions', 'blog',
    'careers', 'shop', 'customer-stories', 'solutions', 'resources', 'mobile',
    'team', 'nonprofit', 'education', 'government', 'community', 'readme',
    'collections', 'sponsors', 'git-guides', 'open-source', 'premium'
  ]);

  const GITHUB_MARK = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z';

  const CSS = `
    .root {
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .fab {
      width: ${FAB_SIZE}px;
      height: ${FAB_SIZE}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(28, 30, 34, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
      cursor: pointer;
      user-select: none;
      touch-action: none;
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .fab:hover { transform: scale(1.06); background: rgba(45, 48, 54, 0.96); }
    .fab:active { transform: scale(0.97); }
    .fab svg { width: 23.4px; height: 23.4px; fill: #ffffff; pointer-events: none; }
    .panel {
      position: absolute;
      left: 0;
      top: calc(100% + 10px);
      min-width: 212px;
      padding: 6px;
      box-sizing: border-box;
      background: rgba(28, 30, 34, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
      overscroll-behavior: contain;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-6px);
      transition: opacity 0.14s ease, transform 0.14s ease, visibility 0.14s;
    }
    .panel.open { opacity: 1; visibility: visible; transform: translateY(0); }
    .panel.align-right { left: auto; right: 0; }
    .panel.up { top: auto; bottom: calc(100% + 10px); transform: translateY(6px); }
    .panel.up.open { transform: translateY(0); }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      color: #e6e8eb;
      font-size: 13px;
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
    }
    .item:hover { background: rgba(255, 255, 255, 0.1); }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #7ee787; flex: none; }
    .item.custom .dot { background: #58a6ff; }
    .label { font-weight: 500; }
    .desc { margin-left: auto; padding-left: 12px; color: #98a2b3; font-size: 12px; }
    .item.current { color: #8b949e; cursor: default; }
    .item.current:hover { background: transparent; }
    .item.current .dot { background: #6e7681; }
    .item.current .desc { color: #6e7681; }
  `;

  const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

  const STACKBLITZ_HOSTS = new Set(['stackblitz.com', 'www.stackblitz.com']);

  // 域名 → 服务 id：既用于 URL 反解析，也用于在面板里标记「当前所在服务」
  const SERVICE_BY_HOST = {
    'gitdiagram.com': 'gitdiagram',
    'www.gitdiagram.com': 'gitdiagram',
    'deepwiki.com': 'deepwiki',
    'www.deepwiki.com': 'deepwiki',
    'gitingest.com': 'gitingest',
    'www.gitingest.com': 'gitingest',
    'github1s.com': 'github1s',
    'www.github1s.com': 'github1s',
    'github.dev': 'githubdev',
    'www.github.dev': 'githubdev',
    'stackblitz.com': 'stackblitz',
    'www.stackblitz.com': 'stackblitz'
  };

  const PLAIN_HOSTS = new Set(
    Object.keys(SERVICE_BY_HOST).filter((h) => !STACKBLITZ_HOSTS.has(h))
  );

  // 当前页面本身对应哪个服务；GitHub 不是跳转目标站点，单独判定
  function currentServiceId(hostname) {
    const host = hostname.toLowerCase();
    if (GITHUB_HOSTS.has(host)) return 'github';
    return SERVICE_BY_HOST[host] || null;
  }

  // 用户在选项页添加的自定义跳转目标，存于 chrome.storage.sync
  let customServices = [];

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  function sanitizeCustom(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const label = String(item.label || '').trim();
      const template = String(item.template || '').trim();
      if (!label || !isHttpUrl(template)) continue;
      out.push({
        id: `custom:${out.length}`,
        label,
        desc: String(item.desc || '').trim(),
        custom: true,
        url: (owner, repo) =>
          template
            .replace(/\{owner\}/g, encodeURIComponent(owner))
            .replace(/\{repo\}/g, encodeURIComponent(repo))
      });
    }
    return out;
  }

  function activeServices() {
    return customServices.length ? SERVICES.concat(customServices) : SERVICES;
  }

  function toRepo(owner, repo) {
    const clean = repo.replace(/\.git$/, '');
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(clean)) return null;
    return { owner, repo: clean };
  }

  function parseRepo(hostname, pathname) {
    const host = hostname.toLowerCase();
    const segs = pathname.split('/').filter(Boolean);

    if (GITHUB_HOSTS.has(host)) {
      if (segs.length < 2) return null;
      if (RESERVED.has(segs[0].toLowerCase())) return null;
      return toRepo(segs[0], segs[1]);
    }

    if (STACKBLITZ_HOSTS.has(host)) {
      if (segs.length < 3 || segs[0].toLowerCase() !== 'github') return null;
      return toRepo(segs[1], segs[2]);
    }

    if (PLAIN_HOSTS.has(host)) {
      if (segs.length < 2) return null;
      return toRepo(segs[0], segs[1]);
    }

    return null;
  }

  let host = null;
  let fab = null;
  let panel = null;
  let currentKey = null;
  let currentInfo = null;
  let suppressNextClick = false;

  function buildWidget() {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'position:fixed;z-index:2147483647;left:0;top:0;margin:0;padding:0;border:0;line-height:0;';

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="root">
        <div class="fab" role="button" tabindex="0" aria-label="GitHub Quick Jump" aria-expanded="false">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="${GITHUB_MARK}"/></svg>
        </div>
        <div class="panel" role="menu"></div>
      </div>
    `;

    fab = root.querySelector('.fab');
    panel = root.querySelector('.panel');

    document.body.appendChild(host);

    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      togglePanel();
    });
    fab.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePanel();
      }
    });

    enableDrag();
    loadPosition();
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onDocumentKeyDown, true);
    window.addEventListener('resize', applyPosition);
  }

  function createItem(svc, info, currentId) {
    const isCurrent = svc.id === currentId;
    const node = document.createElement('a');
    node.className = isCurrent ? 'item current' : svc.custom ? 'item custom' : 'item';
    node.setAttribute('role', 'menuitem');
    node.dataset.service = svc.id;

    if (isCurrent) {
      node.setAttribute('aria-current', 'true');
    } else {
      node.href = svc.url(info.owner, info.repo);
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
      node.addEventListener('click', closePanel);
    }

    const dot = document.createElement('span');
    dot.className = 'dot';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = svc.label;
    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = isCurrent ? '当前' : svc.desc;
    node.append(dot, label, desc);
    return node;
  }

  function renderItems(info) {
    if (!info) return;
    const currentId = currentServiceId(location.hostname);
    panel.textContent = '';
    for (const svc of activeServices()) {
      panel.appendChild(createItem(svc, info, currentId));
    }
  }

  function openPanel() {
    if (panel.classList.contains('open')) return;
    const rect = host.getBoundingClientRect();
    // 面板高度随自定义地址数量增长，先量出实际高度，再挑空间更大的一侧展开，
    // 并把高度限制在该侧可用空间内（超出时面板内部滚动），避免整体跑出视口。
    panel.style.maxHeight = '';
    const height = panel.offsetHeight;
    const below = window.innerHeight - rect.bottom - 10;
    const above = rect.top - 10;
    const useUp = above > below;
    panel.classList.toggle('align-right', rect.left + rect.width / 2 > window.innerWidth / 2);
    panel.classList.toggle('up', useUp);
    panel.style.maxHeight = `${Math.max(useUp ? above : below, Math.min(height, 120))}px`;
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    if (!panel.classList.contains('open')) return;
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  function onDocumentPointerDown(e) {
    if (!host || !e.composedPath().includes(host)) closePanel();
  }

  function onDocumentKeyDown(e) {
    if (e.key === 'Escape') closePanel();
  }

  function clampTop(top) {
    const max = window.innerHeight - FAB_SIZE - EDGE_MARGIN;
    return Math.min(Math.max(top, EDGE_MARGIN), Math.max(max, EDGE_MARGIN));
  }

  function sideToLeft(side) {
    return side === 'right' ? window.innerWidth - FAB_SIZE - EDGE_MARGIN : EDGE_MARGIN;
  }

  let position = { side: 'right', top: 120 };

  function applyPosition() {
    host.style.left = `${sideToLeft(position.side)}px`;
    host.style.top = `${clampTop(position.top)}px`;
  }

  function loadPosition() {
    applyPosition();
    try {
      chrome.storage.local.get(POS_KEY, (data) => {
        const saved = data && data[POS_KEY];
        if (saved && (saved.side === 'left' || saved.side === 'right') && typeof saved.top === 'number') {
          position = { side: saved.side, top: saved.top };
          applyPosition();
        }
      });
    } catch (err) {
      /* storage 不可用时使用默认位置 */
    }
  }

  function savePosition() {
    try {
      chrome.storage.local.set({ [POS_KEY]: position });
    } catch (err) {
      /* 忽略 */
    }
  }

  function enableDrag() {
    let dragging = false;
    let moved = false;
    let offsetX = 0;
    let offsetY = 0;

    fab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      suppressNextClick = false;
      dragging = true;
      moved = false;
      const rect = host.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      fab.setPointerCapture(e.pointerId);
    });

    fab.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const left = e.clientX - offsetX;
      const top = e.clientY - offsetY;
      if (!moved) {
        const rect = host.getBoundingClientRect();
        if (Math.abs(left - rect.left) > DRAG_THRESHOLD || Math.abs(top - rect.top) > DRAG_THRESHOLD) {
          moved = true;
          closePanel();
        }
      }
      if (!moved) return;
      host.style.left = `${left}px`;
      host.style.top = `${top}px`;
    });

    fab.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      try {
        fab.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* 已释放 */
      }
      if (!moved) return;
      suppressNextClick = true;
      const rect = host.getBoundingClientRect();
      position = {
        side: rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right',
        top: clampTop(rect.top)
      };
      applyPosition();
      savePosition();
    });

    fab.addEventListener('pointercancel', () => {
      dragging = false;
      moved = false;
      applyPosition();
    });
  }

  function update() {
    if (!host) buildWidget();
    if (!host.isConnected) document.body.appendChild(host);
    const info = parseRepo(location.hostname, location.pathname);
    currentInfo = info;
    if (!info) {
      host.style.display = 'none';
      currentKey = null;
      closePanel();
      return;
    }
    host.style.display = '';
    const key = `${info.owner}/${info.repo}`;
    if (key !== currentKey) {
      currentKey = key;
      renderItems(info);
    }
    closePanel();
  }

  function watchRoute() {
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        setTimeout(update, 0);
        return result;
      };
    }
    window.addEventListener('popstate', () => setTimeout(update, 0));
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes[CUSTOM_KEY]) return;
      customServices = sanitizeCustom(changes[CUSTOM_KEY].newValue);
      renderItems(currentInfo);
    });
    chrome.storage.sync.get(CUSTOM_KEY, (data) => {
      customServices = sanitizeCustom(data && data[CUSTOM_KEY]);
      renderItems(currentInfo);
    });
  } catch (err) {
    /* storage 不可用时只用内置服务 */
  }

  watchRoute();
  if (document.body) {
    update();
  } else {
    document.addEventListener('DOMContentLoaded', update, { once: true });
  }
})();