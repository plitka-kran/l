!function() {
    "use strict";
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    const CONFIG = {
        API_URL: 'https://api.introdb.app',
        THEINTRODB_URL: 'https://api.theintrodb.org/v2/media',
        CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
        DETECTION_TIMEOUT: 4000,
        INTRO_MAX_START: 150,
        INTRO_MAX_END: 300,
        CREDITS_MIN_GAP: 30,
        MIN_SUBTITLES: 5,
        NOTIFICATION_DURATION: 3000
    };

    const Utils = {
        throttle(fn, delay) {
            let last = 0;
            return function(...args) {
                const now = Date.now();
                if (now - last >= delay) { last = now; fn.apply(this, args); }
            };
        }
    };

    // ===== КЭШ ВРЕМЕННЫХ ИНТЕРВАЛОВ =====
    const Cache = {
        _data: null,
        _load() {
            if (this._data) return this._data;
            try {
                const raw = Lampa.Storage.get('skip_intro_cache', '{}');
                this._data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                return this._data || {};
            } catch(e) { return (this._data = {}); }
        },
        get(tmdbId, s, e) {
            const entry = this._load()[`${tmdbId}_s${s}_e${e}`];
            if (entry && Date.now() - entry._ts < CONFIG.CACHE_TTL) return entry.segments;
            return null;
        },
        set(tmdbId, s, e, segments) {
            const data = this._load();
            data[`${tmdbId}_s${s}_e${e}`] = { segments, _ts: Date.now() };
            Lampa.Storage.set('skip_intro_cache', JSON.stringify(data));
        }
    };

    // ===== МАРКЕРЫ НА ШКАЛЕ ПРОГРЕССА =====
    const ProgressMarker = {
        _container: null,
        _markers: [],

        init() {
            const progressSelectors = ['.player-progress', '.video-progress', '.progress-bar', '.player-timeline'];
            for (const sel of progressSelectors) {
                const el = document.querySelector(sel);
                if (el) { this._container = el; break; }
            }
            if (!this._container) return;

            let mBox = this._container.querySelector('.skip-intro-markers');
            if (!mBox) {
                mBox = document.createElement('div');
                mBox.className = 'skip-intro-markers';
                mBox.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
                this._container.style.position = 'relative';
                this._container.appendChild(mBox);
            }
            this._injectStyles();
        },

        _injectStyles() {
            if (document.getElementById('skip-styles')) return;
            const style = document.createElement('style');
            style.id = 'skip-styles';
            style.textContent = `
                .skip-marker { position: absolute; top: 50%; transform: translateY(-50%); height: 70%; border-radius: 2px; transition: all 0.2s; opacity: 0.5; min-width: 4px; }
                .skip-marker-intro { background: rgba(76, 175, 80, 0.8); }
                .skip-marker-recap { background: rgba(255, 152, 0, 0.8); }
                .skip-marker-credits { background: rgba(33, 150, 243, 0.8); }
                .skip-marker.active { opacity: 0.95; height: 100%; box-shadow: 0 0 10px rgba(255,255,255,0.4); }
            `;
            document.head.appendChild(style);
        },

        draw(segments, duration) {
            this.clear();
            if (!this._container) this.init();
            const mBox = this._container?.querySelector('.skip-intro-markers');
            if (!mBox || !duration) return;

            segments.forEach(seg => {
                const startPct = (seg.start / duration) * 100;
                const widthPct = Math.max(((seg.end - seg.start) / duration) * 100, 0.6);
                
                const m = document.createElement('div');
                m.className = `skip-marker skip-marker-${seg.type}`;
                m.style.left = startPct + '%';
                m.style.width = widthPct + '%';
                
                mBox.appendChild(m);
                this._markers.push({ seg, el: m });
            });
        },

        highlight(activeSeg) {
            this._markers.forEach(item => {
                if (activeSeg && item.seg.start === activeSeg.start && item.seg.type === activeSeg.type) {
                    item.el.classList.add('active');
                } else {
                    item.el.classList.remove('active');
                }
            });
        },

        clear() {
            const mBox = this._container?.querySelector('.skip-intro-markers');
            if (mBox) mBox.innerHTML = '';
            this._markers = [];
        }
    };

    // ===== УВЕДОМЛЕНИЯ =====
    const Notification = {
        _el: null,
        _timer: null,

        show(text, subText) {
            this.hide();
            if (!document.getElementById('skip-notif-styles')) {
                const style = document.createElement('style');
                style.id = 'skip-notif-styles';
                style.textContent = `
                    .skip-notif { position: fixed; top: 35px; left: 50%; transform: translateX(-50%); background: rgba(10,10,10,0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); color: #fff; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: 500; z-index: 99999; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: sans-serif; display: flex; align-items: center; gap: 10px; }
                    .skip-notif .badge { opacity: 0.6; font-size: 13px; background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 4px; }
                `;
                document.head.appendChild(style);
            }

            const el = document.createElement('div');
            el.className = 'skip-notif';
            el.innerHTML = `<span>⏭ ${text}</span> <span class="badge">${subText}</span>`;
            document.body.appendChild(el);
            this._el = el;

            this._timer = setTimeout(() => this.hide(), CONFIG.NOTIFICATION_DURATION);
        },

        hide() {
            if (this._timer) clearTimeout(this._timer);
            if (this._el) {
                this._el.parentNode?.removeChild(this._el);
                this._el = null;
            }
        }
    };

    // ===== АНАЛИЗАТОР СУБТИТРОВ =====
    const SubtitleDetector = {
        async detect(video, duration) {
            try {
                if (video.textTracks?.length) {
                    for (let i = 0; i < video.textTracks.length; i++) {
                        const track = video.textTracks[i];
                        if (track.cues?.length > CONFIG.MIN_SUBTITLES) {
                            return this._analyze(track.cues, duration);
                        }
                    }
                }
                const subs = Lampa.PlayerVideo?.subtitles?.() || [];
                const firstSub = subs.find(s => s.url);
                if (firstSub) {
                    const text = await this._fetch(firstSub.url);
                    if (text) return this._parseSrt(text, duration);
                }
            } catch(e) {}
            return [];
        },

        _fetch(url) {
            return new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.timeout = CONFIG.DETECTION_TIMEOUT;
                xhr.onload = () => resolve(xhr.status === 200 ? xhr.responseText : null);
                xhr.onerror = () => resolve(null);
                xhr.send();
            });
        },

        _parseSrt(text, duration) {
            const cues = [];
            const lines = text.replace(/\r\n/g, '\n').split('\n');
            const timeReg = /(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/;

            lines.forEach(line => {
                const m = line.match(timeReg);
                if (m) {
                    const start = this._toSec(m[1]), end = this._toSec(m[2]);
                    if (end > start) cues.push({ start, end });
                }
            });
            return this._analyze(cues, duration);
        },

        _toSec(str) {
            const p = str.match(/(\d+):(\d{2}):(\d{2})[.,](\d{3})/);
            return p ? parseInt(p[1])*3600 + parseInt(p[2])*60 + parseInt(p[3]) + parseInt(p[4])/1000 : 0;
        },

        _analyze(cues, duration) {
            if (cues.length < CONFIG.MIN_SUBTITLES) return [];
            cues.sort((a,b) => a.start - b.start);
            const segments = [];

            if (cues[0].start >= 15 && cues[0].start <= CONFIG.INTRO_MAX_START) {
                segments.push({ type: 'intro', start: 0, end: Math.round(cues[0].start) });
            }

            const lastCue = cues[cues.length - 1];
            if (duration > 600 && (duration - lastCue.end) >= CONFIG.CREDITS_MIN_GAP) {
                segments.push({ type: 'credits', start: Math.round(lastCue.end), end: Math.round(duration) });
            }
            return segments;
        }
    };

    // ===== СЕТЕВЫЕ ЗАПРОСЫ (API) =====
    const Api = {
        _req(url) {
            return new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url);
                xhr.timeout = CONFIG.DETECTION_TIMEOUT;
                xhr.onload = () => {
                    try { resolve(xhr.status === 200 ? JSON.parse(xhr.responseText) : null); } catch(e) { resolve(null); }
                };
                xhr.onerror = () => resolve(null);
                xhr.send();
            });
        },

        async load(tmdbId, imdbId, s, e) {
            const cached = Cache.get(tmdbId, s, e);
            if (cached) return cached;

            // 1. Запрос к TheIntroDB
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

            // 2. Запрос к Альтернативному API
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

    // ===== ЯДРО ПЛАГИНА =====
    const Core = {
        _segments: [],
        _active: null,
        _lastSkipped: null,
        _curId: null,

        init() {
            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());
            
            if (Lampa.PlayerVideo?.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', Utils.throttle((d) => this._onTick(d), 350));
            }
        },

        async _onStart(data) {
            this._cleanup();

            const meta = this._extractMeta(data);
            if (!meta.tmdb_id || meta.season == null || meta.episode == null) return;

            this._curId = meta.tmdb_id;

            const [apiSegs, subSegs] = await Promise.all([
                Api.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode),
                this._detectLocal(meta)
            ]);

            if (this._curId !== meta.tmdb_id) return;

            const merged = [...apiSegs];
            subSegs.forEach(sSeg => {
                if (!merged.some(m => m.type === sSeg.type)) merged.push(sSeg);
            });

            this._segments = merged;

            setTimeout(() => {
                try {
                    const video = Lampa.PlayerVideo.video();
                    if (video && video.duration) ProgressMarker.draw(this._segments, video.duration);
                } catch(e) {}
            }, 1000);
        },

        _detectLocal(meta) {
            return new Promise(resolve => {
                setTimeout(async () => {
                    try {
                        const video = Lampa.PlayerVideo.video();
                        if (video && video.duration) {
                            const segs = await SubtitleDetector.detect(video, video.duration);
                            resolve(segs);
                            return;
                        }
                    } catch(e) {}
                    resolve([]);
                }, 1500);
            });
        },

        _onTick(data) {
            if (!this._segments.length) return;

            const cur = data.current;
            const active = this._segments.find(s => cur >= s.start && cur < s.end);

            ProgressMarker.highlight(active);

            if (active) {
                if (this._lastSkipped === active) return;

                if (this._active !== active) {
                    this._active = active;
                    this._skipTo(active);
                }
            } else {
                this._active = null;
                Notification.hide();
            }
        },

        _skipTo(seg) {
            this._lastSkipped = seg;
            this._active = null;
            
            const names = { intro: 'Заставка', recap: 'Рекап', credits: 'Титры' };
            Notification.show(`${names[seg.type] || 'Фрагмент'} пропущен`, `${seg.end - seg.start}с ⚡`);

            try {
                const video = Lampa.PlayerVideo.video();
                if (video) {
                    video.currentTime = Math.min(seg.end, video.duration || seg.end);
                }
            } catch(e) {}
        },

        _extractMeta(data) {
            const meta = { tmdb_id: data.tmdb_id, imdb_id: data.imdb_id, season: null, episode: null };
            
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
            this._segments = [];
            this._active = null;
            this._lastSkipped = null;
            this._curId = null;
            Notification.hide();
            ProgressMarker.clear();
        },

        _onDestroy() {
            this._cleanup();
        }
    };

    function init() {
        if (window.Lampa && Lampa.Player) {
            Core.init();
        } else {
            setTimeout(init, 400);
        }
    }

    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', (data) => { if (data.type === 'ready') init(); });
    }
    setTimeout(init, 800);
}();
