!function() {
    "use strict";
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    // ===== КОНФИГУРАЦИЯ =====
    const CONFIG = {
        API_URL: 'https://api.introdb.app',
        THEINTRODB_URL: 'https://api.theintrodb.org/v2/media',
        CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
        DETECTION_TIMEOUT: 5000,
        NOTIFICATION_DURATION: 3000
    };

    // ===== УТИЛИТЫ =====
    const Utils = {
        _storageCache: {},
        
        getStorage(key, def) {
            try {
                if (this._storageCache[key] !== undefined) {
                    return this._storageCache[key];
                }
                const val = Lampa.Storage.get(key, def);
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    try {
                        const parsed = JSON.parse(val);
                        this._storageCache[key] = parsed;
                        return parsed;
                    } catch(e) {}
                }
                this._storageCache[key] = val;
                return val;
            } catch(e) {
                return def;
            }
        },

        setStorage(key, val) {
            try {
                this._storageCache[key] = val;
                Lampa.Storage.set(key, typeof val === 'string' ? val : JSON.stringify(val));
            } catch(e) {}
        },

        throttle(fn, delay) {
            let lastCall = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    fn.apply(this, args);
                }
            };
        },

        isNumeric: (val) => typeof val === 'number' && !isNaN(val) && isFinite(val),

        findSegment(segments, time) {
            for (let i = 0, len = segments.length; i < len; i++) {
                const seg = segments[i];
                if (time >= seg.start && time < seg.end) return seg;
                if (seg.start > time) break;
            }
            return null;
        }
    };

    // ===== УПРАВЛЕНИЕ ПЛАГИНОМ =====
    const PluginSettings = {
        get: (key, def = true) => Utils.getStorage(`skip_intro_${key}`, def) !== false,
        
        isEnabled: () => PluginSettings.get('enabled'),
        isAutoSkip: () => PluginSettings.get('auto'),
        isTypeEnabled: (type) => PluginSettings.get(`type_${type}`, type !== 'preview'),

        initSettings() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });

            // [ключ, заголовок, описание (опц), дефолтное значение (опц)]
            const params = [
                ['enabled', 'Включить плагин', 'Показывать уведомления о пропуске'],
                ['auto', 'Автопропуск', 'Автоматически пропускать заставки'],
                ['type_intro', 'Пропускать заставку (intro)'],
                ['type_recap', 'Пропускать рекап (recap)'],
                ['type_credits', 'Пропускать титры (credits)'],
                ['type_preview', 'Пропускать превью (preview)', '', false]
            ];

            params.forEach(([key, label, desc = '', def = true]) => {
                Lampa.SettingsApi.addParam({
                    component: 'skip_intro',
                    param: { name: `skip_intro_${key}`, type: 'trigger', default: def },
                    field: { name: label, description: desc }
                });
            });
        }
    };

    // ===== КЭШИРОВАНИЕ =====
    const Cache = {
        _storageKey: 'skip_intro_cache',
        _smartKey: 'skip_intro_smart',
        _data: null,

        _load() {
            if (this._data) return this._data;
            try {
                const raw = Lampa.Storage.get(this._storageKey, '{}');
                this._data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                return this._data || {};
            } catch(e) {
                return this._data = {};
            }
        },

        _save() {
            try {
                Lampa.Storage.set(this._storageKey, JSON.stringify(this._data || {}));
            } catch(e) {}
        },

        get(tmdbId, season, episode) {
            const key = `${tmdbId}_s${season}_e${episode}`;
            const data = this._load();
            const entry = data[key];
            if (entry && entry._ts && Date.now() - entry._ts < CONFIG.CACHE_TTL) {
                return entry.segments || null;
            }
            if (entry) {
                delete data[key];
                this._save();
            }
            return null;
        },

        set(tmdbId, season, episode, segments) {
            const key = `${tmdbId}_s${season}_e${episode}`;
            const data = this._load();
            data[key] = { segments, _ts: Date.now() };
            this._save();
        },

        clear() {
            this._data = {};
            this._save();
        },

        _getSmartData() {
            try {
                const data = Lampa.Storage.get(this._smartKey, '{}');
                return typeof data === 'string' ? JSON.parse(data) : data;
            } catch(e) {
                return {};
            }
        },

        hasSkipped(tmdbId, type) {
            return this._getSmartData()[`${tmdbId}_${type}`] === true;
        },

        rememberSkip(tmdbId, type) {
            try {
                const data = this._getSmartData();
                data[`${tmdbId}_${type}`] = true;
                Lampa.Storage.set(this._smartKey, JSON.stringify(data));
            } catch(e) {}
        },

        forgetSkip(tmdbId, type) {
            try {
                const data = this._getSmartData();
                delete data[`${tmdbId}_${type}`];
                Lampa.Storage.set(this._smartKey, JSON.stringify(data));
            } catch(e) {}
        }
    };

    // ===== ОБЩИЕ СТИЛИ =====
    const StyleManager = {
        inject() {
            if (document.getElementById('skip-intro-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-styles';
            style.textContent = `
                /* Маркеры прогресс-бара */
                .skip-intro-markers {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none; z-index: 10; overflow: visible;
                }
                .skip-intro-marker {
                    position: absolute; top: 50%; transform: translateY(-50%); height: 70%;
                    border-radius: 3px; transition: all 0.3s ease; pointer-events: none;
                    min-width: 4px; opacity: 0.6; z-index: 5;
                }
                .skip-intro-marker-intro {
                    background: linear-gradient(180deg, rgba(76,175,80,0.8), rgba(76,175,80,0.3));
                    border: 1px solid rgba(76,175,80,0.5);
                }
                .skip-intro-marker-recap {
                    background: linear-gradient(180deg, rgba(255,152,0,0.8), rgba(255,152,0,0.3));
                    border: 1px solid rgba(255,152,0,0.5);
                }
                .skip-intro-marker-credits {
                    background: linear-gradient(180deg, rgba(33,150,243,0.8), rgba(33,150,243,0.3));
                    border: 1px solid rgba(33,150,243,0.5);
                }
                .skip-intro-marker-preview {
                    background: linear-gradient(180deg, rgba(156,39,176,0.8), rgba(156,39,176,0.3));
                    border: 1px solid rgba(156,39,176,0.5);
                }
                .skip-intro-marker.active {
                    opacity: 0.9 !important; height: 100% !important;
                    animation: skip-intro-pulse 1s ease-in-out infinite;
                    box-shadow: 0 0 20px rgba(255,255,255,0.2);
                }
                @keyframes skip-intro-pulse {
                    0%, 100% { opacity: 0.6; transform: translateY(-50%) scaleY(1); }
                    50% { opacity: 1; transform: translateY(-50%) scaleY(1.2); }
                }

                /* Уведомление */
                .skip-intro-notification {
                    position: fixed; top: 30px; left: 50%; transform: translateX(-50%) translateY(-20px);
                    background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                    color: #fff; padding: 16px 40px; border-radius: 12px; font-size: 18px; font-weight: 500;
                    z-index: 99999; opacity: 0; pointer-events: none;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: system-ui, -apple-system, sans-serif;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); text-align: center;
                    min-width: 200px; max-width: 80vw; letter-spacing: 0.3px;
                }
                .skip-intro-notification.show {
                    opacity: 1; transform: translateX(-50%) translateY(0);
                }
                .skip-intro-notification .icon { display: inline-block; margin-right: 12px; font-size: 22px; }
                .skip-intro-notification .label { display: inline-block; }
                .skip-intro-notification .badge { display: inline-block; margin-left: 10px; font-size: 13px; opacity: 0.6; font-weight: 400; }
                .skip-intro-notification .progress-ring {
                    display: inline-block; margin-left: 14px; width: 20px; height: 20px;
                    border: 2px solid rgba(255,255,255,0.2); border-top-color: #4CAF50;
                    border-radius: 50%; animation: skip-intro-spin 0.8s linear infinite; vertical-align: middle;
                }
                @keyframes skip-intro-spin { to { transform: rotate(360deg); } }
                @media (max-width: 720px) {
                    .skip-intro-notification { top: 20px; padding: 12px 24px; font-size: 15px; min-width: 150px; }
                }
            `;
            document.head.appendChild(style);
        }
    };

    // ===== ВИЗУАЛЬНАЯ РАЗМЕТКА ПРОГРЕСС-БАРА =====
    const ProgressMarker = {
        _container: null,
        _markersContainer: null,
        _markers: [],

        init() {
            this._findProgressBar();
        },

        _findProgressBar() {
            const selectors = [
                '.player-progress', '.video-progress', '.progress-bar', '.progress',
                '.seek-bar', '.timeline', '.player-timeline', '[class*="progress"]', '[class*="timeline"]'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) { this._container = el; break; }
            }

            if (!this._container) {
                try {
                    const player = document.querySelector('.player');
                    if (player) {
                        const progress = player.querySelector('[class*="progress"]') || player.querySelector('[class*="timeline"]');
                        if (progress) this._container = progress;
                    }
                } catch(e) {}
            }

            if (!this._container) return;

            let markersContainer = this._container.querySelector('.skip-intro-markers');
            if (!markersContainer) {
                markersContainer = document.createElement('div');
                markersContainer.className = 'skip-intro-markers';
                this._container.style.position = 'relative';
                this._container.appendChild(markersContainer);
            }
            this._markersContainer = markersContainer;
            StyleManager.inject();
        },

        clear() {
            if (this._markersContainer) this._markersContainer.innerHTML = '';
            this._markers = [];
        },

        addMarker(start, end, type, duration) {
            if (!this._markersContainer || !duration || !this._container) return;
            
            const startPercent = (start / duration) * 100;
            const endPercent = (end / duration) * 100;
            const width = Math.max(endPercent - startPercent, 0.5);
            
            if (width <= 0) return;
            
            const marker = document.createElement('div');
            marker.className = `skip-intro-marker skip-intro-marker-${type}`;
            marker.style.left = `${startPercent}%`;
            marker.style.width = `${width}%`;
            
            this._markersContainer.appendChild(marker);
            this._markers.push({ start, end, type, element: marker });
        },

        updateMarkers(segments, duration) {
            this.clear();
            if (!segments || !segments.length || !duration) return;
            
            if (!this._container || !this._markersContainer) {
                this._findProgressBar();
                if (!this._markersContainer) return;
            }
            
            [...segments]
                .sort((a, b) => a.start - b.start)
                .forEach(seg => this.addMarker(seg.start, seg.end, seg.type, duration));
        },

        highlightActive(segment) {
            if (!this._markersContainer) return;
            
            this._markers.forEach((m) => {
                const isMatch = segment && m.type === segment.type && m.start === segment.start && m.end === segment.end;
                m.element.classList.toggle('active', !!isMatch);
            });
        },

        resetHighlights() {
            this._markers.forEach(m => m.element.classList.remove('active'));
        },

        destroy() {
            this.clear();
            this._container = null;
            this._markersContainer = null;
        }
    };

    // ===== УВЕДОМЛЕНИЕ ПО ЦЕНТРУ ВВЕРХУ =====
    const Notification = {
        _element: null,
        _timer: null,

        show(text, badge, showProgress) {
            StyleManager.inject();
            this.hide();

            const el = document.createElement('div');
            el.className = 'skip-intro-notification';
            
            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = '⏭';
            el.appendChild(icon);

            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = text;
            el.appendChild(label);

            if (badge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'badge';
                badgeEl.textContent = badge;
                el.appendChild(badgeEl);
            }

            if (showProgress) {
                const progress = document.createElement('span');
                progress.className = 'progress-ring';
                el.appendChild(progress);
            }

            document.body.appendChild(el);
            this._element = el;

            requestAnimationFrame(() => el.classList.add('show'));

            this._timer = setTimeout(() => this.hide(), CONFIG.NOTIFICATION_DURATION);
        },

        hide() {
            if (this._timer) {
                clearTimeout(this._timer);
                this._timer = null;
            }
            if (this._element) {
                const el = this._element;
                el.classList.remove('show');
                setTimeout(() => {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 400);
                this._element = null;
            }
        },

        destroy() {
            this.hide();
        }
    };

    // ===== API ЗАПРОСЫ =====
    const ApiClient = {
        _fetch(url, timeout) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                let completed = false;

                const timer = setTimeout(() => {
                    if (!completed) {
                        completed = true;
                        xhr.abort();
                        reject(new Error('timeout'));
                    }
                }, timeout || CONFIG.DETECTION_TIMEOUT);

                xhr.open('GET', url, true);
                xhr.setRequestHeader('Accept', 'application/json');
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (completed) return;
                        completed = true;
                        clearTimeout(timer);
                        
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(e); }
                        } else if (xhr.status === 204 || xhr.status === 404) {
                            resolve(null);
                        } else {
                            reject(new Error(`HTTP ${xhr.status}`));
                        }
                    }
                };
                xhr.onerror = () => {
                    if (!completed) {
                        completed = true;
                        clearTimeout(timer);
                        reject(new Error('network'));
                    }
                };
                xhr.send();
            });
        },

        async load(tmdbId, imdbId, season, episode) {
            const cached = Cache.get(tmdbId, season, episode);
            if (cached) return cached;

            try {
                const url = `${CONFIG.THEINTRODB_URL}?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
                const data = await this._fetch(url);
                const segments = this._parseTheIntroDB(data);
                if (segments.length) {
                    Cache.set(tmdbId, season, episode, segments);
                    return segments;
                }
            } catch(e) {}

            try {
                const url1 = `${CONFIG.API_URL}/get_intros?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
                const url2 = `${CONFIG.API_URL}/get_credits?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
                const [intro, credits] = await Promise.all([
                    this._fetch(url1).catch(() => null),
                    this._fetch(url2).catch(() => null)
                ]);
                
                const segments = [];
                if (intro?.start && intro?.end) {
                    segments.push({ type: 'intro', start: Math.round(intro.start), end: Math.round(intro.end) });
                }
                if (credits?.start && credits?.end) {
                    segments.push({ type: 'credits', start: Math.round(credits.start), end: Math.round(credits.end) });
                }
                if (segments.length) {
                    Cache.set(tmdbId, season, episode, segments);
                    return segments;
                }
            } catch(e) {}

            if (imdbId) {
                try {
                    const url = `https://introhater.com/api/segments/${imdbId}:${season}:${episode}`;
                    const data = await this._fetch(url);
                    const segments = this._parseIntroHater(data);
                    if (segments.length) {
                        Cache.set(tmdbId, season, episode, segments);
                        return segments;
                    }
                } catch(e) {}
            }
            return [];
        },

        _parseTheIntroDB(data) {
            const segments = [];
            if (!data) return segments;
            
            ['intro', 'recap', 'credits', 'preview'].forEach(type => {
                const items = data[type];
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        const start = item.start_ms ? item.start_ms / 1000 : (item.start || 0);
                        const end = item.end_ms ? item.end_ms / 1000 : (item.end || 0);
                        if (end > start) segments.push({ type, start, end });
                    });
                }
            });
            return segments;
        },

        _parseIntroHater(data) {
            const segments = [];
            if (!Array.isArray(data)) return segments;
            
            data.forEach(item => {
                if (item.start != null && item.end != null && item.end > item.start) {
                    let type = 'intro';
                    const label = (item.label || '').toLowerCase();
                    if (label.includes('credit') || label === 'ed') type = 'credits';
                    else if (label.includes('recap')) type = 'recap';
                    else if (label.includes('preview')) type = 'preview';
                    
                    segments.push({ type, start: Math.round(item.start), end: Math.round(item.end) });
                }
            });
            return segments;
        }
    };

    // ===== ОСНОВНОЙ КЛАСС =====
    const SkipIntroPlugin = {
        _segments: [],
        _activeSegment: null,
        _lastSkipped: null,
        _currentData: null,
        _currentTmdb: null,
        _initialized: false,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            PluginSettings.initSettings();
            ProgressMarker.init();

            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());
            
            if (Lampa.PlayerVideo?.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', 
                    Utils.throttle((data) => this._onTimeUpdate(data), 300)
                );
            }
            console.log('[SkipIntro] Plugin initialized for Tizen');
        },

        _onStart(data) {
            this._cleanup();

            if (!PluginSettings.isEnabled()) return;

            const meta = this._extractMeta(data);
            if (!meta.tmdb_id || !meta.is_series || meta.season == null || meta.episode == null) return;

            this._currentData = data;
            this._currentTmdb = meta.tmdb_id;

            ApiClient.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode)
                .then(segments => {
                    if (this._currentData === data && segments) {
                        this._segments = segments;
                        this._updateProgressMarkers(segments);
                    }
                })
                .catch(() => {});
        },

        _extractMeta(data) {
            const meta = { tmdb_id: null, imdb_id: null, season: null, episode: null, is_series: false };

            if (data.tmdb_id) meta.tmdb_id = data.tmdb_id;
            if (data.imdb_id) meta.imdb_id = data.imdb_id;
            if (data.season != null) meta.season = parseInt(data.season);
            if (data.episode != null) meta.episode = parseInt(data.episode);

            let card = data.card || null;
            if (!card) {
                try {
                    const activity = Lampa.Activity.active();
                    if (activity) card = activity.card || activity.movie || null;
                } catch(e) {}
            }

            if (card) {
                if (!meta.tmdb_id) meta.tmdb_id = card.id || null;
                if (!meta.imdb_id) meta.imdb_id = card.imdb_id || null;
                if (card.name || card.title || card.number_of_seasons || card.first_air_date) {
                    meta.is_series = true;
                }
            }

            if (data.playlist && Array.isArray(data.playlist)) {
                const url = data.url;
                for (let i = 0; i < data.playlist.length; i++) {
                    const item = data.playlist[i];
                    const itemUrl = typeof item.url === 'string' ? item.url : '';
                    
                    if (itemUrl === url || i === 0) {
                        const s = item.season ?? item.s ?? item.season_num;
                        const e = item.episode ?? item.e ?? item.episode_num;
                        if (s != null && meta.season == null) meta.season = parseInt(s);
                        if (e != null && meta.episode == null) meta.episode = parseInt(e);
                    }
                    if (itemUrl === url) break;
                }
            }

            if (!meta.tmdb_id && meta.is_series) {
                try {
                    const activity = Lampa.Activity.active();
                    if (activity?.movie?.id) meta.tmdb_id = activity.movie.id;
                } catch(e) {}
            }

            if (meta.tmdb_id && meta.season != null && meta.episode != null) {
                meta.is_series = true;
            }

            if (!meta.tmdb_id && meta.is_series) {
                try {
                    const current = Lampa.Storage.get('current', null);
                    if (current?.id) meta.tmdb_id = current.id;
                } catch(e) {}
            }
            return meta;
        },

        _updateProgressMarkers(segments) {
            let duration = 0;
            try {
                const video = Lampa.PlayerVideo.video();
                if (video) duration = video.duration;
            } catch(e) {}
            
            if (duration > 0 && segments?.length) {
                ProgressMarker.updateMarkers(segments, duration);
                return;
            }
            
            if (!duration) {
                let attempts = 0;
                const checkDuration = () => {
                    attempts++;
                    try {
                        const video = Lampa.PlayerVideo.video();
                        if (video?.duration) {
                            ProgressMarker.updateMarkers(segments, video.duration);
                        } else if (attempts < 20) {
                            setTimeout(checkDuration, 500);
                        }
                    } catch(e) {
                        if (attempts < 20) setTimeout(checkDuration, 500);
                    }
                };
                checkDuration();
            }
        },

        _onTimeUpdate(data) {
            if (!PluginSettings.isEnabled() || !this._segments.length) return;
            
            const current = data.current;
            if (!Utils.isNumeric(current)) return;
            
            const segment = Utils.findSegment(this._segments, current);
            ProgressMarker.highlightActive(segment);
            
            if (segment) {
                if (!PluginSettings.isTypeEnabled(segment.type)) {
                    if (this._activeSegment) this._hideNotification();
                    return;
                }
                if (this._lastSkipped === segment) return;
                
                if (this._activeSegment !== segment) {
                    this._activeSegment = segment;
                    if (PluginSettings.isAutoSkip()) {
                        this._doSkip(segment, true);
                    }
                }
            } else if (this._activeSegment) {
                this._hideNotification();
            }
        },

        _hideNotification() {
            this._activeSegment = null;
            Notification.hide();
        },

        _doSkip(segment, auto) {
            this._lastSkipped = segment;
            this._activeSegment = null;
            
            const labels = { intro: 'Заставка', recap: 'Рекап', credits: 'Титры', preview: 'Превью' };
            const label = labels[segment.type] || segment.type;
            const time = Math.round(segment.end - segment.start);
            
            Notification.show(`⏭ ${label} пропущена`, `${time}с${auto ? ' ⚡' : ''}`, false);
            
            try {
                const video = Lampa.PlayerVideo.video();
                if (video) {
                    const target = Math.min(segment.end, video.duration || segment.end);
                    video.currentTime = target;
                    
                    setTimeout(() => {
                        try { if (video.paused) video.play(); } catch(e) {}
                    }, 100);
                }
            } catch(e) {}
        },

        _cleanup() {
            this._segments = [];
            this._activeSegment = null;
            this._lastSkipped = null;
            this._currentData = null;
            this._currentTmdb = null;
            Notification.destroy();
        },

        _onDestroy() {
            this._cleanup();
            ProgressMarker.destroy();
        }
    };

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function initPlugin() {
        if (window.Lampa && Lampa.SettingsApi && Lampa.Player && Lampa.Storage) {
            SkipIntroPlugin.init();
        } else {
            setTimeout(initPlugin, 500);
        }
    }

    if (window.Lampa?.Listener) {
        Lampa.Listener.follow('app', (data) => {
            if (data.type === 'ready') initPlugin();
        });
    }

    setTimeout(initPlugin, 1000);
}();
