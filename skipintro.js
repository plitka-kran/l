!function() {
    "use strict";
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    // ===== КОНФИГ =====
    const C = {
        API_URL: 'https://api.introdb.app',
        THEINTRODB_URL: 'https://api.theintrodb.org/v2/media',
        CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
        INTRO_MAX_START: 150,
        INTRO_MAX_END: 300,
        CREDITS_MIN_GAP: 30,
        MIN_SUBTITLES: 5,
        NOTIFICATION_DURATION: 3000
    };

    // ===== УТИЛИТЫ =====
    const U = {
        get(key, def) {
            try {
                const v = Lampa.Storage.get(key, def);
                if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
                    try { return JSON.parse(v); } catch(e) {}
                }
                return v;
            } catch(e) { return def; }
        },
        set(key, val) {
            try {
                Lampa.Storage.set(key, typeof val === 'string' ? val : JSON.stringify(val));
            } catch(e) {}
        },
        findSegment(segments, time) {
            for (let i = 0; i < segments.length; i++) {
                const s = segments[i];
                if (time >= s.start && time < s.end) return s;
                if (s.start > time) break;
            }
            return null;
        },
        getVideo() {
            try {
                const v = Lampa.PlayerVideo.video();
                if (v && v.tagName === 'VIDEO') return v;
            } catch(e) {}
            const el = document.querySelector('video');
            return el && el.tagName === 'VIDEO' ? el : null;
        }
    };

    // ===== НАСТРОЙКИ =====
    const Settings = {
        isEnabled() { return U.get('skip_intro_enabled', true) !== false; },
        isAutoSkip() { return U.get('skip_intro_auto', true) !== false; },
        isTypeEnabled(type) { return U.get(`skip_intro_type_${type}`, true) !== false; },

        init() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });

            [
                { name: 'skip_intro_enabled', default: true, label: 'Включить плагин' },
                { name: 'skip_intro_auto', default: true, label: 'Автопропуск' },
                { name: 'skip_intro_type_intro', default: true, label: 'Пропускать заставку' },
                { name: 'skip_intro_type_recap', default: true, label: 'Пропускать рекап' },
                { name: 'skip_intro_type_credits', default: true, label: 'Пропускать титры' },
                { name: 'skip_intro_type_preview', default: false, label: 'Пропускать превью' }
            ].forEach(p => {
                Lampa.SettingsApi.addParam({
                    component: 'skip_intro',
                    param: { name: p.name, type: 'trigger', default: p.default },
                    field: { name: p.label }
                });
            });
        }
    };

    // ===== КЭШ =====
    const Cache = {
        _data: null,
        _load() {
            if (this._data) return this._data;
            try {
                this._data = JSON.parse(Lampa.Storage.get('skip_intro_cache', '{}'));
            } catch(e) { this._data = {}; }
            return this._data;
        },
        _save() {
            try { Lampa.Storage.set('skip_intro_cache', JSON.stringify(this._data || {})); } catch(e) {}
        },
        get(tmdbId, season, episode) {
            const key = `${tmdbId}_s${season}_e${episode}`;
            const data = this._load();
            const entry = data[key];
            if (entry && entry._ts && Date.now() - entry._ts < C.CACHE_TTL) {
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
        }
    };

    // ===== МАРКЕРЫ =====
    const Marker = {
        _container: null,
        _markers: null,

        init() {
            const selectors = ['.player-progress', '.video-progress', '.progress-bar', '.seek-bar', '.timeline'];
            for (const s of selectors) {
                const el = document.querySelector(s);
                if (el) { this._container = el; break; }
            }
            if (!this._container) return;

            this._markers = this._container.querySelector('.skip-intro-markers');
            if (!this._markers) {
                this._markers = document.createElement('div');
                this._markers.className = 'skip-intro-markers';
                this._markers.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10';
                this._container.style.position = 'relative';
                this._container.appendChild(this._markers);
            }
            this._injectStyles();
        },

        _injectStyles() {
            if (document.getElementById('skip-intro-styles')) return;
            const style = document.createElement('style');
            style.id = 'skip-intro-styles';
            style.textContent = `
                .skip-intro-marker {
                    position:absolute;top:50%;transform:translateY(-50%);
                    height:70%;border-radius:3px;min-width:4px;opacity:0.6;
                    pointer-events:none;z-index:5;transition:all .3s;
                }
                .skip-intro-marker-intro { background:rgba(76,175,80,0.8); border:1px solid #4CAF50; }
                .skip-intro-marker-recap { background:rgba(255,152,0,0.8); border:1px solid #FF9800; }
                .skip-intro-marker-credits { background:rgba(33,150,243,0.8); border:1px solid #2196F3; }
                .skip-intro-marker-preview { background:rgba(156,39,176,0.8); border:1px solid #9C27B0; }
                .skip-intro-marker.active {
                    opacity:0.9 !important;height:100% !important;
                    animation:pulse 1s infinite;
                }
                @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
            `;
            document.head.appendChild(style);
        },

        update(segments, duration) {
            if (!this._markers || !segments || !duration) return;
            this._markers.innerHTML = '';
            segments.forEach(s => {
                const l = (s.start / duration) * 100;
                const w = Math.max(((s.end - s.start) / duration) * 100, 0.5);
                const el = document.createElement('div');
                el.className = `skip-intro-marker skip-intro-marker-${s.type}`;
                el.style.cssText = `left:${Math.min(l,100)}%;width:${Math.min(w,100-l)}%;`;
                this._markers.appendChild(el);
            });
        },

        highlight(segment) {
            if (!this._markers) return;
            const els = this._markers.querySelectorAll('.skip-intro-marker');
            els.forEach(el => el.classList.remove('active'));
            if (segment) {
                const idx = this._markers.children.length - 1;
                for (let i = 0; i < this._markers.children.length; i++) {
                    const el = this._markers.children[i];
                    const type = el.className.match(/skip-intro-marker-(\w+)/);
                    if (type && type[1] === segment.type) {
                        el.classList.add('active');
                        break;
                    }
                }
            }
        },

        destroy() {
            if (this._markers) this._markers.innerHTML = '';
            this._container = null;
            this._markers = null;
        }
    };

    // ===== УВЕДОМЛЕНИЕ =====
    const Notify = {
        _el: null,
        _timer: null,

        show(text, badge) {
            this.hide();
            const el = document.createElement('div');
            el.style.cssText = `
                position:fixed;top:30px;left:50%;transform:translateX(-50%) translateY(-20px);
                background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);color:#fff;
                padding:14px 32px;border-radius:12px;font-size:17px;font-weight:500;
                z-index:99999;opacity:0;transition:all .4s;font-family:system-ui,sans-serif;
                border:1px solid rgba(255,255,255,0.15);box-shadow:0 8px 32px rgba(0,0,0,0.6);
                display:flex;align-items:center;gap:10px;
            `;
            el.innerHTML = `<span>⏭</span><span>${text}</span>${badge ? `<span style="font-size:13px;opacity:0.7;background:rgba(255,255,255,0.1);padding:2px 10px;border-radius:20px">${badge}</span>` : ''}`;
            document.body.appendChild(el);
            this._el = el;
            requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
            this._timer = setTimeout(() => this.hide(), C.NOTIFICATION_DURATION);
        },

        hide() {
            if (this._timer) { clearTimeout(this._timer); this._timer = null; }
            if (this._el) {
                this._el.style.opacity = '0';
                this._el.style.transform = 'translateX(-50%) translateY(-20px)';
                setTimeout(() => { if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el); this._el = null; }, 400);
            }
        },

        destroy() { this.hide(); }
    };

    // ===== API =====
    const Api = {
        _fetch(url) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                let done = false;
                const timer = setTimeout(() => { if (!done) { done = true; xhr.abort(); reject('timeout'); } }, 5000);
                xhr.open('GET', url, true);
                xhr.setRequestHeader('Accept', 'application/json');
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4 && !done) {
                        done = true;
                        clearTimeout(timer);
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(e); }
                        } else { resolve(null); }
                    }
                };
                xhr.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject('network'); } };
                xhr.send();
            });
        },

        async load(tmdbId, imdbId, season, episode) {
            if (!tmdbId || season == null || episode == null) return [];
            const cached = Cache.get(tmdbId, season, episode);
            if (cached) return cached;

            let segments = [];

            try {
                const data = await this._fetch(`${C.THEINTRODB_URL}?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`);
                if (data) {
                    ['intro', 'recap', 'credits', 'preview'].forEach(type => {
                        if (Array.isArray(data[type])) {
                            data[type].forEach(item => {
                                const s = item.start_ms ? item.start_ms / 1000 : (item.start || 0);
                                const e = item.end_ms ? item.end_ms / 1000 : (item.end || 0);
                                if (e > s && s >= 0) segments.push({ type, start: Math.round(s), end: Math.round(e) });
                            });
                        }
                    });
                }
            } catch(e) {}

            if (!segments.length) {
                try {
                    const [intro, credits] = await Promise.all([
                        this._fetch(`${C.API_URL}/get_intros?tmdb=${tmdbId}&season=${season}&episode=${episode}`).catch(() => null),
                        this._fetch(`${C.API_URL}/get_credits?tmdb=${tmdbId}&season=${season}&episode=${episode}`).catch(() => null)
                    ]);
                    if (intro && intro.start && intro.end) segments.push({ type: 'intro', start: Math.round(intro.start), end: Math.round(intro.end) });
                    if (credits && credits.start && credits.end) segments.push({ type: 'credits', start: Math.round(credits.start), end: Math.round(credits.end) });
                } catch(e) {}
            }

            if (!segments.length && imdbId) {
                try {
                    const data = await this._fetch(`https://introhater.com/api/segments/${imdbId}:${season}:${episode}`);
                    if (Array.isArray(data)) {
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
                    }
                } catch(e) {}
            }

            if (segments.length) {
                Cache.set(tmdbId, season, episode, segments);
                return segments;
            }
            return [];
        }
    };

    // ===== ОСНОВНОЙ ПЛАГИН =====
    const Plugin = {
        _segments: [],
        _active: null,
        _last: null,
        _data: null,
        _init: false,

        init() {
            if (this._init) return;
            this._init = true;
            Settings.init();
            Marker.init();

            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());

            if (Lampa.PlayerVideo && Lampa.PlayerVideo.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', (data) => {
                    if (!Settings.isEnabled() || !this._segments.length) return;
                    const current = data.current;
                    if (!current && current !== 0) return;
                    const seg = U.findSegment(this._segments, current);
                    Marker.highlight(seg);
                    if (seg && Settings.isAutoSkip() && Settings.isTypeEnabled(seg.type) && this._last !== seg) {
                        this._skip(seg);
                    }
                });
            }

            console.log('[SkipIntro] Torrent-only version loaded');
        },

        _onStart(data) {
            this._cleanup();
            if (!Settings.isEnabled()) return;

            const meta = this._getMeta(data);
            if (!meta.tmdb_id || meta.season == null || meta.episode == null) {
                console.log('[SkipIntro] Not a series or missing data');
                return;
            }

            this._data = data;
            console.log(`[SkipIntro] Loading S${meta.season}E${meta.episode}`);

            Api.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode)
                .then(segments => {
                    if (this._data === data) {
                        this._segments = segments;
                        this._updateMarkers(segments);
                        console.log(`[SkipIntro] Loaded ${segments.length} segments`);
                    }
                })
                .catch(err => console.log('[SkipIntro] API error:', err));
        },

        _getMeta(data) {
            const meta = { tmdb_id: null, imdb_id: null, season: null, episode: null };

            if (data.tmdb_id) meta.tmdb_id = data.tmdb_id;
            if (data.imdb_id) meta.imdb_id = data.imdb_id;
            if (data.season != null) meta.season = parseInt(data.season);
            if (data.episode != null) meta.episode = parseInt(data.episode);

            if (!meta.tmdb_id || meta.season == null || meta.episode == null) {
                try {
                    const card = Lampa.Activity.active()?.card || null;
                    if (card) {
                        if (!meta.tmdb_id) meta.tmdb_id = card.id;
                        if (!meta.imdb_id) meta.imdb_id = card.imdb_id;
                    }
                } catch(e) {}
            }

            if (data.playlist && Array.isArray(data.playlist)) {
                const url = data.url || '';
                for (const item of data.playlist) {
                    if (item.url === url || !url) {
                        if (item.season != null && meta.season == null) meta.season = parseInt(item.season);
                        if (item.episode != null && meta.episode == null) meta.episode = parseInt(item.episode);
                        if (item.s != null && meta.season == null) meta.season = parseInt(item.s);
                        if (item.e != null && meta.episode == null) meta.episode = parseInt(item.e);
                        break;
                    }
                }
            }

            return meta;
        },

        _updateMarkers(segments) {
            let duration = 0;
            try {
                const v = U.getVideo();
                if (v) duration = v.duration;
            } catch(e) {}
            if (duration > 0) {
                Marker.update(segments, duration);
            } else {
                let attempts = 0;
                const check = () => {
                    attempts++;
                    try {
                        const v = U.getVideo();
                        if (v && v.duration) {
                            Marker.update(segments, v.duration);
                        } else if (attempts < 20) {
                            setTimeout(check, 500);
                        }
                    } catch(e) { if (attempts < 20) setTimeout(check, 500); }
                };
                check();
            }
        },

        _skip(seg) {
            this._last = seg;
            this._active = null;

            const labels = { intro: 'Заставка', recap: 'Рекап', credits: 'Титры', preview: 'Превью' };
            const label = labels[seg.type] || seg.type;
            Notify.show(`⏭ ${label} пропущена`, `${Math.round(seg.end - seg.start)}с ⚡`);

            const target = Math.min(seg.end, U.getVideo()?.duration || seg.end);
            try {
                const v = U.getVideo();
                if (v) v.currentTime = target;
            } catch(e) {}
        },

        _cleanup() {
            this._segments = [];
            this._active = null;
            this._last = null;
            this._data = null;
            Notify.destroy();
        },

        _onDestroy() {
            this._cleanup();
            Marker.destroy();
        }
    };

    // ===== СТАРТ =====
    function init() {
        if (window.Lampa && Lampa.SettingsApi && Lampa.Player && Lampa.Storage) {
            Plugin.init();
        } else {
            setTimeout(init, 500);
        }
    }

    if (window.Lampa?.Listener) {
        Lampa.Listener.follow('app', (data) => { if (data.type === 'ready') init(); });
    }

    setTimeout(init, 1000);

}();
