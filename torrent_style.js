(function () {
  'use strict';

  if (window.__torrent_styles_mod_loaded) return;
  window.__torrent_styles_mod_loaded = true;

  var CONFIG = {
    pluginId: 'torrent_styles_neon',
    name: 'Torrent Neon Styles',
    version: '2.2'
  };

  // Профессиональная UI/UX палитра (Apple Dark Mode Spectrum)
  var COLOR = {
    red: '#FF453A',
    orange: '#FF9F0A',
    yellow: '#FFD60A',
    green: '#30D158',
    blue: '#0A84FF',
    cyan: '#64D2FF'
  };

  // Пороги значений
  var TH = {
    seeds: { low: 5, good: 10, high: 20 },
    bitrate: { warn: 50, orange: 75, danger: 100 },
    size_gb: { mid: 50, high: 100, top: 200 },
    peers_high: 10
  };

  function currentHostname() {
    try {
      return (window.location && (window.location.hostname || window.location.host)) || '';
    } catch (e) {
      return '';
    }
  }

  function isBlockedHost() {
    var host = String(currentHostname()).toLowerCase();
    return /(^|\.)bylampa\.online$/i.test(host);
  }

  // --- Parser Block ---
  function blockParser() {
    if (typeof Lampa === 'undefined' || !Lampa.Parser) return;
    ['get', 'jackett'].forEach(function (method) {
      if (typeof Lampa.Parser[method] === 'function') {
        var orig = Lampa.Parser[method];
        Lampa.Parser[method] = function () {
          if (isBlockedHost()) {
            var cb = method === 'get' ? arguments[1] : arguments[4];
            if (typeof cb === 'function') cb({ Results: [] });
            return;
          }
          return orig.apply(this, arguments);
        };
      }
    });
  }

  function attachParserBlock() {
    if (!isBlockedHost()) return;
    var tries = 0;
    var timer = setInterval(function () {
      blockParser();
      if (++tries > 40) clearInterval(timer);
    }, 250);
    blockParser();
  }

  // --- UI/UX CSS Injection ---
  function injectStyles() {
    if (document.querySelector('[data-' + CONFIG.pluginId + '-styles]')) return;

    var css = `
      /* Идеальная вертикальная и горизонтальная центровка бейджей */
      .torrent-item__seeds > span,
      .torrent-item__bitrate > span,
      .torrent-item__grabs > span,
      .torrent-item__size {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        height: 1.8em !important;
        padding: 0 0.55em !important;
        border-radius: 0.45em !important;
        font-weight: 700 !important;
        font-size: 0.85em !important;
        line-height: 1 !important;
        text-align: center !important;
        white-space: nowrap !important;
        font-variant-numeric: tabular-nums !important;
        background: rgba(15, 15, 20, 0.65) !important;
        backdrop-filter: blur(4px) !important;
        transition: all 0.2s ease !important;
      }

      .torrent-item__bitrate, 
      .torrent-item__grabs, 
      .torrent-item__seeds {
        margin-right: 0.5em !important;
        display: inline-flex !important;
        align-items: center !important;
      }

      /* Мягкий неон на значениях (Soft Glow UI) */
      /* SEEDS */
      .ts-seeds { color: ${COLOR.orange} !important; border: 1px solid rgba(255, 159, 10, 0.6) !important; box-shadow: 0 0 6px rgba(255, 159, 10, 0.25) !important; }
      .ts-seeds.low-seeds { color: ${COLOR.red} !important; border-color: rgba(255, 69, 58, 0.6) !important; box-shadow: 0 0 6px rgba(255, 69, 58, 0.25) !important; }
      .ts-seeds.good-seeds { color: ${COLOR.yellow} !important; border-color: rgba(255, 214, 10, 0.6) !important; box-shadow: 0 0 6px rgba(255, 214, 10, 0.25) !important; }
      .ts-seeds.high-seeds { color: ${COLOR.green} !important; border-color: rgba(48, 209, 88, 0.6) !important; box-shadow: 0 0 8px rgba(48, 209, 88, 0.3) !important; }

      /* PEERS / GRABS */
      .ts-grabs { color: ${COLOR.blue} !important; border: 1px solid rgba(10, 132, 255, 0.5) !important; box-shadow: 0 0 5px rgba(10, 132, 255, 0.2) !important; }
      .ts-grabs.high-grabs { color: ${COLOR.cyan} !important; border-color: rgba(100, 210, 255, 0.6) !important; box-shadow: 0 0 8px rgba(100, 210, 255, 0.3) !important; }

      /* BITRATE */
      .ts-bitrate { color: ${COLOR.green} !important; border: 1px solid rgba(48, 209, 88, 0.5) !important; box-shadow: 0 0 5px rgba(48, 209, 88, 0.2) !important; }
      .ts-bitrate.high-bitrate { color: ${COLOR.yellow} !important; border-color: rgba(255, 214, 10, 0.6) !important; box-shadow: 0 0 6px rgba(255, 214, 10, 0.25) !important; }
      .ts-bitrate.mid-bitrate { color: ${COLOR.orange} !important; border-color: rgba(255, 159, 10, 0.6) !important; box-shadow: 0 0 6px rgba(255, 159, 10, 0.25) !important; }
      .ts-bitrate.very-high-bitrate { color: ${COLOR.red} !important; border-color: rgba(255, 69, 58, 0.6) !important; box-shadow: 0 0 8px rgba(255, 69, 58, 0.3) !important; }

      /* SIZE */
      .ts-size { color: ${COLOR.green} !important; border: 1px solid rgba(48, 209, 88, 0.5) !important; box-shadow: 0 0 5px rgba(48, 209, 88, 0.2) !important; }
      .ts-size.mid-size { color: ${COLOR.yellow} !important; border-color: rgba(255, 214, 10, 0.6) !important; box-shadow: 0 0 6px rgba(255, 214, 10, 0.25) !important; }
      .ts-size.high-size { color: ${COLOR.orange} !important; border-color: rgba(255, 159, 10, 0.6) !important; box-shadow: 0 0 6px rgba(255, 159, 10, 0.25) !important; }
      .ts-size.top-size { color: ${COLOR.red} !important; border-color: rgba(255, 69, 58, 0.6) !important; box-shadow: 0 0 8px rgba(255, 69, 58, 0.3) !important; }
    `;

    var style = document.createElement('style');
    style.setAttribute('data-' + CONFIG.pluginId + '-styles', 'true');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // --- Logic Helpers ---
  function parseNum(text) {
    var m = String(text || '').match(/(\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(',', '.')) || 0 : 0;
  }

  function parseSizeGb(text) {
    var t = String(text || '').replace(/\u00A0/g, ' ').trim();
    var m = t.match(/(\d+(?:[.,]\d+)?)\s*(kb|mb|gb|tb|кб|мб|гб|тб)/i);
    if (!m) return null;

    var num = parseFloat(m[1].replace(',', '.')) || 0;
    var unit = m[2].toLowerCase();

    if (unit === 'tb' || unit === 'тб') return num * 1024;
    if (unit === 'gb' || unit === 'гб') return num;
    if (unit === 'mb' || unit === 'мб') return num / 1024;
    if (unit === 'kb' || unit === 'кб') return num / (1024 * 1024);
    return 0;
  }

  function setTier(el, prefix, tier) {
    el.className = el.className.replace(new RegExp('\\b(' + prefix + '-\\S+)\\b', 'g'), '').trim();
    el.classList.add('ts-' + prefix);
    if (tier) el.classList.add(tier);
  }

  // --- Updating Elements ---
  function updateStyles(root) {
    var scope = root && root.querySelectorAll ? root : document;

    // Seeds
    scope.querySelectorAll('.torrent-item__seeds span').forEach(function (el) {
      var val = parseNum(el.textContent);
      var tier = val < TH.seeds.low ? 'low-seeds' : (val >= TH.seeds.high ? 'high-seeds' : (val >= TH.seeds.good ? 'good-seeds' : ''));
      setTier(el, 'seeds', tier);
    });

    // Bitrate
    scope.querySelectorAll('.torrent-item__bitrate span').forEach(function (el) {
      var val = parseNum(el.textContent);
      var tier = val > TH.bitrate.danger ? 'very-high-bitrate' : (val >= TH.bitrate.orange ? 'mid-bitrate' : (val >= TH.bitrate.warn ? 'high-bitrate' : ''));
      setTier(el, 'bitrate', tier);
    });

    // Grabs / Peers
    scope.querySelectorAll('.torrent-item__grabs span').forEach(function (el) {
      var val = parseNum(el.textContent);
      setTier(el, 'grabs', val > TH.peers_high ? 'high-grabs' : '');
    });

    // Size
    scope.querySelectorAll('.torrent-item__size').forEach(function (el) {
      var gb = parseSizeGb(el.textContent);
      var tier = gb === null ? '' : (gb > TH.size_gb.top ? 'top-size' : (gb >= TH.size_gb.high ? 'high-size' : (gb >= TH.size_gb.mid ? 'mid-size' : '')));
      setTier(el, 'size', tier);
    });
  }

  // --- Init & Event Hooks ---
  function onAppReady() {
    attachParserBlock();
    if (!isBlockedHost()) {
      if (typeof Lampa !== 'undefined' && Lampa.Listener) {
        Lampa.Listener.follow('torrent', function (e) {
          if (e && e.type === 'render') {
            var node = e.item || e.element;
            if (node && node.nodeType === 1) updateStyles(node);
            else if (node && node[0]) updateStyles(node[0]);
          }
        });
      }
      setTimeout(updateStyles, 200);
    }
    
    if (typeof Lampa !== 'undefined' && Lampa.Manifest) {
      Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
      Lampa.Manifest.plugins[CONFIG.pluginId] = {
        type: 'other',
        name: CONFIG.name,
        version: CONFIG.version,
        description: 'Оптимизированные стили бейджей для торрентов.'
      };
    }
  }

  function init() {
    if (isBlockedHost()) {
      attachParserBlock();
    } else {
      injectStyles();
    }

    if (window.appready) {
      onAppReady();
    } else if (typeof Lampa !== 'undefined' && Lampa.Listener) {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') onAppReady();
      });
    } else {
      setTimeout(onAppReady, 500);
    }
  }

  init();
})();
