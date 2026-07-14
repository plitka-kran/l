!function() {
    "use strict';
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    const CONFIG = {
        API_URL: 'https://api.introdb.app',
        THEINTRODB_URL: 'https://api.theintrodb.org/v2/media',
        CACHE_TTL: 3 * 24 * 60 * 60 * 1000, // 3 дня кэша
        TIMEOUT: 3000
    };

    // Простой кэш в памяти и Storage
    const Cache = {
        get(tmdbId, s, e) {
            try {
                const raw = Lampa.Storage.get('skip_intro_cache', '{}');
                const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const entry = data[`${tmdbId}_s${s}_e${e}`];
                if (entry && Date.now() - entry._ts < CONFIG.CACHE_TTL) return entry.segments;
            } catch(e) {}
            return null;
        },
        set(tmdbId, s, e, segments) {
            try {
                const raw = Lampa.Storage.get('skip_intro_cache', '{}');
                const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                data[`${tmdbId}_s${s}_e${e}`] = { segments, _ts: Date.now() };
                Lampa.Storage.set('skip_intro_cache', JSON.stringify(data));
            } catch(e) {}
        }
    };

    // Всплывашка-уведомление
    const Notification = {
        _el: null,
        show(text) {
            this.hide();
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;top:40px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:10px 25px;border-radius:6px;font-size:16px;z-index:99999;border:1px solid rgba(255,255,255,0.2);box-shadow:0 5px 15px rgba(0,0,0,0.5);font-family:sans-serif;pointer-events:none;';
            el.innerHTML = `⏭ ${text}`;
            document.body.appendChild(el);
            this._el = el;
            setTimeout(() => this.hide(), 2500);
        },
        hide() {
            if (this._el) {
                this._el.parentNode?.removeChild(this._el);
                this._el = null;
            }
        }
    };

    // Запросы к базам данных
    const Api = {
        _req(url) {
            return new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.timeout = CONFIG.TIMEOUT;
                xhr.onload = () => {
                    try { resolve(xhr.status === 200 ? JSON.parse(xhr.responseText) : null); } catch(e) { resolve(null); }
                };
                xhr.onerror = () => resolve(null);
                xhr.send();
            });
        },

        async load(tmdbId, s, e) {
            const cached = Cache.get(tmdbId, s, e);
            if (cached) return cached;

            // 1. Пробуем TheIntroDB
            try {
                const data = await this._req(`${CONFIG.THEINTRODB_URL}?tmdb_id=${tmdbId}&season=${s}&episode=${e}`);
                if (data) {
                    const segments = [];
                    ['intro', 'recap', 'credits'].forEach(type => {
                        if (Array.isArray(data[type])) {
                            data[type].forEach(item => {
                                const start = item.start_ms ? item.start_ms / 1000 : (item.start || 0);
                                const end = item.end_ms ? item.end_ms / 1000 : (item.end || 0);
                                if (end > start) segments.push({ type, start: Math.round(start), end: Math.round(end) });
                            });
                        }
                    });
                    if (segments.length) { Cache.set(tmdbId, s, e, segments); return segments; }
                }
            } catch(e) {}

            // 2. Пробуем альтернативный API
            try {
                const [intro, credits] = await Promise.all([
                    this._req(`${CONFIG.API_URL}/get_intros?tmdb=${tmdbId}&season=${s}&episode=${e}`),
                    this._req(`${CONFIG.API_URL}/get_credits?tmdb=${tmdbId}&season=${s}&episode=${e}`)
                ]);
                const segments = [];
                if (intro?.start && intro?.end) segments.push({ type: 'intro', start: Math.round(intro.start), end: Math.round(intro.end) });
                if (credits?.start && credits?.end) segments.push({ type: 'credits', start: Math.round(credits.start), end: Math.round(credits.end) });
                
                if (segments.length) { Cache.set(tmdbId, s, e, segments); return segments; }
            } catch(e) {}

            return [];
        }
    };

    const Plugin = {
        _segments: [],
        _lastSkipped: null,
        _checkTimer: null,

        init() {
            // Подписываемся на события Lampa Player
            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());
        },

        async _onStart(data) {
            this._cleanup();

            const meta = this._extractMeta(data);
            if (!meta.tmdb_id || meta.season == null || meta.episode == null) return;

            // Грузим чистые данные из API
            this._segments = await Api.load(meta.tmdb_id, meta.season, meta.episode);
            
            if (this._segments.length > 0) {
                console.log('[SkipIntro] Загружено сегментов:', this._segments.length);
                this._startTracking();
            }
        },

        // Запуск неубиваемого таймера отслеживания времени
        _startTracking() {
            if (this._checkTimer) clearInterval(this._checkTimer);
            
            this._checkTimer = setInterval(() => {
                try {
                    // Самый надежный способ забрать текущее время в Lampa на любых ТВ
                    const video = Lampa.Player.video || (Lampa.PlayerVideo && Lampa.PlayerVideo.video());
                    if (!video) return;

                    const cur = video.currentTime;
                    if (typeof cur !== 'number' || isNaN(cur)) return;

                    // Ищем, попадаем ли мы в заставку/рекап/титры
                    const active = this._segments.find(s => cur >= s.start && cur < (s.end - 1));
                    if (active && this._lastSkipped !== active) {
                        this._skip(video, active);
                    }
                } catch(e) {}
            }, 500); // Проверяем 2 раза в секунду
        },

        _skip(video, seg) {
            this._lastSkipped = seg;
            
            const names = { intro: 'Заставка', recap: 'Рекап', credits: 'Титры' };
            Notification.show(`${names[seg.type] || 'Фрагмент'} пропущен`);

            try {
                // Перематываем
                video.currentTime = seg.end;
                console.log(`[SkipIntro] Перемотано на ${seg.end}s`);
            } catch(e) {
                console.log('[SkipIntro] Ошибка перемотки:', e);
            }
        },

        _extractMeta(data) {
            const meta = { tmdb_id: data.tmdb_id, season: null, episode: null };
            
            if (data.season != null) meta.season = parseInt(data.season);
            if (data.episode != null) meta.episode = parseInt(data.episode);

            if (data.playlist && Array.isArray(data.playlist)) {
                const item = data.playlist.find(i => i.url === data.url) || data.playlist[0];
                if (item) {
                    meta.season = parseInt(item.season || item.s || item.season_num || meta.season);
                    meta.episode = parseInt(item.episode || item.e || item.episode_num || meta.episode);
                }
            }
            if (!meta.tmdb_id) {
                try { meta.tmdb_id = Lampa.Activity.active()?.card?.id || Lampa.Storage.get('current', null)?.id; } catch(e) {}
            }
            return meta;
        },

        _cleanup() {
            if (this._checkTimer) {
                clearInterval(this._checkTimer);
                this._checkTimer = null;
            }
            this._segments = [];
            this._lastSkipped = null;
            Notification.hide();
        },

        _onDestroy() {
            this._cleanup();
        }
    };

    function init() {
        if (window.Lampa && Lampa.Player && Lampa.Storage) {
            Plugin.init();
        } else {
            setTimeout(init, 500);
        }
    }

    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', (data) => { if (data.type === 'ready') init(); });
    }
    setTimeout(init, 1000);
}();
