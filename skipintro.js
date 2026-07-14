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
        INTRO_MAX_START: 150,
        INTRO_MAX_END: 300,
        CREDITS_MIN_GAP: 30,
        MIN_SUBTITLES: 5,
        AUTO_SKIP_DELAY: 4000,
        AUDIO_SAMPLE_INTERVAL: 500,
        AUDIO_MAX_TIME: 420,
        AUDIO_MIN_SAMPLES: 20,
        ENERGY_THRESHOLD_MULTIPLIER: 1.3,
        ENERGY_MIN_THRESHOLD: 0.8,
        MIN_ENERGY_PEAK_DURATION: 15,
        MAX_ENERGY_PEAK_DURATION: 150,
        MIN_ENERGY_SAMPLES: 10,
        NOTIFICATION_DURATION: 3000,
        DEBUG_MODE: true // Включен режим отладки
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

        isNumeric(val) {
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        },

        findSegment(segments, time) {
            for (let i = 0, len = segments.length; i < len; i++) {
                const seg = segments[i];
                if (time >= seg.start && time < seg.end) return seg;
                if (seg.start > time) break;
            }
            return null;
        },

        parseHDrezkaTitle(title) {
            if (!title) return null;
            
            let match = title.match(/(\d+)\s*сезон\s*(\d+)\s*серия/i);
            if (match) {
                return { season: parseInt(match[1]), episode: parseInt(match[2]) };
            }
            match = title.match(/Сезон\s*(\d+)\s*Серия\s*(\d+)/i);
            if (match) {
                return { season: parseInt(match[1]), episode: parseInt(match[2]) };
            }
            match = title.match(/[Ss](\d+)[Ee](\d+)/);
            if (match) {
                return { season: parseInt(match[1]), episode: parseInt(match[2]) };
            }
            match = title.match(/(\d+)x(\d+)/);
            if (match) {
                return { season: parseInt(match[1]), episode: parseInt(match[2]) };
            }
            match = title.match(/Season\s*(\d+)\s*Episode\s*(\d+)/i);
            if (match) {
                return { season: parseInt(match[1]), episode: parseInt(match[2]) };
            }
            return null;
        },

        getSourceType() {
            try {
                const url = Lampa.Player.getUrl ? Lampa.Player.getUrl() : '';
                if (url.includes('torrent') || url.includes('.torrent') || url.includes('magnet')) {
                    return 'torrent';
                }
                if (url.includes('hdrezka') || url.includes('rezka') || url.includes('hd.rezka') || url.includes('kinobase')) {
                    return 'hdrezka';
                }
                if (document.querySelector('.hdrezka-player, .rezka-player')) {
                    return 'hdrezka';
                }
                return 'other';
            } catch(e) {
                return 'unknown';
            }
        },

        getTMDBId() {
            try {
                const activity = Lampa.Activity.active();
                if (activity) {
                    if (activity.card && activity.card.id) return activity.card.id;
                    if (activity.movie && activity.movie.id) return activity.movie.id;
                }
                
                const current = Lampa.Storage.get('current', null);
                if (current && current.id) return current.id;
                
                const url = window.location.href;
                const match = url.match(/[?&]id=(\d+)/);
                if (match) return match[1];
                
                const meta = document.querySelector('meta[property="og:url"]');
                if (meta) {
                    const m = meta.content.match(/\/(\d+)(?:-|$)/);
                    if (m) return m[1];
                }
                
                return null;
            } catch(e) {
                return null;
            }
        },

        getSeasonEpisode(data) {
            let season = null;
            let episode = null;
            
            try {
                if (data.season != null) season = parseInt(data.season);
                if (data.episode != null) episode = parseInt(data.episode);
                
                if (data.playlist && Array.isArray(data.playlist)) {
                    const url = data.url;
                    for (let i = 0; i < data.playlist.length; i++) {
                        const item = data.playlist[i];
                        if (item.url === url || i === 0) {
                            const fields = ['season', 'episode', 's', 'e', 'season_num', 'episode_num', 'season_number', 'episode_number', 'season_index', 'episode_index'];
                            fields.forEach(f => {
                                if (item[f] != null) {
                                    if (f.includes('season') && season == null) season = parseInt(item[f]);
                                    if (f.includes('episode') && episode == null) episode = parseInt(item[f]);
                                }
                            });
                        }
                        if (item.url === url) break;
                    }
                }
                
                if (data.title) {
                    const parsed = this.parseHDrezkaTitle(data.title);
                    if (parsed) {
                        if (season == null) season = parsed.season;
                        if (episode == null) episode = parsed.episode;
                    }
                }
                
                if (data.file && data.file.title) {
                    const parsed = this.parseHDrezkaTitle(data.file.title);
                    if (parsed) {
                        if (season == null) season = parsed.season;
                        if (episode == null) episode = parsed.episode;
                    }
                }
                
                if (season == null || episode == null) {
                    const url = Lampa.Player.getUrl ? Lampa.Player.getUrl() : '';
                    const match = url.match(/[Ss](\d+)[Ee](\d+)/i);
                    if (match) {
                        if (season == null) season = parseInt(match[1]);
                        if (episode == null) episode = parseInt(match[2]);
                    }
                }
                
                if (season == null || episode == null) {
                    try {
                        const activity = Lampa.Activity.active();
                        if (activity && activity.movie) {
                            const movie = activity.movie;
                            if (movie.season != null && season == null) season = parseInt(movie.season);
                            if (movie.episode != null && episode == null) episode = parseInt(movie.episode);
                        }
                    } catch(e) {}
                }
                
                return { season, episode };
            } catch(e) {
                return { season: null, episode: null };
            }
        },

        isSeries(data) {
            try {
                if (data.is_series === true) return true;
                if (data.series === true) return true;
                
                const card = data.card || null;
                if (card) {
                    if (card.name && !card.title) return true;
                    if (card.number_of_seasons) return true;
                    if (card.first_air_date) return true;
                    if (card.seasons) return true;
                }
                
                const activity = Lampa.Activity.active();
                if (activity) {
                    const movie = activity.movie || activity.card;
                    if (movie) {
                        if (movie.name && !movie.title) return true;
                        if (movie.number_of_seasons) return true;
                        if (movie.seasons) return true;
                    }
                }
                
                const se = this.getSeasonEpisode(data);
                if (se.season != null && se.episode != null) return true;
                
                return false;
            } catch(e) {
                return false;
            }
        }
    };

    // ===== ДЕБАГ ЛОГГЕР В ПЛЕЕРЕ =====
    const DebugLogger = {
        _element: null,
        _lines: [],
        _maxLines: 8,
        _visible: false,

        init() {
            if (!CONFIG.DEBUG_MODE) return;
            
            this._injectStyles();
            this._createElement();
            
            // Показываем/скрываем по двойному нажатию
            document.addEventListener('keydown', (e) => {
                if (e.key === 'd' || e.key === 'D') {
                    this.toggle();
                }
            });
            
            this.log('🐛 Режим отладки включен');
            this.log('Нажмите D для показа/скрытия');
        },

        _injectStyles() {
            if (document.getElementById('skip-intro-debug-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-debug-styles';
            style.textContent = `
                .skip-intro-debug {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    right: 20px;
                    max-width: 600px;
                    background: rgba(0, 0, 0, 0.92);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 12px 16px;
                    z-index: 999999;
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 12px;
                    line-height: 1.6;
                    color: #00ff88;
                    opacity: 0;
                    transform: translateY(20px);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    pointer-events: none;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
                    max-height: 300px;
                    overflow: hidden;
                }
                .skip-intro-debug.show {
                    opacity: 1;
                    transform: translateY(0);
                    pointer-events: auto;
                }
                .skip-intro-debug .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    font-size: 10px;
                    color: rgba(255,255,255,0.4);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .skip-intro-debug .header .close {
                    cursor: pointer;
                    color: rgba(255,255,255,0.3);
                    transition: color 0.2s;
                    font-size: 14px;
                }
                .skip-intro-debug .header .close:hover {
                    color: #ff6b6b;
                }
                .skip-intro-debug .log-line {
                    padding: 2px 0;
                    opacity: 0;
                    animation: skip-intro-log-fade 0.3s ease forwards;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .skip-intro-debug .log-line .time {
                    color: rgba(255,255,255,0.3);
                    margin-right: 8px;
                    font-size: 10px;
                }
                .skip-intro-debug .log-line.error {
                    color: #ff6b6b;
                }
                .skip-intro-debug .log-line.warn {
                    color: #ffd93d;
                }
                .skip-intro-debug .log-line.success {
                    color: #6bcb6b;
                }
                .skip-intro-debug .log-line.info {
                    color: #6bc5ff;
                }
                .skip-intro-debug .log-line.highlight {
                    color: #ff6bff;
                    font-weight: bold;
                }
                .skip-intro-debug .scroll-area {
                    max-height: 240px;
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.1) transparent;
                }
                .skip-intro-debug .scroll-area::-webkit-scrollbar {
                    width: 4px;
                }
                .skip-intro-debug .scroll-area::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                }
                .skip-intro-debug .hint {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    color: rgba(255,255,255,0.15);
                    font-size: 10px;
                    font-family: monospace;
                    z-index: 999998;
                    opacity: 0;
                    transition: opacity 0.5s;
                }
                .skip-intro-debug .hint.show {
                    opacity: 1;
                }
                @keyframes skip-intro-log-fade {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @media (max-width: 720px) {
                    .skip-intro-debug {
                        left: 10px;
                        right: 10px;
                        bottom: 10px;
                        font-size: 11px;
                        padding: 10px 12px;
                    }
                }
            `;
            document.head.appendChild(style);
        },

        _createElement() {
            const el = document.createElement('div');
            el.className = 'skip-intro-debug';
            el.innerHTML = `
                <div class="header">
                    <span>🐛 SkipIntro Debug</span>
                    <span class="close" id="skip-intro-debug-close">✕</span>
                </div>
                <div class="scroll-area" id="skip-intro-debug-logs"></div>
            `;
            document.body.appendChild(el);
            this._element = el;
            
            // Закрытие
            const closeBtn = el.querySelector('#skip-intro-debug-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.hide());
            }
            
            // Хинт
            const hint = document.createElement('div');
            hint.className = 'skip-intro-debug hint';
            hint.textContent = 'Нажмите D для отладки';
            document.body.appendChild(hint);
            setTimeout(() => hint.classList.add('show'), 2000);
            setTimeout(() => hint.classList.remove('show'), 6000);
            
            this._hint = hint;
        },

        log(message, type = 'info') {
            if (!CONFIG.DEBUG_MODE) return;
            
            const time = new Date().toLocaleTimeString();
            const line = { message, type, time };
            
            this._lines.push(line);
            if (this._lines.length > this._maxLines * 2) {
                this._lines = this._lines.slice(-this._maxLines * 2);
            }
            
            this._render();
        },

        _render() {
            if (!this._element) return;
            
            const container = this._element.querySelector('#skip-intro-debug-logs');
            if (!container) return;
            
            const visibleLines = this._lines.slice(-this._maxLines);
            container.innerHTML = visibleLines.map(line => `
                <div class="log-line ${line.type}">
                    <span class="time">${line.time}</span>
                    ${line.message}
                </div>
            `).join('');
            
            // Автоскролл
            container.scrollTop = container.scrollHeight;
        },

        show() {
            if (!this._element) return;
            this._element.classList.add('show');
            this._visible = true;
        },

        hide() {
            if (!this._element) return;
            this._element.classList.remove('show');
            this._visible = false;
        },

        toggle() {
            if (this._visible) {
                this.hide();
            } else {
                this.show();
            }
        },

        clear() {
            this._lines = [];
            this._render();
        },

        destroy() {
            if (this._element) {
                this._element.parentNode.removeChild(this._element);
                this._element = null;
            }
            if (this._hint) {
                this._hint.parentNode.removeChild(this._hint);
                this._hint = null;
            }
        }
    };

    // ===== УПРАВЛЕНИЕ ПЛАГИНОМ =====
    const PluginSettings = {
        isEnabled() {
            return Utils.getStorage('skip_intro_enabled', true) !== false;
        },

        isAutoSkip() {
            return Utils.getStorage('skip_intro_auto', true) !== false;
        },

        isDetectEnabled() {
            return Utils.getStorage('skip_intro_detect', true) !== false;
        },

        isTypeEnabled(type) {
            return Utils.getStorage(`skip_intro_type_${type}`, true) !== false;
        },

        initSettings() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });

            const params = [
                { name: 'skip_intro_enabled', type: 'trigger', default: true, label: 'Включить плагин', desc: 'Показывать уведомления о пропуске' },
                { name: 'skip_intro_auto', type: 'trigger', default: true, label: 'Автопропуск', desc: 'Автоматически пропускать заставки' },
                { name: 'skip_intro_detect', type: 'trigger', default: true, label: 'Умное обнаружение', desc: 'Определять по субтитрам и звуку' },
                { name: 'skip_intro_type_intro', type: 'trigger', default: true, label: 'Пропускать заставку (intro)' },
                { name: 'skip_intro_type_recap', type: 'trigger', default: true, label: 'Пропускать рекап (recap)' },
                { name: 'skip_intro_type_credits', type: 'trigger', default: true, label: 'Пропускать титры (credits)' },
                { name: 'skip_intro_type_preview', type: 'trigger', default: false, label: 'Пропускать превью (preview)' }
            ];

            params.forEach(p => {
                Lampa.SettingsApi.addParam({
                    component: 'skip_intro',
                    param: { name: p.name, type: p.type, default: p.default },
                    field: { name: p.label, description: p.desc || '' }
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
            data[key] = {
                segments: segments,
                _ts: Date.now()
            };
            this._save();
        },

        clear() {
            this._data = {};
            this._save();
        },

        _smartKey: 'skip_intro_smart',
        hasSkipped(tmdbId, type) {
            try {
                const data = Lampa.Storage.get(this._smartKey, '{}');
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                return parsed[`${tmdbId}_${type}`] === true;
            } catch(e) {
                return false;
            }
        },

        rememberSkip(tmdbId, type) {
            try {
                let data = Lampa.Storage.get(this._smartKey, '{}');
                data = typeof data === 'string' ? JSON.parse(data) : data;
                data[`${tmdbId}_${type}`] = true;
                Lampa.Storage.set(this._smartKey, JSON.stringify(data));
            } catch(e) {}
        },

        forgetSkip(tmdbId, type) {
            try {
                let data = Lampa.Storage.get(this._smartKey, '{}');
                data = typeof data === 'string' ? JSON.parse(data) : data;
                delete data[`${tmdbId}_${type}`];
                Lampa.Storage.set(this._smartKey, JSON.stringify(data));
            } catch(e) {}
        }
    };

    // ===== ВИЗУАЛЬНАЯ РАЗМЕТКА ПРОГРЕСС-БАРА =====
    const ProgressMarker = {
        _container: null,
        _markersContainer: null,
        _markers: [],
        _colors: {
            intro: '#4CAF50',
            recap: '#FF9800',
            credits: '#2196F3',
            preview: '#9C27B0'
        },
        _typeNames: {
            intro: 'Заставка',
            recap: 'Рекап',
            credits: 'Титры',
            preview: 'Превью'
        },

        init() {
            this._findProgressBar();
        },

        _findProgressBar() {
            const selectors = [
                '.player-progress',
                '.video-progress',
                '.progress-bar',
                '.progress',
                '.seek-bar',
                '.timeline',
                '.player-timeline',
                '[class*="progress"]',
                '[class*="timeline"]'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    this._container = el;
                    break;
                }
            }

            if (!this._container) {
                try {
                    const player = document.querySelector('.player');
                    if (player) {
                        const progress = player.querySelector('[class*="progress"]') || 
                                       player.querySelector('[class*="timeline"]');
                        if (progress) this._container = progress;
                    }
                } catch(e) {}
            }

            if (!this._container) return;

            let markersContainer = this._container.querySelector('.skip-intro-markers');
            if (!markersContainer) {
                markersContainer = document.createElement('div');
                markersContainer.className = 'skip-intro-markers';
                markersContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 10;
                    overflow: visible;
                `;
                this._container.style.position = 'relative';
                this._container.appendChild(markersContainer);
            }
            this._markersContainer = markersContainer;
            
            this._injectStyles();
        },

        _injectStyles() {
            if (document.getElementById('skip-intro-marker-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-marker-styles';
            style.textContent = `
                .skip-intro-marker {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    height: 70%;
                    border-radius: 3px;
                    transition: all 0.3s ease;
                    pointer-events: none;
                    min-width: 4px;
                    opacity: 0.6;
                    z-index: 5;
                }
                .skip-intro-marker-intro {
                    background: linear-gradient(180deg, rgba(76, 175, 80, 0.8), rgba(76, 175, 80, 0.3));
                    border: 1px solid rgba(76, 175, 80, 0.5);
                }
                .skip-intro-marker-recap {
                    background: linear-gradient(180deg, rgba(255, 152, 0, 0.8), rgba(255, 152, 0, 0.3));
                    border: 1px solid rgba(255, 152, 0, 0.5);
                }
                .skip-intro-marker-credits {
                    background: linear-gradient(180deg, rgba(33, 150, 243, 0.8), rgba(33, 150, 243, 0.3));
                    border: 1px solid rgba(33, 150, 243, 0.5);
                }
                .skip-intro-marker-preview {
                    background: linear-gradient(180deg, rgba(156, 39, 176, 0.8), rgba(156, 39, 176, 0.3));
                    border: 1px solid rgba(156, 39, 176, 0.5);
                }
                .skip-intro-marker.active {
                    opacity: 0.9 !important;
                    height: 100% !important;
                    animation: skip-intro-pulse 1s ease-in-out infinite;
                    box-shadow: 0 0 20px rgba(255,255,255,0.2);
                }
                @keyframes skip-intro-pulse {
                    0%, 100% { opacity: 0.6; transform: translateY(-50%) scaleY(1); }
                    50% { opacity: 1; transform: translateY(-50%) scaleY(1.2); }
                }
            `;
            document.head.appendChild(style);
        },

        clear() {
            if (this._markersContainer) {
                this._markersContainer.innerHTML = '';
            }
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
            marker.dataset.type = type;
            marker.dataset.start = start;
            marker.dataset.end = end;
            
            marker.style.cssText = `
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                left: ${startPercent}%;
                width: ${width}%;
                height: 70%;
                border-radius: 3px;
                transition: all 0.3s ease;
                pointer-events: none;
                min-width: 4px;
                opacity: 0.6;
                z-index: 5;
            `;
            
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
            
            const sorted = [...segments].sort((a, b) => a.start - b.start);
            sorted.forEach(seg => {
                this.addMarker(seg.start, seg.end, seg.type, duration);
            });
        },

        highlightActive(segment) {
            if (!this._markersContainer) return;
            
            const markers = this._markersContainer.querySelectorAll('.skip-intro-marker');
            markers.forEach((marker) => {
                const data = this._markers.find(m => m.element === marker);
                if (data && segment && data.type === segment.type && 
                    data.start === segment.start && data.end === segment.end) {
                    marker.classList.add('active');
                } else {
                    marker.classList.remove('active');
                }
            });
        },

        resetHighlights() {
            const markers = this._markersContainer?.querySelectorAll('.skip-intro-marker') || [];
            markers.forEach(m => m.classList.remove('active'));
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

        _injectStyles() {
            if (document.getElementById('skip-intro-notification-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-notification-styles';
            style.textContent = `
                .skip-intro-notification {
                    position: fixed;
                    top: 30px;
                    left: 50%;
                    transform: translateX(-50%) translateY(-20px);
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    color: #fff;
                    padding: 16px 40px;
                    border-radius: 12px;
                    font-size: 18px;
                    font-weight: 500;
                    z-index: 99999;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: system-ui, -apple-system, sans-serif;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                    text-align: center;
                    min-width: 200px;
                    max-width: 80vw;
                    letter-spacing: 0.3px;
                }
                .skip-intro-notification.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                    pointer-events: none;
                }
                .skip-intro-notification .icon {
                    display: inline-block;
                    margin-right: 12px;
                    font-size: 22px;
                }
                .skip-intro-notification .label {
                    display: inline-block;
                }
                .skip-intro-notification .badge {
                    display: inline-block;
                    margin-left: 10px;
                    font-size: 13px;
                    opacity: 0.6;
                    font-weight: 400;
                }
                .skip-intro-notification .progress-ring {
                    display: inline-block;
                    margin-left: 14px;
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255,255,255,0.2);
                    border-top-color: #4CAF50;
                    border-radius: 50%;
                    animation: skip-intro-spin 0.8s linear infinite;
                    vertical-align: middle;
                }
                @keyframes skip-intro-spin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 720px) {
                    .skip-intro-notification {
                        top: 20px;
                        padding: 12px 24px;
                        font-size: 15px;
                        min-width: 150px;
                    }
                }
            `;
            document.head.appendChild(style);
        },

        show(text, badge, showProgress) {
            this._injectStyles();
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

            requestAnimationFrame(() => {
                el.classList.add('show');
            });

            this._timer = setTimeout(() => {
                this.hide();
            }, CONFIG.NOTIFICATION_DURATION);
        },

        hide() {
            if (this._timer) {
                clearTimeout(this._timer);
                this._timer = null;
            }
            if (this._element) {
                this._element.classList.remove('show');
                setTimeout(() => {
                    if (this._element && this._element.parentNode) {
                        this._element.parentNode.removeChild(this._element);
                    }
                    this._element = null;
                }, 400);
            }
        },

        destroy() {
            this.hide();
        }
    };

    // ===== ДЕТЕКЦИЯ ПО СУБТИТРАМ =====
    const SubtitleDetector = {
        detect(video, duration) {
            return new Promise((resolve) => {
                try {
                    if (video.textTracks && video.textTracks.length) {
                        for (let i = 0; i < video.textTracks.length; i++) {
                            const track = video.textTracks[i];
                            if (track.cues && track.cues.length > CONFIG.MIN_SUBTITLES) {
                                const segments = this._analyzeCues(track.cues, duration);
                                if (segments.length) {
                                    resolve(segments);
                                    return;
                                }
                            }
                        }
                    }

                    const subs = Lampa.PlayerVideo && Lampa.PlayerVideo.subtitles ? 
                        Lampa.PlayerVideo.subtitles() : null;
                    if (subs && subs.length) {
                        for (let i = 0; i < subs.length; i++) {
                            if (subs[i].url) {
                                this._fetchSubtitle(subs[i].url, duration)
                                    .then(segments => resolve(segments))
                                    .catch(() => resolve([]));
                                return;
                            }
                        }
                    }
                    resolve([]);
                } catch(e) {
                    resolve([]);
                }
            });
        },

        _fetchSubtitle(url, duration) {
            return new Promise((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = CONFIG.DETECTION_TIMEOUT;
                xhr.ontimeout = () => resolve([]);
                xhr.onerror = () => resolve([]);
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
                        const segments = this._parseSrt(xhr.responseText, duration);
                        resolve(segments);
                    } else {
                        resolve([]);
                    }
                };
                xhr.send();
            });
        },

        _parseSrt(text, duration) {
            const cues = [];
            const lines = text.replace(/\r\n/g, '\n').split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const timeMatch = line.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/);
                if (timeMatch) {
                    const start = this._parseTime(timeMatch[1]);
                    const end = this._parseTime(timeMatch[2]);
                    if (end > start) {
                        cues.push({ start, end });
                    }
                }
            }

            return this._analyzeCues(cues, duration);
        },

        _parseTime(str) {
            const parts = str.match(/(\d+):(\d{2}):(\d{2})[.,](\d{3})/);
            if (!parts) return 0;
            return parseInt(parts[1]) * 3600 + 
                   parseInt(parts[2]) * 60 + 
                   parseInt(parts[3]) + 
                   parseInt(parts[4]) / 1000;
        },

        _analyzeCues(cues, duration) {
            if (cues.length < CONFIG.MIN_SUBTITLES) return [];

            cues.sort((a, b) => a.start - b.start);
            const segments = [];
            
            if (cues[0].start >= 15 && cues[0].start <= CONFIG.INTRO_MAX_START) {
                segments.push({
                    type: 'intro',
                    start: 0,
                    end: Math.round(cues[0].start),
                    _source: 'subs'
                });
            }

            let maxGap = 0;
            let introStart = 0;
            let introEnd = 0;
            
            for (let i = 0; i < cues.length - 1 && cues[i].end < CONFIG.INTRO_MAX_END; i++) {
                const gap = cues[i + 1].start - cues[i].end;
                if (gap >= 15 && gap <= CONFIG.INTRO_MAX_END && gap > maxGap) {
                    maxGap = gap;
                    introStart = Math.round(cues[i].end);
                    introEnd = Math.round(cues[i + 1].start);
                }
            }

            if (introStart && introEnd) {
                segments.push({
                    type: 'intro',
                    start: introStart,
                    end: introEnd,
                    _source: 'subs'
                });
            }

            if (duration > 600 && cues.length > 0) {
                const lastCue = cues[cues.length - 1];
                const gap = duration - lastCue.end;
                
                if (gap >= CONFIG.CREDITS_MIN_GAP) {
                    segments.push({
                        type: 'credits',
                        start: Math.round(lastCue.end),
                        end: Math.round(duration),
                        _source: 'subs'
                    });
                }

                const threshold = Math.max(0, duration - 600);
                let maxGap2 = 0;
                let creditsStart = 0;
                let creditsEnd = 0;

                for (let i = 0; i < cues.length - 1; i++) {
                    if (cues[i].end < threshold) continue;
                    const gap2 = cues[i + 1].start - cues[i].end;
                    if (gap2 >= CONFIG.CREDITS_MIN_GAP && gap2 > maxGap2) {
                        maxGap2 = gap2;
                        creditsStart = Math.round(cues[i].end);
                        creditsEnd = Math.round(cues[i + 1].start);
                    }
                }

                if (creditsStart && creditsEnd && maxGap2 > gap) {
                    segments.push({
                        type: 'credits',
                        start: creditsStart,
                        end: creditsEnd,
                        _source: 'subs'
                    });
                }
            }

            return segments;
        }
    };

    // ===== ДЕТЕКЦИЯ ПО ЗВУКУ =====
    const AudioDetector = {
        _context: null,
        _analyser: null,
        _source: null,
        _connected: false,
        _timer: null,
        _timeout: null,

        detect(video) {
            return new Promise((resolve) => {
                this._cleanup();

                try {
                    if (!window.AudioContext && !window.webkitAudioContext) {
                        resolve(null);
                        return;
                    }

                    if (!this._context || this._context.state === 'closed') {
                        this._context = new (window.AudioContext || window.webkitAudioContext)();
                    }

                    if (!this._connected || !this._analyser) {
                        this._source = this._context.createMediaElementSource(video);
                        this._analyser = this._context.createAnalyser();
                        this._analyser.fftSize = 1024;
                        this._source.connect(this._analyser);
                        this._analyser.connect(this._context.destination);
                        this._connected = true;
                    }

                    if (!this._analyser) {
                        resolve(null);
                        return;
                    }

                    const samples = [];
                    const data = new Uint8Array(this._analyser.frequencyBinCount);
                    const startTime = video.currentTime;

                    this._timer = setInterval(() => {
                        try {
                            const currentTime = video.currentTime;
                            if (currentTime - startTime > CONFIG.AUDIO_MAX_TIME) {
                                this._cleanup();
                                resolve(this._analyze(samples));
                                return;
                            }

                            this._analyser.getByteFrequencyData(data);
                            let sum = 0;
                            for (let i = 0; i < data.length; i++) {
                                sum += data[i];
                            }
                            samples.push({
                                time: currentTime,
                                energy: sum / data.length
                            });
                        } catch(e) {
                            this._cleanup();
                            resolve(null);
                        }
                    }, CONFIG.AUDIO_SAMPLE_INTERVAL);

                    this._timeout = setTimeout(() => {
                        this._cleanup();
                        resolve(this._analyze(samples));
                    }, CONFIG.AUDIO_MAX_TIME * 1000);

                } catch(e) {
                    this._cleanup();
                    resolve(null);
                }
            });
        },

        _analyze(samples) {
            if (samples.length < CONFIG.AUDIO_MIN_SAMPLES) return null;

            const smoothed = [];
            for (let i = 2; i < samples.length - 2; i++) {
                const avg = (samples[i-2].energy + samples[i-1].energy + samples[i].energy + 
                            samples[i+1].energy + samples[i+2].energy) / 5;
                smoothed.push({
                    time: samples[i].time,
                    energy: avg
                });
            }

            if (smoothed.length < CONFIG.MIN_ENERGY_SAMPLES) return null;

            const energies = smoothed.map(s => s.energy).sort((a, b) => a - b);
            const median = energies[Math.floor(energies.length / 2)];
            const threshold = median * CONFIG.ENERGY_THRESHOLD_MULTIPLIER;
            const minThreshold = median * CONFIG.ENERGY_MIN_THRESHOLD;

            let peakStart = null;
            let peakCount = 0;
            let peakEnd = null;

            for (let i = 0; i < smoothed.length; i++) {
                const sample = smoothed[i];
                if (sample.time > CONFIG.INTRO_MAX_END) break;

                if (sample.energy > threshold) {
                    if (!peakStart) {
                        peakStart = sample.time;
                        peakCount = 1;
                    } else {
                        peakCount++;
                    }
                } else if (peakStart && sample.energy < minThreshold) {
                    const duration = sample.time - peakStart;
                    if (duration >= CONFIG.MIN_ENERGY_PEAK_DURATION && 
                        duration <= CONFIG.MAX_ENERGY_PEAK_DURATION && 
                        peakCount >= CONFIG.MIN_ENERGY_SAMPLES) {
                        peakEnd = sample.time;
                        break;
                    }
                    peakStart = null;
                    peakCount = 0;
                }
            }

            if (peakStart && peakEnd) {
                return {
                    type: 'intro',
                    start: Math.round(peakStart),
                    end: Math.round(peakEnd),
                    _source: 'audio'
                };
            }

            return null;
        },

        _cleanup() {
            if (this._timer) {
                clearInterval(this._timer);
                this._timer = null;
            }
            if (this._timeout) {
                clearTimeout(this._timeout);
                this._timeout = null;
            }
        },

        destroy() {
            this._cleanup();
            try {
                if (this._source) {
                    this._source.disconnect();
                    this._source = null;
                }
                if (this._analyser) {
                    this._analyser.disconnect();
                    this._analyser = null;
                }
                if (this._context && this._context.state !== 'closed') {
                    this._context.close();
                    this._context = null;
                }
                this._connected = false;
            } catch(e) {}
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
                            try {
                                resolve(JSON.parse(xhr.responseText));
                            } catch(e) {
                                reject(e);
                            }
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
            if (cached) {
                DebugLogger.log(`📦 Кэш: ${cached.length} сегментов`, 'success');
                return cached;
            }

            try {
                DebugLogger.log(`🔍 Запрос к TheIntroDB...`, 'info');
                const url = `${CONFIG.THEINTRODB_URL}?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
                const data = await this._fetch(url);
                const segments = this._parseTheIntroDB(data);
                if (segments.length) {
                    Cache.set(tmdbId, season, episode, segments);
                    DebugLogger.log(`✅ TheIntroDB: ${segments.length} сегментов`, 'success');
                    return segments;
                }
                DebugLogger.log(`❌ TheIntroDB: ничего не найдено`, 'warn');
            } catch(e) {
                DebugLogger.log(`❌ TheIntroDB ошибка: ${e.message}`, 'error');
            }

            try {
                DebugLogger.log(`🔍 Запрос к IntroDB...`, 'info');
                const url1 = `${CONFIG.API_URL}/get_intros?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
                const url2 = `${CONFIG.API_URL}/get_credits?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
                const [intro, credits] = await Promise.all([
                    this._fetch(url1).catch(() => null),
                    this._fetch(url2).catch(() => null)
                ]);
                
                const segments = [];
                if (intro && intro.start && intro.end) {
                    segments.push({
                        type: 'intro',
                        start: Math.round(intro.start),
                        end: Math.round(intro.end)
                    });
                }
                if (credits && credits.start && credits.end) {
                    segments.push({
                        type: 'credits',
                        start: Math.round(credits.start),
                        end: Math.round(credits.end)
                    });
                }
                if (segments.length) {
                    Cache.set(tmdbId, season, episode, segments);
                    DebugLogger.log(`✅ IntroDB: ${segments.length} сегментов`, 'success');
                    return segments;
                }
                DebugLogger.log(`❌ IntroDB: ничего не найдено`, 'warn');
            } catch(e) {
                DebugLogger.log(`❌ IntroDB ошибка: ${e.message}`, 'error');
            }

            if (imdbId) {
                try {
                    DebugLogger.log(`🔍 Запрос к IntroHater...`, 'info');
                    const url = `https://introhater.com/api/segments/${imdbId}:${season}:${episode}`;
                    const data = await this._fetch(url);
                    const segments = this._parseIntroHater(data);
                    if (segments.length) {
                        Cache.set(tmdbId, season, episode, segments);
                        DebugLogger.log(`✅ IntroHater: ${segments.length} сегментов`, 'success');
                        return segments;
                    }
                    DebugLogger.log(`❌ IntroHater: ничего не найдено`, 'warn');
                } catch(e) {
                    DebugLogger.log(`❌ IntroHater ошибка: ${e.message}`, 'error');
                }
            }

            DebugLogger.log(`⚠️ Ни один API не вернул данные`, 'warn');
            return [];
        },

        _parseTheIntroDB(data) {
            const segments = [];
            if (!data) return segments;
            
            const types = ['intro', 'recap', 'credits', 'preview'];
            types.forEach(type => {
                const items = data[type];
                if (Array.isArray(items)) {
                    items.forEach(item => {
                        const start = item.start_ms ? item.start_ms / 1000 : (item.start || 0);
                        const end = item.end_ms ? item.end_ms / 1000 : (item.end || 0);
                        if (end > start) {
                            segments.push({ type, start, end });
                        }
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
                    
                    segments.push({
                        type,
                        start: Math.round(item.start),
                        end: Math.round(item.end)
                    });
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
        _detecting: false,
        _initialized: false,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            // Инициализируем дебаг логгер
            DebugLogger.init();

            PluginSettings.initSettings();
            ProgressMarker.init();

            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());
            
            if (Lampa.PlayerVideo && Lampa.PlayerVideo.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', 
                    Utils.throttle((data) => this._onTimeUpdate(data), 300)
                );
            }

            DebugLogger.log('🚀 Плагин инициализирован', 'success');
            DebugLogger.log('📺 Источник: ' + Utils.getSourceType(), 'info');
            DebugLogger.log('⌨️ Нажмите D для показа/скрытия логов', 'info');
        },

        _onStart(data) {
            this._cleanup();

            if (!PluginSettings.isEnabled()) {
                DebugLogger.log('⛔ Плагин отключен в настройках', 'warn');
                return;
            }

            DebugLogger.log('🎬 Событие start', 'info');
            DebugLogger.log('📊 Данные плеера:', 'info');

            // Логируем данные плеера
            try {
                DebugLogger.log(`  - title: ${data.title || 'нет'}`, 'info');
                DebugLogger.log(`  - url: ${data.url || 'нет'}`, 'info');
                DebugLogger.log(`  - season: ${data.season || 'нет'}`, 'info');
                DebugLogger.log(`  - episode: ${data.episode || 'нет'}`, 'info');
                if (data.playlist) {
                    DebugLogger.log(`  - playlist: ${data.playlist.length} элементов`, 'info');
                }
            } catch(e) {}

            const meta = this._extractMeta(data);
            
            DebugLogger.log('📋 Извлеченные метаданные:', 'highlight');
            DebugLogger.log(`  - TMDB ID: ${meta.tmdb_id || '❌ не найден'}`, meta.tmdb_id ? 'success' : 'error');
            DebugLogger.log(`  - IMDB ID: ${meta.imdb_id || 'нет'}`, 'info');
            DebugLogger.log(`  - Сезон: ${meta.season != null ? meta.season : '❌ не найден'}`, meta.season != null ? 'success' : 'error');
            DebugLogger.log(`  - Серия: ${meta.episode != null ? meta.episode : '❌ не найден'}`, meta.episode != null ? 'success' : 'error');
            DebugLogger.log(`  - Сериал: ${meta.is_series ? '✅ да' : '❌ нет'}`, meta.is_series ? 'success' : 'error');
            
            if (!meta.tmdb_id || !meta.is_series || meta.season == null || meta.episode == null) {
                DebugLogger.log('❌ Не удалось определить метаданные для HDrezka', 'error');
                DebugLogger.log('💡 Попробуйте вручную указать ID в настройках', 'warn');
                return;
            }

            this._currentData = data;
            this._currentTmdb = meta.tmdb_id;
            
            DebugLogger.log(`✅ Загружаем сегменты для S${meta.season}E${meta.episode} (TMDB: ${meta.tmdb_id})`, 'success');
            
            let apiDone = false;
            let detectDone = false;
            let apiSegments = [];
            let detectSegments = [];

            const mergeSegments = () => {
                if (!apiDone || !detectDone) return;
                if (this._currentData !== data) return;

                const merged = [...apiSegments];
                detectSegments.forEach(detSeg => {
                    let exists = false;
                    for (let i = 0; i < merged.length; i++) {
                        if (merged[i].type === detSeg.type) {
                            if (detSeg.start < merged[i].start) {
                                merged[i] = detSeg;
                            }
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) merged.push(detSeg);
                });

                this._segments = merged;
                this._updateProgressMarkers(merged);
                DebugLogger.log(`📊 Загружено ${merged.length} сегментов`, 'success');
                
                if (merged.length === 0) {
                    DebugLogger.log('⚠️ Сегменты не найдены. Попробуйте детекцию.', 'warn');
                } else {
                    merged.forEach((seg, i) => {
                        const typeNames = { intro: 'Заставка', recap: 'Рекап', credits: 'Титры', preview: 'Превью' };
                        DebugLogger.log(`  ${i+1}. ${typeNames[seg.type] || seg.type}: ${seg.start}с → ${seg.end}с (${seg.end - seg.start}с)`, 'info');
                    });
                }
            };

            DebugLogger.log('🌐 Запрос к API...', 'info');
            ApiClient.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode)
                .then(segments => {
                    if (this._currentData === data) {
                        apiSegments = segments || [];
                        apiDone = true;
                        if (apiSegments.length) {
                            this._segments = apiSegments;
                        }
                        mergeSegments();
                    }
                })
                .catch((err) => {
                    DebugLogger.log(`❌ Ошибка API: ${err.message}`, 'error');
                    apiDone = true;
                    mergeSegments();
                });

            if (PluginSettings.isDetectEnabled()) {
                DebugLogger.log('🔍 Запуск детекции...', 'info');
                this._runDetection(data, meta, (segments) => {
                    if (this._currentData === data && segments && segments.length) {
                        detectSegments = segments;
                        detectDone = true;
                        DebugLogger.log(`🔍 Детекция: найдено ${segments.length} сегментов`, 'success');
                        mergeSegments();
                    } else {
                        detectDone = true;
                        DebugLogger.log(`🔍 Детекция: ничего не найдено`, 'warn');
                        mergeSegments();
                    }
                });
            } else {
                DebugLogger.log('⏭️ Детекция отключена в настройках', 'warn');
                detectDone = true;
                mergeSegments();
            }
        },

        _extractMeta(data) {
            const meta = {
                tmdb_id: null,
                imdb_id: null,
                season: null,
                episode: null,
                is_series: false
            };

            // 1. Прямые данные
            if (data.tmdb_id) meta.tmdb_id = data.tmdb_id;
            if (data.imdb_id) meta.imdb_id = data.imdb_id;
            if (data.season != null) meta.season = parseInt(data.season);
            if (data.episode != null) meta.episode = parseInt(data.episode);

            // 2. Из card
            let card = data.card || null;
            if (!card) {
                try {
                    const activity = Lampa.Activity.active();
                    if (activity) {
                        card = activity.card || activity.movie || null;
                    }
                } catch(e) {}
            }

            if (card) {
                if (!meta.tmdb_id) meta.tmdb_id = card.id || null;
                if (!meta.imdb_id) meta.imdb_id = card.imdb_id || null;
                
                if (card.name && !card.title) meta.is_series = true;
                if (card.number_of_seasons) meta.is_series = true;
                if (card.first_air_date) meta.is_series = true;
                if (card.seasons) meta.is_series = true;
                
                if (meta.season == null && card.season != null) meta.season = parseInt(card.season);
                if (meta.episode == null && card.episode != null) meta.episode = parseInt(card.episode);
                if (meta.season == null && card.s != null) meta.season = parseInt(card.s);
                if (meta.episode == null && card.e != null) meta.episode = parseInt(card.e);
            }

            // 3. Из playlist
            if (data.playlist && Array.isArray(data.playlist)) {
                const url = data.url;
                for (let i = 0; i < data.playlist.length; i++) {
                    const item = data.playlist[i];
                    const itemUrl = typeof item.url === 'string' ? item.url : '';
                    
                    if (itemUrl === url || i === 0 || !url) {
                        const fields = ['season', 'episode', 's', 'e', 'season_num', 'episode_num', 'season_number', 'episode_number', 'season_index', 'episode_index'];
                        fields.forEach(f => {
                            if (item[f] != null) {
                                if (f.includes('season') && meta.season == null) {
                                    meta.season = parseInt(item[f]);
                                }
                                if (f.includes('episode') && meta.episode == null) {
                                    meta.episode = parseInt(item[f]);
                                }
                            }
                        });
                        
                        if (meta.season != null && meta.episode != null) {
                            meta.is_series = true;
                        }
                    }
                }
            }

            // 4. Из title
            if ((meta.season == null || meta.episode == null) && data.title) {
                const parsed = Utils.parseHDrezkaTitle(data.title);
                if (parsed) {
                    if (meta.season == null) meta.season = parsed.season;
                    if (meta.episode == null) meta.episode = parsed.episode;
                    if (meta.season != null && meta.episode != null) meta.is_series = true;
                }
            }

            // 5. Из file.title
            if ((meta.season == null || meta.episode == null) && data.file && data.file.title) {
                const parsed = Utils.parseHDrezkaTitle(data.file.title);
                if (parsed) {
                    if (meta.season == null) meta.season = parsed.season;
                    if (meta.episode == null) meta.episode = parsed.episode;
                    if (meta.season != null && meta.episode != null) meta.is_series = true;
                }
            }

            // 6. Из Activity
            if (!meta.tmdb_id || !meta.is_series) {
                try {
                    const activity = Lampa.Activity.active();
                    if (activity && activity.movie) {
                        const movie = activity.movie;
                        if (!meta.tmdb_id && movie.id) meta.tmdb_id = movie.id;
                        if (meta.season == null && movie.season != null) meta.season = parseInt(movie.season);
                        if (meta.episode == null && movie.episode != null) meta.episode = parseInt(movie.episode);
                        if (meta.season == null && movie.s != null) meta.season = parseInt(movie.s);
                        if (meta.episode == null && movie.e != null) meta.episode = parseInt(movie.e);
                        if (movie.name && !movie.title) meta.is_series = true;
                    }
                } catch(e) {}
            }

            // 7. Universal TMDB ID
            if (!meta.tmdb_id) {
                meta.tmdb_id = Utils.getTMDBId();
                if (meta.tmdb_id) meta.is_series = true;
            }

            // 8. Из URL
            if ((meta.season == null || meta.episode == null) || !meta.tmdb_id) {
                try {
                    const url = Lampa.Player.getUrl ? Lampa.Player.getUrl() : '';
                    
                    if (!meta.tmdb_id) {
                        const tmdbMatch = url.match(/[?&]tmdb_id=(\d+)/) || url.match(/\/tmdb\/(\d+)/);
                        if (tmdbMatch) meta.tmdb_id = tmdbMatch[1];
                    }
                    
                    const seMatch = url.match(/[Ss](\d+)[Ee](\d+)/i);
                    if (seMatch) {
                        if (meta.season == null) meta.season = parseInt(seMatch[1]);
                        if (meta.episode == null) meta.episode = parseInt(seMatch[2]);
                        meta.is_series = true;
                    }
                    
                    const hdMatch = url.match(/\/\d+-(\d+)-(\d+)/);
                    if (hdMatch && (meta.season == null || meta.episode == null)) {
                        if (meta.season == null) meta.season = parseInt(hdMatch[1]);
                        if (meta.episode == null) meta.episode = parseInt(hdMatch[2]);
                        meta.is_series = true;
                    }
                } catch(e) {}
            }

            // 9. Если есть сезон и серия - это сериал
            if (meta.season != null && meta.episode != null) {
                meta.is_series = true;
            }

            // 10. Fallback - из Storage
            if (!meta.tmdb_id || meta.season == null || meta.episode == null) {
                try {
                    const current = Lampa.Storage.get('current', null);
                    if (current) {
                        if (!meta.tmdb_id && current.id) meta.tmdb_id = current.id;
                        if (meta.season == null && current.season != null) meta.season = parseInt(current.season);
                        if (meta.episode == null && current.episode != null) meta.episode = parseInt(current.episode);
                        if (meta.season != null && meta.episode != null) meta.is_series = true;
                    }
                } catch(e) {}
            }

            return meta;
        },

        _runDetection(data, meta, callback) {
            if (this._detecting) {
                DebugLogger.log('⏳ Детекция уже запущена', 'warn');
                return;
            }
            this._detecting = true;

            const cached = Cache.get(meta.tmdb_id, meta.season, meta.episode);
            if (cached && cached.length) {
                this._detecting = false;
                DebugLogger.log(`📦 Кэш детекции: ${cached.length} сегментов`, 'success');
                callback(cached);
                return;
            }

            let video = null;
            try {
                video = Lampa.PlayerVideo.video();
            } catch(e) {}

            if (!video || !video.duration) {
                DebugLogger.log('⏳ Ожидание загрузки видео...', 'info');
                let attempts = 0;
                const checkVideo = () => {
                    attempts++;
                    try {
                        video = Lampa.PlayerVideo.video();
                    } catch(e) {}
                    
                    if (video && video.duration) {
                        DebugLogger.log(`✅ Видео загружено (${Math.round(video.duration)}с)`, 'success');
                        this._runDetectionInternal(video, meta, callback);
                    } else if (attempts < 20) {
                        setTimeout(checkVideo, 500);
                    } else {
                        DebugLogger.log('❌ Таймаут загрузки видео', 'error');
                        this._detecting = false;
                        callback([]);
                    }
                };
                checkVideo();
            } else {
                DebugLogger.log(`✅ Видео загружено (${Math.round(video.duration)}с)`, 'success');
                this._runDetectionInternal(video, meta, callback);
            }
        },

        _runDetectionInternal(video, meta, callback) {
            const duration = video.duration;
            DebugLogger.log('🔍 Детекция по субтитрам...', 'info');
            
            SubtitleDetector.detect(video, duration)
                .then(subSegments => {
                    if (subSegments && subSegments.length) {
                        Cache.set(meta.tmdb_id, meta.season, meta.episode, subSegments);
                        this._detecting = false;
                        DebugLogger.log(`✅ Субтитры: найдено ${subSegments.length} сегментов`, 'success');
                        callback(subSegments);
                        return;
                    }

                    DebugLogger.log('🔍 Детекция по звуку...', 'info');
                    AudioDetector.detect(video)
                        .then(audioSegment => {
                            this._detecting = false;
                            if (audioSegment) {
                                const segments = [audioSegment];
                                Cache.set(meta.tmdb_id, meta.season, meta.episode, segments);
                                DebugLogger.log(`✅ Звук: найден сегмент ${audioSegment.start}с → ${audioSegment.end}с`, 'success');
                                callback(segments);
                            } else {
                                DebugLogger.log('❌ Детекция не нашла сегментов', 'warn');
                                callback([]);
                            }
                        })
                        .catch(() => {
                            this._detecting = false;
                            DebugLogger.log('❌ Ошибка детекции звука', 'error');
                            callback([]);
                        });
                })
                .catch(() => {
                    this._detecting = false;
                    DebugLogger.log('❌ Ошибка детекции субтитров', 'error');
                    callback([]);
                });
        },

        _updateProgressMarkers(segments) {
            let duration = 0;
            try {
                const video = Lampa.PlayerVideo.video();
                if (video) duration = video.duration;
            } catch(e) {}
            
            if (duration > 0 && segments && segments.length) {
                ProgressMarker.updateMarkers(segments, duration);
                return;
            }
            
            if (!duration) {
                let attempts = 0;
                const checkDuration = () => {
                    attempts++;
                    try {
                        const video = Lampa.PlayerVideo.video();
                        if (video && video.duration) {
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
            
            if (segment) {
                ProgressMarker.highlightActive(segment);
            } else {
                ProgressMarker.resetHighlights();
            }
            
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
                        return;
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
            
            const labels = {
                intro: 'Заставка',
                recap: 'Рекап',
                credits: 'Титры',
                preview: 'Превью'
            };
            
            const label = labels[segment.type] || segment.type;
            const time = Math.round(segment.end - segment.start);
            
            DebugLogger.log(`⏭ ${label} пропущена (${time}с)${auto ? ' ⚡' : ''}`, 'highlight');
            
            Notification.show(
                `⏭ ${label} пропущена`,
                `${time}с${auto ? ' ⚡' : ''}`,
                false
            );
            
            try {
                const video = Lampa.PlayerVideo.video();
                if (video) {
                    const target = Math.min(segment.end, video.duration || segment.end);
                    video.currentTime = target;
                    
                    setTimeout(() => {
                        try {
                            if (video.paused) video.play();
                        } catch(e) {}
                    }, 100);
                }
            } catch(e) {
                DebugLogger.log(`❌ Ошибка перемотки: ${e.message}`, 'error');
            }
        },

        _cleanup() {
            this._segments = [];
            this._activeSegment = null;
            this._lastSkipped = null;
            this._currentData = null;
            this._currentTmdb = null;
            this._detecting = false;
            Notification.destroy();
            AudioDetector.destroy();
        },

        _onDestroy() {
            DebugLogger.log('🛑 Плеер уничтожен', 'info');
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

    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', (data) => {
            if (data.type === 'ready') initPlugin();
        });
    }

    setTimeout(initPlugin, 1000);

}();
