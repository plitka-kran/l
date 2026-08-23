(function() {
  'use strict';

  if (window.__torrent_neon_loaded) return;
  window.__torrent_neon_loaded = true;

  // ===== CONFIG =====
  const CFG = {
    id: 'torrent_neon',
    name: 'Torrent Neon',
    version: '2.0'
  };

  // Неоновые цвета (светлая тема)
  const NEON = {
    green: '#00ff88',
    blue: '#00d4ff',
    yellow: '#ffe600',
    orange: '#ff8800',
    red: '#ff0055',
    pink: '#ff00aa',
    purple: '#aa00ff',
    white: '#ffffff'
  };

  // Пороги
  const TH = {
    seeds: { low: 5, good: 10, top: 20 },
    bitrate: { warn: 50, orange: 75, danger: 100 },
    size: { mid: 50, high: 100, top: 200 },
    peers: { high: 10 }
  };

  // ===== HELPERS =====
  const $ = (s, ctx) => (ctx || document).querySelectorAll(s);
  const num = t => parseFloat((t+'').replace(/[^0-9.,]/g,'').replace(',','.')) || 0;
  const int = t => parseInt((t+'').replace(/\D/g,'')) || 0;

  // Glow-стиль
  function glow(color, bg = 0.15) {
    const [r,g,b] = color.match(/\w\w/g).map(x => parseInt(x,16));
    return {
      color: color,
      'text-shadow': `0 0 12px ${color}, 0 0 24px ${color}40`,
      'background': `rgba(${r},${g},${b},${bg})`,
      'border': `1px solid ${color}80`,
      'box-shadow': `0 0 20px ${color}30, inset 0 0 20px ${color}20`
    };
  }

  // ===== СТИЛИ =====
  const styles = {
    '.torrent-item': {
      'transition': 'transform 0.2s ease, filter 0.2s ease'
    },
    '.torrent-item.selector.focus': {
      'transform': 'scale(1.03)',
      'filter': 'brightness(1.1)',
      'z-index': '2'
    },
    '.torrent-item .ts-badge': {
      'display': 'inline-flex',
      'align-items': 'center',
      'padding': '0.1em 0.5em',
      'border-radius': '0.5em',
      'font-weight': '700',
      'font-size': '0.85em',
      'line-height': '1.4',
      'margin-right': '0.4em'
    },
    '.torrent-item .ts-seeds': {
      ...glow(NEON.green)
    },
    '.torrent-item .ts-seeds.low': {
      ...glow(NEON.red)
    },
    '.torrent-item .ts-seeds.good': {
      ...glow(NEON.yellow)
    },
    '.torrent-item .ts-seeds.high': {
      ...glow(NEON.green, 0.25)
    },
    '.torrent-item .ts-grabs': {
      ...glow(NEON.blue, 0.12)
    },
    '.torrent-item .ts-grabs.high': {
      ...glow(NEON.blue, 0.25)
    },
    '.torrent-item .ts-bitrate': {
      ...glow(NEON.green, 0.12)
    },
    '.torrent-item .ts-bitrate.high': {
      ...glow(NEON.yellow, 0.15)
    },
    '.torrent-item .ts-bitrate.mid': {
      ...glow(NEON.orange, 0.18)
    },
    '.torrent-item .ts-bitrate.danger': {
      ...glow(NEON.red, 0.2)
    },
    '.torrent-item .ts-size': {
      ...glow(NEON.green, 0.12)
    },
    '.torrent-item .ts-size.mid': {
      ...glow(NEON.yellow, 0.15)
    },
    '.torrent-item .ts-size.high': {
      ...glow(NEON.orange, 0.18)
    },
    '.torrent-item .ts-size.top': {
      ...glow(NEON.red, 0.2)
    }
  };

  // ===== INJECT STYLES =====
  function injectStyles() {
    const existing = document.querySelector(`[data-${CFG.id}]`);
    if (existing) return;

    const style = document.createElement('style');
    style.setAttribute(`data-${CFG.id}`, 'true');
    style.textContent = Object.entries(styles)
      .map(([sel, props]) => `${sel} { ${Object.entries(props).map(([k,v]) => `${k}:${v}`).join(';')} }`)
      .join('\n');
    document.head.appendChild(style);
  }

  // ===== TIERS =====
  function seedTier(v) {
    if (v < TH.seeds.low) return 'low';
    if (v >= TH.seeds.top) return 'high';
    if (v >= TH.seeds.good) return 'good';
    return '';
  }

  function bitrateTier(v) {
    if (v > TH.bitrate.danger) return 'danger';
    if (v >= TH.bitrate.orange) return 'mid';
    if (v >= TH.bitrate.warn) return 'high';
    return '';
  }

  function sizeTier(gb) {
    if (gb > TH.size.top) return 'top';
    if (gb >= TH.size.high) return 'high';
    if (gb >= TH.size.mid) return 'mid';
    return '';
  }

  function apply(el, cls, tier) {
    el.className = el.className.split(' ').filter(c => !c.startsWith(cls+'-')).join(' ');
    if (tier) el.classList.add(`${cls}-${tier}`);
  }

  // ===== UPDATE =====
  function update(root) {
    const ctx = root?.nodeType === 1 ? root : document;

    ctx.querySelectorAll('.torrent-item__seeds span').forEach(el => {
      if (!/\d/.test(el.textContent)) return;
      el.classList.add('ts-badge', 'ts-seeds');
      apply(el, 'ts-seeds', seedTier(int(el.textContent)));
    });

    ctx.querySelectorAll('.torrent-item__bitrate span').forEach(el => {
      if (!/\d/.test(el.textContent)) return;
      el.classList.add('ts-badge', 'ts-bitrate');
      apply(el, 'ts-bitrate', bitrateTier(num(el.textContent)));
    });

    ctx.querySelectorAll('.torrent-item__grabs span').forEach(el => {
      if (!/\d/.test(el.textContent)) return;
      el.classList.add('ts-badge', 'ts-grabs');
      apply(el, 'ts-grabs', int(el.textContent) > TH.peers.high ? 'high' : '');
    });

    ctx.querySelectorAll('.torrent-item__size').forEach(el => {
      el.classList.add('ts-badge', 'ts-size');
      const gb = (() => {
        const t = el.textContent.toLowerCase();
        const m = t.match(/([\d.]+)\s*(kb|mb|gb|tb|кб|мб|гб|тб)/);
        if (!m) return null;
        const v = parseFloat(m[1]);
        const u = m[2];
        if (u.startsWith('tb') || u.startsWith('тб')) return v * 1024;
        if (u.startsWith('gb') || u.startsWith('гб')) return v;
        if (u.startsWith('mb') || u.startsWith('мб')) return v / 1024;
        if (u.startsWith('kb') || u.startsWith('кб')) return v / 1048576;
        return null;
      })();
      apply(el, 'ts-size', gb !== null ? sizeTier(gb) : '');
    });
  }

  // ===== HOOKS =====
  let timer;
  function schedule(delay = 60) {
    clearTimeout(timer);
    timer = setTimeout(() => update(), delay);
  }

  function hookTorrentRender() {
    if (typeof Lampa?.Listener?.follow !== 'function') return;
    Lampa.Listener.follow('torrent', e => {
      if (e?.type === 'render') {
        const el = e.element?.nodeType === 1 ? e.element : e.element?.[0];
        if (el) update(el);
      }
    });
    schedule(200);
  }

  // ===== BLOCK BYLAMPA =====
  function blockBylampa() {
    const host = (location.hostname || '').toLowerCase().replace(/:\d+$/, '');
    if (!/(^|\.)bylampa\.online$/i.test(host)) return;

    const block = (fn, idx) => {
      const orig = Lampa.Parser?.[fn];
      if (!orig) return;
      Lampa.Parser[fn] = function(...args) {
        const cb = typeof args[idx] === 'function' ? args[idx] : args[args.length-2];
        try { cb?.({ Results: [] }); } catch(e) {}
      };
    };

    block('get', 1);
    block('jackett', 4);
  }

  // ===== INIT =====
  function init() {
    injectStyles();

    if (typeof Lampa?.Listener?.follow === 'function') {
      Lampa.Listener.follow('app', e => {
        if (e?.type === 'ready') {
          blockBylampa();
          hookTorrentRender();
        }
      });
    }

    // fallback
    setTimeout(() => {
      if (!window.appready) {
        blockBylampa();
        hookTorrentRender();
      }
    }, 500);

    // Регистрация
    if (typeof Lampa?.Manifest?.plugins === 'object') {
      Lampa.Manifest.plugins[CFG.id] = {
        type: 'other',
        name: CFG.name,
        version: CFG.version,
        description: 'Неоновые стили для торрентов'
      };
    }

    console.log(`${CFG.name} v${CFG.version} loaded`);
  }

  init();
})();
