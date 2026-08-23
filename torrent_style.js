(function () {
  'use strict';

  if (window.__torrent_styles_mod_loaded) return;
  window.__torrent_styles_mod_loaded = true;

  var CONFIG = {
    pluginId: 'torrent_styles_neon',
    name: 'Torrent Neon Styles',
    version: '2.0'
  };

  // Неоновая палитра (Apple / Cyberpunk Glow)
  var NEON = {
    red: '#FF3B30',
    orange: '#FF9500',
    yellow: '#FFCC00',
    green: '#30D158',
    blue: '#0A84FF',
    cyan: '#5E5CE6'
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

  // --- Neon CSS Injection ---
  function injectStyles() {
    if (document.querySelector('[data-' + CONFIG.pluginId + '-styles]')) return;

    var css = `
      /* Общие стили неон-бейджей */
      .torrent-item__seeds > span,
      .torrent-item__bitrate > span,
      .torrent-item__grabs > span,
      .torrent-item__size {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        min-height: 1.6em !important;
        padding: 0.15em 0.5em !important;
        border-radius: 0.4em !important;
        font-weight: 800 !important;
        font-size: 0.85em !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        font-variant-numeric: tabular-nums !important;
        background: rgba(0, 0, 0, 0.4) !important;
        transition: all 0.2s ease !important;
      }

      .torrent-item__bitrate, 
      .torrent-item__grabs, 
      .torrent-item__seeds {
        margin-right: 0.5em !important;
      }

      /* Функция генерации неона: цвет, граница, подсвечивание текста и фоновая тень */
      /* SEEDS */
      .ts-seeds { color: ${NEON.orange} !important; border: 1px solid ${NEON.orange} !important; box-shadow: 0 0 8px ${NEON.orange}, inset 0 0 4px ${NEON.orange} !important; text-shadow: 0 0 4px ${NEON.orange} !important; }
      .ts-seeds.low-seeds { color: ${NEON.red} !important; border-color: ${NEON.red} !important; box-shadow: 0 0 8px ${NEON.red}, inset 0 0 4px ${NEON.red} !important; text-shadow: 0 0 4px ${NEON.red} !important; }
      .ts-seeds.good-seeds { color: ${NEON.yellow} !important; border-color: ${NEON.yellow} !important; box-shadow: 0 0 8px ${NEON.yellow}, inset 0 0 4px ${NEON.yellow} !important; text-shadow: 0 0 4px ${NEON.yellow} !important; }
      .ts-seeds.high-seeds { color: ${NEON.green} !important; border-color: ${NEON.green} !important; box-shadow: 0 0 10px ${NEON.green}, inset 0 0 5px ${NEON.green} !important; text-shadow: 0 0 5px ${NEON.green} !important; }

      /* PEERS / GRABS */
      .ts-grabs { color: ${NEON.blue} !important; border: 1px solid ${NEON.blue} !important; box-shadow: 0 0 6px ${NEON.blue} !important; }
      .ts-grabs.high-grabs { color: ${NEON.cyan} !important; border-color: ${NEON.cyan} !important; box-shadow: 0 0 10px ${NEON.cyan}, inset 0 0 4px ${NEON.cyan} !important; text-shadow: 0 0 4px ${NEON.cyan} !important; }

      /* BITRATE */
      .ts-bitrate { color: ${NEON.green} !important; border: 1px solid ${NEON.green} !important; box-shadow: 0 0 6px ${NEON.green} !important; }
      .ts-bitrate.high-bitrate { color: ${NEON.yellow} !important; border-color: ${NEON.yellow} !important; box-shadow: 0 0 8px ${NEON.yellow} !important; }
      .ts-bitrate.mid-bitrate { color: ${NEON.orange} !important; border-color: ${NEON.orange} !important; box-shadow: 0 0 8px ${NEON.orange} !important; }
      .ts-bitrate.very-high-bitrate { color: ${NEON.red} !important; border-color: ${NEON.red} !important; box-shadow: 0 0 10px ${NEON.red}, inset 0 0 4px ${NEON.red} !important; }

      /* SIZE */
      .ts-size { color: ${NEON.green} !important; border: 1px solid ${NEON.green} !important; box-shadow: 0 0 6px ${NEON.green} !important; }
      .ts-size.mid-size { color: ${NEON.yellow} !important; border-color: ${NEON.yellow} !important; box-shadow: 0 0 8px ${NEON.yellow} !important; }
      .ts-size.high-size { color: ${NEON.orange} !important; border-color: ${NEON.orange} !important; box-shadow: 0 0 8px ${NEON.orange} !important; }
      .ts-size.top-size { color: ${NEON.red} !important; border-color: ${NEON.red} !important; box-shadow: 0 0 10px ${NEON.red}, inset 0 0 4px ${NEON.red} !important; }

      /* Неоновый фокус карточки */
      .torrent-item {
        transition: transform 0.25s ease, filter 0.25s ease !important;
      }
      .torrent-item.selector.focus {
        outline: none !important;
        transform: scale(1.02) !important;
        z-index: 2 !important;
      }
      .torrent-item.focus::after {
        content: '' !important;
        position: absolute !important;
        inset: -2px !important;
        border-radius: 0.8em !important;
        border: 2px solid ${NEON.cyan} !important;
        box-shadow: 0 0 12px ${NEON.cyan}, inset 0 0 6px ${NEON.cyan} !important;
        pointer-events: none !important;
      }
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
        description: 'Неоновые стили для карточек торрентов.'
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
