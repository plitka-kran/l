(function() {
  'use strict';

  if (window.__torrent_neon_loaded) return;
  window.__torrent_neon_loaded = true;

  // ===== CONFIG =====
  const CFG = {
    id: 'torrent_neon',
    name: 'Torrent Neon',
    version: '2.1'
  };

  // Неоновые цвета
  const NEON = {
    green: '#00ff88',
    blue: '#00d4ff',
    yellow: '#ffe600',
    orange: '#ff8800',
    red: '#ff0055'
  };

  // Пороги
  const TH = {
    seeds: { low: 5, good: 10, top: 20 },
    bitrate: { warn: 50, orange: 75, danger: 100 },
    size: { mid: 50, high: 100, top: 200 },
    peers: { high: 10 }
  };

  // ===== HELPERS =====
  function getNum(text) {
    const t = String(text || '').replace(/[^0-9.,]/g, '').replace(',', '.');
    return parseFloat(t) || 0;
  }

  function getInt(text) {
    const t = String(text || '').replace(/\D/g, '');
    return parseInt(t) || 0;
  }

  function glowStyle(color, opacity = 0.15) {
    const r = parseInt(color.slice(1,3), 16);
    const g = parseInt(color.slice(3,5), 16);
    const b = parseInt(color.slice(5,7), 16);
    return {
      color: color,
      'text-shadow': `0 0 10px ${color}, 0 0 20px ${color}66`,
      'background': `rgba(${r},${g},${b},${opacity})`,
      'border': `1px solid ${color}99`,
      'box-shadow': `0 0 15px ${color}44, inset 0 0 15px ${color}22`,
      'border-radius': '6px',
      'padding': '2px 10px',
      'font-weight': '700',
      'font-size': '0.85em',
      'display': 'inline-flex',
      'align-items': 'center',
      'margin-right': '6px',
      'transition': 'all 0.2s ease'
    };
  }

  // ===== CSS СТИЛИ =====
  function getStyles() {
    const base = {
      'display': 'inline-flex',
      'align-items': 'center',
      'padding': '2px 10px',
      'border-radius': '6px',
      'font-weight': '700',
      'font-size': '0.85em',
      'margin-right': '6px',
      'transition': 'all 0.2s ease'
    };

    return {
      // Бейджи
      '.torrent-item .ts-badge': base,
      
      // Seeds
      '.torrent-item .ts-seeds': glowStyle(NEON.green),
      '.torrent-item .ts-seeds.low': glowStyle(NEON.red, 0.2),
      '.torrent-item .ts-seeds.good': glowStyle(NEON.yellow, 0.18),
      '.torrent-item .ts-seeds.high': glowStyle(NEON.green, 0.25),
      
      // Grabs (пиры)
      '.torrent-item .ts-grabs': glowStyle(NEON.blue, 0.12),
      '.torrent-item .ts-grabs.high': glowStyle(NEON.blue, 0.25),
      
      // Bitrate
      '.torrent-item .ts-bitrate': glowStyle(NEON.green, 0.12),
      '.torrent-item .ts-bitrate.high': glowStyle(NEON.yellow, 0.18),
      '.torrent-item .ts-bitrate.mid': glowStyle(NEON.orange, 0.2),
      '.torrent-item .ts-bitrate.danger': glowStyle(NEON.red, 0.25),
      
      // Size
      '.torrent-item .ts-size': glowStyle(NEON.green, 0.12),
      '.torrent-item .ts-size.mid': glowStyle(NEON.yellow, 0.18),
      '.torrent-item .ts-size.high': glowStyle(NEON.orange, 0.2),
      '.torrent-item .ts-size.top': glowStyle(NEON.red, 0.25),
      
      // Фокус
      '.torrent-item.selector.focus': {
        'transform': 'scale(1.03)',
        'filter': 'brightness(1.15) drop-shadow(0 0 20px rgba(0,255,136,0.3))',
        'z-index': '10',
        'transition': 'all 0.2s ease'
      }
    };
  }

  // ===== INJECT STYLES =====
  function injectStyles() {
    const existing = document.querySelector(`[data-${CFG.id}]`);
    if (existing) return;

    const style = document.createElement('style');
    style.setAttribute(`data-${CFG.id}`, 'true');
    
    const styles = getStyles();
    let css = '';
    for (const [selector, props] of Object.entries(styles)) {
      css += selector + ' { ';
      for (const [key, value] of Object.entries(props)) {
        css += key + ': ' + value + ' !important; ';
      }
      css += '}\n';
    }
    
    style.textContent = css;
    document.head.appendChild(style);
    console.log(CFG.name, 'styles injected');
  }

  // ===== TIERS =====
  function getSeedTier(v) {
    if (v < TH.seeds.low) return 'low';
    if (v >= TH.seeds.top) return 'high';
    if (v >= TH.seeds.good) return 'good';
    return '';
  }

  function getBitrateTier(v) {
    if (v > TH.bitrate.danger) return 'danger';
    if (v >= TH.bitrate.orange) return 'mid';
    if (v >= TH.bitrate.warn) return 'high';
    return '';
  }

  function getSizeTier(gb) {
    if (gb > TH.size.top) return 'top';
    if (gb >= TH.size.high) return 'high';
    if (gb >= TH.size.mid) return 'mid';
    return '';
  }

  function applyTier(el, baseClass, tier) {
    // Удаляем все классы этого типа
    const classes = el.className.split(' ');
    const filtered = classes.filter(c => !c.startsWith(baseClass + '-'));
    el.className = filtered.join(' ');
    
    // Добавляем базовый класс
    el.classList.add(baseClass);
    el.classList.add('ts-badge');
    
    // Добавляем tier если есть
    if (tier) {
      el.classList.add(baseClass + '-' + tier);
    }
  }

  // ===== UPDATE TORRENTS =====
  function updateTorrents(context) {
    const ctx = context || document;
    
    // Seeds
    ctx.querySelectorAll('.torrent-item__seeds span').forEach(el => {
      if (!/\d/.test(el.textContent)) return;
      const val = getInt(el.textContent);
      applyTier(el, 'ts-seeds', getSeedTier(val));
    });

    // Bitrate
    ctx.querySelectorAll('.torrent-item__bitrate span').forEach(el => {
      if (!/\d/.test(el.textContent)) return;
      const val = getNum(el.textContent);
      applyTier(el, 'ts-bitrate', getBitrateTier(val));
    });

    // Grabs
    ctx.querySelectorAll('.torrent-item__grabs span').forEach(el => {
      if (!/\d/.test(el.textContent)) return;
      const val = getInt(el.textContent);
      applyTier(el, 'ts-grabs', val > TH.peers.high ? 'high' : '');
    });

    // Size
    ctx.querySelectorAll('.torrent-item__size').forEach(el => {
      const text = el.textContent || '';
      const match = text.toLowerCase().match(/([\d.]+)\s*(kb|mb|gb|tb|кб|мб|гб|тб)/);
      
      let gb = null;
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2];
        if (unit.startsWith('tb') || unit.startsWith('тб')) gb = val * 1024;
        else if (unit.startsWith('gb') || unit.startsWith('гб')) gb = val;
        else if (unit.startsWith('mb') || unit.startsWith('мб')) gb = val / 1024;
        else if (unit.startsWith('kb') || unit.startsWith('кб')) gb = val / 1048576;
      }
      
      applyTier(el, 'ts-size', gb !== null ? getSizeTier(gb) : '');
    });
  }

  // ===== OBSERVER ДЛЯ НОВЫХ ЭЛЕМЕНТОВ =====
  let observer = null;
  
  function startObserver() {
    if (observer) return;
    
    observer = new MutationObserver(mutations => {
      let needsUpdate = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          needsUpdate = true;
          break;
        }
      }
      if (needsUpdate) {
        setTimeout(() => updateTorrents(), 50);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ===== HOOK TORRENT RENDER =====
  function hookTorrentRender() {
    if (typeof Lampa === 'undefined' || !Lampa.Listener) return;
    
    if (typeof Lampa.Listener.follow === 'function') {
      Lampa.Listener.follow('torrent', function(e) {
        if (e && e.type === 'render') {
          let el = e.element;
          if (el && el.nodeType !== 1 && el[0]) {
            el = el[0];
          }
          if (el && el.nodeType === 1) {
            setTimeout(() => updateTorrents(el), 10);
          }
        }
      });
    }
  }

  // ===== BLOCK BYLAMPA =====
  function blockBylampa() {
    const host = (window.location.hostname || '').toLowerCase().replace(/:\d+$/, '');
    if (!/(^|\.)bylampa\.online$/i.test(host)) return false;
    
    console.log(CFG.name, 'blocking Bylampa');
    
    if (Lampa && Lampa.Parser) {
      ['get', 'jackett'].forEach(method => {
        const orig = Lampa.Parser[method];
        if (typeof orig === 'function') {
          Lampa.Parser[method] = function(...args) {
            const cb = typeof args[1] === 'function' ? args[1] : 
                      typeof args[4] === 'function' ? args[4] : 
                      args[args.length - 2];
            if (typeof cb === 'function') {
              try { cb({ Results: [] }); } catch(e) {}
            }
          };
        }
      });
    }
    return true;
  }

  // ===== MAIN =====
  function init() {
    // Ждём DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    // Инжектим стили
    injectStyles();
    
    // Блокируем Bylampa если нужно
    const isBlocked = blockBylampa();
    
    // Обновляем существующие торренты
    setTimeout(() => {
      updateTorrents();
      console.log(CFG.name, 'initial update done');
    }, 300);
    
    // Повторное обновление через секунду (для динамической загрузки)
    setTimeout(() => updateTorrents(), 1000);
    setTimeout(() => updateTorrents(), 2000);
    
    // Наблюдатель за новыми элементами
    startObserver();
    
    // Хук на рендер торрентов
    hookTorrentRender();
    
    // Хук на готовность приложения
    if (typeof Lampa !== 'undefined' && Lampa.Listener && 
        typeof Lampa.Listener.follow === 'function') {
      Lampa.Listener.follow('app', function(e) {
        if (e && e.type === 'ready') {
          setTimeout(() => updateTorrents(), 100);
        }
      });
    }
    
    // Регистрация плагина
    if (typeof Lampa !== 'undefined' && Lampa.Manifest) {
      Lampa.Manifest.plugins = Lampa.Manifest.plugins || {};
      Lampa.Manifest.plugins[CFG.id] = {
        type: 'other',
        name: CFG.name,
        version: CFG.version,
        description: 'Неоновые стили для торрентов'
      };
    }
    
    console.log(CFG.name, 'v' + CFG.version, 'loaded', isBlocked ? '(blocked)' : '');
  }

  // Запуск
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
