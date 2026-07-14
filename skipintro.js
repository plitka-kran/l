!function() {
    "use strict";
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    // ===== КОНФИГУРАЦИЯ =====
    const CONFIG = {
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
    const Utils = {
        _storageCache: {},
        
        getStorage(key, def) {
            try {
                if (this._storageCache[key] !== undefined) return this._storageCache[key];
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
            } catch(e) { return def; }
        },

        isNumeric(val) {
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        },

        findSegment(segments, time) {
            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                if (time >= seg.start && time < seg.end) return seg;
            }
            return null;
        },

        parseSeasonEpisode(text) {
            if (!text || typeof text !== 'string') return null;
            let match = text.match(/[Ss](\d+)\s*[Ee](\d+)/) || text.match(/(\d+)\s*[xX]\s*(\d+)/);
            if (match) return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
            return null;
        }
    };

    // ===== НАСТРОЙКИ =====
    const PluginSettings = {
        isEnabled() { return Utils.getStorage('skip_intro_enabled', true) !== false; },
        isAutoSkip() { return Utils.getStorage('skip_intro_auto', true) !== false; },
        isTypeEnabled(type) { return Utils.getStorage(`skip_intro_type_${type}`, true) !== false; },

        initSettings() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок (Торренты)',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });

            const params = [
                { name: 'skip_intro_enabled', type: 'trigger', default: true, label: 'Включить плагин' },
                { name: 'skip_intro_auto', type: 'trigger', default: true, label: 'Автопропуск заставок' },
                { name: 'skip_intro_type_intro', type: 'trigger', default: true, label: 'Пропускать заставку (intro)' },
                { name: 'skip_intro_type_recap', type: 'trigger', default: true, label: 'Пропускать рекап (recap)' },
                { name: 'skip_intro_type_credits', type: 'trigger', default: true, label: 'Пропускать титры (credits)' }
            ];

            params.forEach(p => {
                Lampa.SettingsApi.addParam({
                    component: 'skip_intro',
                    param: { name: p.name, type: p.type, default: p.default },
                    field: { name: p.label }
                });
            });
        }
    };

    // ===== КЭШИРОВАНИЕ =====
    const Cache = {
        _storageKey: 'skip_intro_cache',
        _data: null,

        _load() {
            if (this._data) return this._data;
            try {
                const raw = Lampa.Storage.get(this._storageKey, '{}');
                this._data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                return this._data || {};
            } catch(e) {
                this._data = {};
                return this._data;
            }
        },

        get(tmdbId, season, episode) {
            const key = `${tmdbId}_s${season}_e${episode}`;
            const entry = this._load()[key];
            if (entry && entry._ts && Date.now() - entry._ts < CONFIG.CACHE_TTL) {
                return entry.segments || null;
            }
            return null;
        },

        set(tmdbId, season, episode, segments) {
            const key = `${tmdbId}_s${season}_e${episode}`;
            const data = this._load();
            data[key] = { segments, _ts: Date.now() };
            try { Lampa.Storage.set(this._storageKey, JSON.stringify(data)); } catch(e) {}
        }
    };

    // ===== ОТОБРАЖЕНИЕ МАРКЕРОВ НА ДОРОЖКЕ =====
    const ProgressMarker = {
        _container: null,
        _markersContainer: null,
        _markers: [],

        init() {
            const el = document.querySelector('.player-progress, .video-progress, .progress-bar, .seek-bar');
            if (el) {
                this._container = el;
                this._container.style.position = 'relative';
                
                let mc = this._container.querySelector('.skip-intro-markers');
                if (!mc) {
                    mc = document.createElement('div');
                    mc.className = 'skip-intro-markers';
                    mc.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10;';
                    this._container.appendChild(mc);
                }
                this._markersContainer = mc;
                this._injectStyles();
            }
        },

        _injectStyles() {
            if (document.getElementById('skip-intro-styles')) return;
            const style = document.createElement('style');
            style.id = 'skip-intro-styles';
            style.textContent = `
                .skip-intro-marker {
                    position: absolute; top: 50%; transform: translateY(-50%); height: 70%;
                    border-radius: 3px; min-width: 4px; opacity: 0.5; transition: all 0.3s ease;
                }
                .skip-intro-marker-intro { background: rgba(76, 175, 80, 0.8); border: 1px solid rgba(76, 175, 80, 0.5); }
                .skip-intro-marker-recap { background: rgba(255, 152, 0, 0.8); border: 1px solid rgba(255, 152, 0, 0.5); }
                .skip-intro-marker-credits { background: rgba(33, 150, 243, 0.8); border: 1px solid rgba(33, 150, 243, 0.5); }
                .skip-intro-marker.active { opacity: 0.95; height: 100%; box-shadow: 0 0 8px #fff; }
                
                .skip-intro-notification {
                    position: fixed; top: 30px; left: 50%; transform: translateX(-50%) translateY(-20px);
                    background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
                    color: #fff; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: 500;
                    z-index: 99999; opacity: 0; pointer-events: none; transition: all 0.3s ease;
                    border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 5px 20px rgba(0,0,0,0.5);
                }
                .skip-intro-notification.show { opacity: 1; transform: translateX(-50%) translateY(0); }
            `;
            document.head.appendChild(style);
        },

        update(segments, duration) {
            this.clear();
            if (!this._markersContainer) this.init();
            if (!this._markersContainer || !duration) return;

            segments.forEach(seg => {
                const startPct = (seg.start / duration) * 100;
                const widthPct = Math.max(((seg.end - seg.start) / duration) * 100, 0.6);
                
                if (startPct > 100) return;

                const marker = document.createElement('div');
                marker.className = `skip-intro-marker skip-intro-marker-${seg.type}`;
                marker.style.left = `${Math.min(startPct, 99)}%`;
                marker.style.width = `${Math.min(widthPct, 100 - startPct)}%`;
                
                this._markersContainer.appendChild(marker);
                this._markers.push({ seg, element: marker });
            });
        },

        highlight(activeSeg) {
            this._markers.forEach(m => {
                if (activeSeg && m.seg.type === activeSeg.type && Math.abs(m.seg.start - activeSeg.start) < 2) {
                    m.element.classList.add('active');
                } else {
                    m.element.classList.remove('active');
                }
            });
        },

        clear() {
            if (this._markersContainer) this._markersContainer.innerHTML = '';
            this._markers = [];
        }
    };

    // ===== УВЕДОМЛЕНИЯ =====
    const Notification = {
        _el: null,
        _timer: null,

        show(text, badge) {
            this.hide();
            const el = document.createElement('div');
            el.className = 'skip-intro-notification';
            el.innerHTML = `⏭ <b>${text}</b> <span style="opacity:0.6;font-size:12px;margin-left:8px;">${badge}</span>`;
            document.body.appendChild(el);
            this._el = el;

            requestAnimationFrame(() => el.classList.add('show'));
            this._timer = setTimeout(() => this.hide(), CONFIG.NOTIFICATION_DURATION);
        },

        hide() {
            if (this._timer) clearTimeout(this._timer);
            if (this._el) {
                const temp = this._el;
                temp.classList.remove('show');
                setTimeout(() => temp.parentNode && temp.parentNode.removeChild(temp), 300);
                this._el = null;
            }
        }
    };

    // ===== ЗАПРОСЫ К API =====
    const ApiClient = {
        _fetch(url) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = 4000;
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try { resolve(JSON.parse(xhr.responseText)); } catch(e) { reject(e); }
                    } else { resolve(null); }
                };
                xhr.onerror = () => reject();
                xhr.ontimeout = () => reject();
                xhr.send();
            });
        },

        async load(tmdbId, imdbId, season, episode) {
            const cached = Cache.get(tmdbId, season, episode);
            if (cached) return cached;

            const segments = [];
            
            // 1. Запрос к TheIntroDB
            try {
                const url = `${CONFIG.THEINTRODB_URL}?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
                const data = await this._fetch(url);
                if (data) {
                    ['intro', 'recap', 'credits'].forEach(type => {
                        if (Array.isArray(data[type])) {
                            data[type].forEach(item => {
                                const start = item.start || (item.start_ms / 1000);
                                const end = item.end || (item.end_ms / 1000);
                                if (end > start) segments.push({ type, start, end });
                            });
                        }
                    });
                }
            } catch(e) {}

            if (segments.length) {
                Cache.set(tmdbId, season, episode, segments);
                return segments;
            }

            // 2. Резервный запрос к IntroDB.app
            try {
                const [intro, credits] = await Promise.all([
                    this._fetch(`${CONFIG.API_URL}/get_intros?tmdb=${tmdbId}&season=${season}&episode=${episode}`).catch(() => null),
                    this._fetch(`${CONFIG.API_URL}/get_credits?tmdb=${tmdbId}&season=${season}&episode=${episode}`).catch(() => null)
                ]);
                if (intro && intro.start) segments.push({ type: 'intro', start: Math.round(intro.start), end: Math.round(intro.end) });
                if (credits && credits.start) segments.push({ type: 'credits', start: Math.round(credits.start), end: Math.round(credits.end) });
            } catch(e) {}

            if (segments.length) {
                Cache.set(tmdbId, season, episode, segments);
            }
            return segments;
        }
    };

    // ===== ДЕТЕКЦИЯ ПО СУБТИТРАМ (БЭКАП ДЛЯ ТОРРЕНТОВ) =====
    const SubtitleDetector = {
        detect(video, duration) {
            return new Promise((resolve) => {
                try {
                    if (video.textTracks && video.textTracks.length) {
                        for (let i = 0; i < video.textTracks.length; i++) {
                            const track = video.textTracks[i];
                            if (track.cues && track.cues.length > CONFIG.MIN_SUBTITLES) {
                                resolve(this._analyze(track.cues, duration));
                                return;
                            }
                        }
                    }
                    resolve([]);
                } catch(e) { resolve([]); }
            });
        },

        _analyze(cues, duration) {
            const arr = [];
            for (let i = 0; i < cues.length; i++) {
                arr.push({ start: cues[i].startTime, end: cues[i].endTime });
            }
            arr.sort((a, b) => a.start - b.start);
            
            const segments = [];
            if (arr.length && arr[0].start >= 15 && arr[0].start <= CONFIG.INTRO_MAX_START) {
                segments.push({ type: 'intro', start: 0, end: Math.round(arr[0].start) });
            }
            return segments;
        }
    };

    // ===== ЯДРО ПЛАГИНА =====
    const SkipIntroPlugin = {
        _segments: [],
        _activeSegment: null,
        _lastSkipped: null,
        _currentData: null,
        _initialized: false,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            PluginSettings.initSettings();

            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._cleanup());
            
            if (Lampa.PlayerVideo && Lampa.PlayerVideo.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', (data) => this._onTimeUpdate(data));
            }
        },

        _onStart(data) {
            this._cleanup();
            if (!PluginSettings.isEnabled()) return;

            // ===== ПРОВЕРКА НА ТОРРЕНТ =====
            // Если в объекте запуска нет признаков торрента — полностью выходим
            const isTorrent = data.torrent || data.hash || 
                (data.url && (
                    data.url.includes('127.0.0.1') || 
                    data.url.includes('localhost') || 
                    data.url.includes(':8090') || 
                    (data.url.includes('play') && data.url.includes('index='))
                ));

            if (!isTorrent) {
                console.log('[SkipIntro] Not a torrent. Plugin disabled for online stream.');
                return;
            }

            const meta = this._extractMeta(data);
            if (!meta.tmdb_id || meta.season == null || meta.episode == null) return;

            this._currentData = data;

            ApiClient.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode)
                .then(segments => {
                    if (this._currentData !== data) return;
                    this._segments = segments || [];
                    
                    this._waitForDurationAndDraw();
                });
        },

        _waitForDurationAndDraw() {
            let attempts = 0;
            const check = () => {
                attempts++;
                let video = null;
                try { video = Lampa.PlayerVideo.video(); } catch(e) {}
                
                if (video && video.duration) {
                    ProgressMarker.update(this._segments, video.duration);
                    
                    // Если из API ничего не пришло, пробуем легкие субтитры
                    if (!this._segments.length) {
                        SubtitleDetector.detect(video, video.duration).then(subSegs => {
                            if (subSegs.length && this._segments.length === 0) {
                                this._segments = subSegs;
                                ProgressMarker.update(this._segments, video.duration);
                            }
                        });
                    }
                } else if (attempts < 15) {
                    setTimeout(check, 500);
                }
            };
            check();
        },

        _onTimeUpdate(data) {
            if (!this._segments.length) return;

            let current = data.current;
            try {
                const nativeVideo = Lampa.PlayerVideo.video();
                if (nativeVideo && Utils.isNumeric(nativeVideo.currentTime)) {
                    current = nativeVideo.currentTime;
                }
            } catch(e) {}

            if (!Utils.isNumeric(current)) return;

            const segment = Utils.findSegment(this._segments, current);
            ProgressMarker.highlight(segment);

            if (segment) {
                if (!PluginSettings.isTypeEnabled(segment.type)) return;
                if (this._lastSkipped === segment) return;

                if (this._activeSegment !== segment) {
                    this._activeSegment = segment;
                    if (PluginSettings.isAutoSkip()) {
                        this._doSkip(segment);
                    }
                }
            } else {
                this._activeSegment = null;
            }
        },

        _doSkip(segment) {
            this._lastSkipped = segment;
            this._activeSegment = null;

            const labels = { intro: 'Заставка', recap: 'Ранее', credits: 'Титры' };
            const label = labels[segment.type] || 'Фрагмент';
            const duration = Math.round(segment.end - segment.start);

            Notification.show(`${label} пропущена`, `${duration}с ⚡`);

            try {
                const video = Lampa.PlayerVideo.video();
                if (video) {
                    video.currentTime = Math.min(segment.end, video.duration || segment.end);
                }
            } catch(e) {}
        },

        _cleanup() {
            this._segments = [];
            this._activeSegment = null;
            this._lastSkipped = null;
            this._currentData = null;
            Notification.hide();
            ProgressMarker.clear();
        }
    };

    // ===== СТАРТ =====
    function initPlugin() {
        if (window.Lampa && Lampa.SettingsApi && Lampa.Player) {
            SkipIntroPlugin.init();
        } else {
            setTimeout(initPlugin, 500);
        }
    }

    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', (data) => {
            if (data.type === 'ready') initPlugin();
        });
    }
    setTimeout(initPlugin, 1000);
}();
