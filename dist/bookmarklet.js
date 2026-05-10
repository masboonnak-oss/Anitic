/* TikTok Live Chat Capture — served from WIN Leaderboard server */
(function () {
  var SERVER = document.currentScript && document.currentScript.getAttribute('data-server')
    ? document.currentScript.getAttribute('data-server')
    : (window.__WIN_SERVER__ || '');

  if (!SERVER) {
    alert('WIN Leaderboard: ไม่พบ server URL กรุณาลาก bookmarklet ใหม่จากหน้า Admin');
    return;
  }

  if (window.__WIN_ACTIVE__) {
    showToast('⚡ WIN Leaderboard กำลังทำงานอยู่แล้ว', '#ffd700');
    return;
  }
  window.__WIN_ACTIVE__ = true;

  var seen = new Set();
  var sentCount = 0;

  function sendUser(uniqueId, nickname, profilePicUrl) {
    var key = uniqueId + '|' + (profilePicUrl || '');
    if (seen.has(key)) return;
    seen.add(key);
    sentCount++;

    fetch(SERVER + '/api/external-chat', {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueId: uniqueId, nickname: nickname || uniqueId, profilePicUrl: profilePicUrl || '' })
    }).catch(function () {});
  }

  function cleanUsername(s) {
    return (s || '').replace(/^@/, '').trim().toLowerCase().replace(/\s+/g, '_');
  }

  function extractFromNode(root) {
    if (!root || !root.querySelectorAll) return;

    /* ── Strategy 1: find profile links with /@username in href ── */
    var links = root.querySelectorAll('a[href*="/@"]');
    links.forEach(function (a) {
      var m = a.href.match(/\/@([A-Za-z0-9_.]+)/);
      if (!m) return;
      var uniqueId = m[1];
      if (uniqueId.length < 1) return;

      /* find avatar img near this link */
      var img = a.querySelector('img') || (a.parentElement && a.parentElement.querySelector('img'));
      var picUrl = (img && img.src && (img.src.includes('tiktokcdn') || img.src.includes('muscdn') || img.src.includes('tiktok'))) ? img.src : '';

      /* find nickname text — first non-empty text node/span near link */
      var nickname = '';
      var container = a.closest('[class]') || a.parentElement;
      if (container) {
        var spans = container.querySelectorAll('span');
        for (var i = 0; i < spans.length; i++) {
          var t = spans[i].textContent.trim();
          if (t && t.length > 0 && t.length < 60 && !t.startsWith('@') && !t.includes('\n')) {
            nickname = t;
            break;
          }
        }
      }

      sendUser(uniqueId, nickname || uniqueId, picUrl);
    });

    /* ── Strategy 2: find TikTok CDN avatar images ── */
    var imgs = root.querySelectorAll('img');
    imgs.forEach(function (img) {
      if (!img.src) return;
      if (!img.src.includes('tiktokcdn') && !img.src.includes('muscdn')) return;

      /* skip icons: images that are too small */
      var sz = img.getAttribute('width') || img.width || 0;
      if (sz && parseInt(sz) < 16) return;

      /* walk up to find a link with username */
      var el = img;
      var uniqueId = null;
      var nickname = '';
      for (var depth = 0; depth < 8 && el; depth++) {
        if (el.tagName === 'A' && el.href) {
          var m2 = el.href.match(/\/@([A-Za-z0-9_.]+)/);
          if (m2) { uniqueId = m2[1]; break; }
        }
        /* look for data attributes containing username */
        if (el.dataset && el.dataset.uniqueId) { uniqueId = el.dataset.uniqueId; break; }
        el = el.parentElement;
      }

      /* try to get nickname from same container as img */
      var container2 = img.closest('[class]') || img.parentElement;
      if (container2) {
        var allText = container2.querySelectorAll('span, p, strong, b');
        for (var j = 0; j < allText.length; j++) {
          var tx = allText[j].textContent.trim();
          if (tx && tx.length > 0 && tx.length < 60 && !tx.includes('\n')) {
            if (tx.startsWith('@') && !uniqueId) {
              uniqueId = tx.slice(1);
            } else if (!tx.startsWith('@') && !nickname) {
              nickname = tx;
            }
          }
        }
      }

      if (!uniqueId && !nickname) return;
      var uid = uniqueId || cleanUsername(nickname) || ('user_' + Date.now());
      sendUser(uid, nickname || uid, img.src);
    });
  }

  /* ── Initial scan ── */
  extractFromNode(document.body);

  /* ── Watch for new chat messages ── */
  var chatRoot = document.querySelector('[data-e2e="chat-room-message-list"]')
    || document.querySelector('[data-e2e="chatroom"]')
    || document.querySelector('[class*="ChatroomMessageList"]')
    || document.querySelector('[class*="chatroom"]')
    || document.body;

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) extractFromNode(n);
      });
    });
  });
  observer.observe(chatRoot, { childList: true, subtree: true });

  function showToast(msg, color) {
    var t = document.createElement('div');
    t.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483647',
      'background:#0d0d1a', 'color:#fff', 'padding:10px 16px',
      'border-radius:10px', 'font-family:sans-serif', 'font-size:13px',
      'border:2px solid ' + (color || '#ffd700'),
      'box-shadow:0 4px 24px rgba(0,0,0,0.7)', 'transition:opacity 0.4s'
    ].join(';');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 3000);
  }
})();
