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
        INTRO_MAX_START: 180,
        INTRO_MAX_END: 350,
        CREDITS_MIN_GAP: 25,
        MIN_SUBTITLES: 5,
        AUTO_SKIP_DELAY: 3000,
        NOTIFICATION_DURATION: 3000,
        MIN_VIDEO_DURATION: 120,
        SEGMENT_OVERLAP_TOLERANCE: 5,
        MAX_SEGMENTS_PER_TYPE: 2
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

        debounce(fn, delay) {
            let timer = null;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
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

        mergeSegments(segments) {
            if (!segments || !segments.length) return [];
            
            const merged = [];
            const sorted = [...segments].sort((a, b) => a.start - b.start);
            
            for (const seg of sorted) {
                let added = false;
                for (let i = 0; i < merged.length; i++) {
                    const existing = merged[i];
                    if (existing.type === seg.type &&
                        Math.abs(existing.start - seg.start) < CONFIG.SEGMENT_OVERLAP_TOLERANCE &&
                        Math.abs(existing.end - seg.end) < CONFIG.SEGMENT_OVERLAP_TOLERANCE) {
                        existing.start = Math.min(existing.start, seg.start);
                        existing.end = Math.max(existing.end, seg.end);
                        added = true;
                        break;
                    }
                }
                if (!added) {
                    merged.push({ ...seg });
                }
            }
            
            return merged;
        },

        getVideoElement() {
            try {
                const video = Lampa.PlayerVideo.video();
                if (video && video.tagName === 'VIDEO') return video;
            } catch(e) {}
            
            const selectors = ['video', '.player video', '#player video', '[data-video]'];
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.tagName === 'VIDEO') return el;
            }
            return null;
        },

        getPlayerDuration() {
            try {
                const video = this.getVideoElement();
                if (video && video.duration && isFinite(video.duration)) {
                    return video.duration;
                }
            } catch(e) {}
            
            try {
                const duration = Lampa.PlayerVideo.duration();
                if (duration && isFinite(duration)) return duration;
            } catch(e) {}
            
            return 0;
        },

        getCurrentTime() {
            try {
                const video = this.getVideoElement();
                if (video && video.currentTime && isFinite(video.currentTime)) {
                    return video.currentTime;
                }
            } catch(e) {}
            
            try {
                const time = Lampa.PlayerVideo.time();
                if (time && isFinite(time)) return time;
            } catch(e) {}
            
            return 0;
        },

        seekTo(time) {
            try {
                const video = this.getVideoElement();
                if (video && isFinite(time)) {
                    video.currentTime = time;
                    return true;
                }
            } catch(e) {}
            
            try {
                Lampa.PlayerVideo.seek(time);
                return true;
            } catch(e) {}
            
            return false;
        },

        isVideoPlaying() {
            try {
                const video = this.getVideoElement();
                if (video) return !video.paused;
            } catch(e) {}
            return false;
        }
    };

    // ===== УПРАВЛЕНИЕ НАСТРОЙКАМИ =====
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
            const defaultEnabled = {
                intro: true,
                recap: true,
                credits: true,
                preview: false
            };
            return Utils.getStorage(`skip_intro_type_${type}`, defaultEnabled[type] || false) !== false;
        },

        getDetectionMethod() {
            return Utils.getStorage('skip_intro_detection_method', 'auto');
        },

        initSettings() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });

            const params = [
                { name: 'skip_intro_enabled', type: 'trigger', default: true, label: 'Включить плагин' },
                { name: 'skip_intro_auto', type: 'trigger', default: true, label: 'Автоматический пропуск' },
                { name: 'skip_intro_detect', type: 'trigger', default: true, label: 'Умное обнаружение' },
                { 
                    name: 'skip_intro_detection_method', 
                    type: 'select', 
                    default: 'auto',
                    values: {
                        auto: 'Авто',
                        subtitles: 'Субтитры',
                        audio: 'Звук',
                        both: 'Оба метода'
                    },
                    label: 'Метод обнаружения'
                },
                { name: 'skip_intro_type_intro', type: 'trigger', default: true, label: 'Пропускать заставку' },
                { name: 'skip_intro_type_recap', type: 'trigger', default: true, label: 'Пропускать рекап' },
                { name: 'skip_intro_type_credits', type: 'trigger', default: true, label: 'Пропускать титры' },
                { name: 'skip_intro_type_preview', type: 'trigger', default: false, label: 'Пропускать превью' }
            ];

            params.forEach(p => {
                Lampa.SettingsApi.addParam({
                    component: 'skip_intro',
                    param: { name: p.name, type: p.type, default: p.default, values: p.values },
                    field: { name: p.label, description: p.desc || '' }
                });
            });
        }
    };

    // ===== КЭШИРОВАНИЕ =====
    const Cache = {
        _storageKey: 'skip_intro_cache',
        _smartKey: 'skip_intro_smart',

        getKey(tmdbId, season, episode) {
            return `${tmdbId}_s${season}_e${episode}`;
        },

        get(tmdbId, season, episode) {
            try {
                const key = this.getKey(tmdbId, season, episode);
                const data = Lampa.Storage.get(this._storageKey, {});
                const entry = data[key];
                if (entry && entry._ts && Date.now() - entry._ts < CONFIG.CACHE_TTL) {
                    return entry.segments || null;
                }
                if (entry) {
                    delete data[key];
                    Lampa.Storage.set(this._storageKey, data);
                }
                return null;
            } catch(e) {
                return null;
            }
        },

        set(tmdbId, season, episode, segments) {
            try {
                const key = this.getKey(tmdbId, season, episode);
                const data = Lampa.Storage.get(this._storageKey, {});
                data[key] = {
                    segments: segments,
                    _ts: Date.now()
                };
                Lampa.Storage.set(this._storageKey, data);
            } catch(e) {}
        },

        clear() {
            Lampa.Storage.set(this._storageKey, {});
        },

        hasSkipped(tmdbId, type) {
            try {
                const data = Lampa.Storage.get(this._smartKey, {});
                return data[`${tmdbId}_${type}`] === true;
            } catch(e) {
                return false;
            }
        },

        rememberSkip(tmdbId, type) {
            try {
                const data = Lampa.Storage.get(this._smartKey, {});
                data[`${tmdbId}_${type}`] = true;
                Lampa.Storage.set(this._smartKey, data);
            } catch(e) {}
        },

        forgetSkip(tmdbId, type) {
            try {
                const data = Lampa.Storage.get(this._smartKey, {});
                delete data[`${tmdbId}_${type}`];
                Lampa.Storage.set(this._smartKey, data);
            } catch(e) {}
        }
    };

    // ===== МАРКЕРЫ ПРОГРЕСС-БАРА =====
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

        init() {
            this._findProgressBar();
            this._injectStyles();
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
                '[class*="timeline"]',
                '.vjs-progress-holder',
                '.vjs-slider',
                '.jw-progress',
                '.jw-slider-time'
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
                    const player = document.querySelector('.player, .video-js, .jwplayer, [data-player]');
                    if (player) {
                        const progress = player.querySelector('[class*="progress"]') || 
                                       player.querySelector('[class*="timeline"]') ||
                                       player.querySelector('.vjs-progress-holder') ||
                                       player.querySelector('.jw-progress');
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
                if (this._container.style.position === 'static' || !this._container.style.position) {
                    this._container.style.position = 'relative';
                }
                this._container.appendChild(markersContainer);
            }
            this._markersContainer = markersContainer;
        },

        _injectStyles() {
            if (document.getElementById('skip-intro-marker-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'skip-intro-marker-styles';
            style.textContent = `
                .skip-intro-markers {
                    pointer-events: none !important;
                }
                .skip-intro-marker {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    height: 70%;
                    border-radius: 2px;
                    transition: all 0.3s ease;
                    pointer-events: none !important;
                    min-width: 3px;
                    opacity: 0.6;
                    z-index: 5;
                }
                .skip-intro-marker-intro { background: rgba(76, 175, 80, 0.8); border: 1px solid #4CAF50; }
                .skip-intro-marker-recap { background: rgba(255, 152, 0, 0.8); border: 1px solid #FF9800; }
                .skip-intro-marker-credits { background: rgba(33, 150, 243, 0.8); border: 1px solid #2196F3; }
                .skip-intro-marker-preview { background: rgba(156, 39, 176, 0.8); border: 1px solid #9C27B0; }
                .skip-intro-marker.active {
                    opacity: 1 !important;
                    height: 100% !important;
                    box-shadow: 0 0 15px rgba(255,255,255,0.3);
                }
                .skip-intro-marker.animating {
                    animation: skip-intro-pulse 1s ease-in-out infinite;
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
                left: ${Math.min(startPercent, 100)}%;
                width: ${Math.min(width, 100 - startPercent)}%;
            `;
            
            this._markersContainer.appendChild(marker);
            this._markers.push({ start, end, type, element: marker });
        },

        updateMarkers(segments, duration) {
            this.clear();
            if (!segments || !segments.length || !duration || duration < CONFIG.MIN_VIDEO_DURATION) return;
            
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
                    Math.abs(data.start - segment.start) < 1 && 
                    Math.abs(data.end - segment.end) < 1) {
                    marker.classList.add('active');
                    marker.classList.add('animating');
                } else {
                    marker.classList.remove('active');
                    marker.classList.remove('animating');
                }
            });
        },

        resetHighlights() {
            const markers = this._markersContainer?.querySelectorAll('.skip-intro-marker') || [];
            markers.forEach(m => {
                m.classList.remove('active');
                m.classList.remove('animating');
            });
        },

        destroy() {
            this.clear();
            this._container = null;
            this._markersContainer = null;
        }
    };

    // ===== УВЕДОМЛЕНИЕ =====
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
                    transform: translateX(-50%) translateY(-30px);
                    background: rgba(0, 0, 0, 0.88);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    color: #fff;
                    padding: 14px 32px;
                    border-radius: 12px;
                    font-size: 17px;
                    font-weight: 500;
                    z-index: 99999;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: system-ui, -apple-system, sans-serif;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                    text-align: center;
                    min-width: 180px;
                    max-width: 85vw;
                    letter-spacing: 0.2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }
                .skip-intro-notification.show {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
                .skip-intro-notification .icon {
                    font-size: 20px;
                    line-height: 1;
                }
                .skip-intro-notification .label {
                    white-space: nowrap;
                }
                .skip-intro-notification .badge {
                    font-size: 13px;
                    opacity: 0.7;
                    font-weight: 400;
                    background: rgba(255,255,255,0.1);
                    padding: 2px 10px;
                    border-radius: 20px;
                }
                .skip-intro-notification .progress-ring {
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255,255,255,0.2);
                    border-top-color: #4CAF50;
                    border-radius: 50%;
                    animation: skip-intro-spin 0.8s linear infinite;
                    flex-shrink: 0;
                }
                @keyframes skip-intro-spin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 720px) {
                    .skip-intro-notification {
                        top: 20px;
                        padding: 10px 20px;
                        font-size: 14px;
                        min-width: 120px;
                        gap: 8px;
                    }
                    .skip-intro-notification .badge {
                        font-size: 11px;
                        padding: 1px 8px;
                    }
                }
            `;
            document.head.appendChild(style);
        },

        show(text, badge, showProgress, duration) {
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
            }, duration || CONFIG.NOTIFICATION_DURATION);
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

    // ===== УНИВЕРСАЛЬНЫЙ ДЕТЕКТОР =====
    const UniversalDetector = {
        _context: null,
        _analyser: null,
        _source: null,
        _connected: false,
        _timer: null,
        _timeout: null,

        async detect(video, method) {
            const duration = video.duration || Utils.getPlayerDuration();
            if (duration < CONFIG.MIN_VIDEO_DURATION) return null;

            const segments = [];
            
            // Метод 1: Субтитры
            if (method === 'auto' || method === 'subtitles' || method === 'both') {
                try {
                    const subSegments = await this._detectFromSubtitles(video, duration);
                    if (subSegments && subSegments.length) {
                        segments.push(...subSegments);
                    }
                } catch(e) {}
            }

            // Метод 2: Звук
            if (method === 'auto' || method === 'audio' || method === 'both') {
                try {
                    const audioSegment = await this._detectFromAudio(video);
                    if (audioSegment) {
                        segments.push(audioSegment);
                    }
                } catch(e) {}
            }

            // Метод 3: Анализ сцен (если другие методы не сработали)
            if (!segments.length && method === 'auto') {
                try {
                    const sceneSegments = await this._detectFromScenes(video, duration);
                    if (sceneSegments && sceneSegments.length) {
                        segments.push(...sceneSegments);
                    }
                } catch(e) {}
            }

            return segments.length ? Utils.mergeSegments(segments) : null;
        },

        _detectFromSubtitles(video, duration) {
            return new Promise((resolve) => {
                try {
                    const cues = this._extractCues(video);
                    if (!cues || cues.length < CONFIG.MIN_SUBTITLES) {
                        resolve([]);
                        return;
                    }

                    const segments = [];
                    const sortedCues = [...cues].sort((a, b) => a.start - b.start);

                    // Поиск заставки в начале
                    const firstCue = sortedCues[0];
                    if (firstCue && firstCue.start >= 10 && firstCue.start <= CONFIG.INTRO_MAX_START) {
                        segments.push({
                            type: 'intro',
                            start: 0,
                            end: Math.round(firstCue.start),
                            _source: 'subs'
                        });
                    }

                    // Поиск по паузам между субтитрами
                    let maxGap = 0;
                    let introStart = 0;
                    let introEnd = 0;

                    for (let i = 0; i < sortedCues.length - 1; i++) {
                        const gap = sortedCues[i + 1].start - sortedCues[i].end;
                        if (gap >= 10 && gap <= CONFIG.INTRO_MAX_END && gap > maxGap) {
                            const current = sortedCues[i].end;
                            if (current < CONFIG.INTRO_MAX_END) {
                                maxGap = gap;
                                introStart = Math.round(sortedCues[i].end);
                                introEnd = Math.round(sortedCues[i + 1].start);
                            }
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

                    // Поиск титров в конце
                    if (duration > 600 && sortedCues.length > 0) {
                        const lastCue = sortedCues[sortedCues.length - 1];
                        const gap = duration - lastCue.end;
                        
                        if (gap >= CONFIG.CREDITS_MIN_GAP) {
                            segments.push({
                                type: 'credits',
                                start: Math.round(lastCue.end),
                                end: Math.round(duration),
                                _source: 'subs'
                            });
                        }
                    }

                    resolve(segments);
                } catch(e) {
                    resolve([]);
                }
            });
        },

        _extractCues(video) {
            const cues = [];

            // Из textTracks
            if (video.textTracks) {
                for (let i = 0; i < video.textTracks.length; i++) {
                    const track = video.textTracks[i];
                    if (track.cues) {
                        for (let j = 0; j < track.cues.length; j++) {
                            const cue = track.cues[j];
                            if (cue.startTime !== undefined && cue.endTime !== undefined) {
                                cues.push({
                                    start: cue.startTime,
                                    end: cue.endTime,
                                    text: cue.text || ''
                                });
                            }
                        }
                    }
                }
            }

            // Из внешних субтитров Lampa
            try {
                const subs = Lampa.PlayerVideo.subtitles ? Lampa.PlayerVideo.subtitles() : null;
                if (subs && subs.length) {
                    for (const sub of subs) {
                        if (sub.cues && Array.isArray(sub.cues)) {
                            for (const cue of sub.cues) {
                                if (cue.start !== undefined && cue.end !== undefined) {
                                    cues.push({
                                        start: cue.start,
                                        end: cue.end,
                                        text: cue.text || ''
                                    });
                                }
                            }
                        }
                    }
                }
            } catch(e) {}

            return cues;
        },

        _detectFromAudio(video) {
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
                        this._analyser.fftSize = 2048;
                        this._analyser.smoothingTimeConstant = 0.8;
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
                    const maxTime = Math.min(420, video.duration || 420);

                    this._timer = setInterval(() => {
                        try {
                            const currentTime = video.currentTime;
                            if (currentTime - startTime > maxTime) {
                                this._cleanup();
                                resolve(this._analyzeAudio(samples));
                                return;
                            }

                            this._analyser.getByteFrequencyData(data);
                            let sum = 0;
                            for (let i = 0; i < data.length; i++) {
                                sum += data[i];
                            }
                            const energy = sum / data.length;
                            
                            samples.push({
                                time: currentTime,
                                energy: energy
                            });
                        } catch(e) {
                            this._cleanup();
                            resolve(null);
                        }
                    }, 500);

                    this._timeout = setTimeout(() => {
                        this._cleanup();
                        resolve(this._analyzeAudio(samples));
                    }, maxTime * 1000 + 1000);

                } catch(e) {
                    this._cleanup();
                    resolve(null);
                }
            });
        },

        _analyzeAudio(samples) {
            if (samples.length < 15) return null;

            const smoothed = [];
            const windowSize = 3;
            for (let i = windowSize; i < samples.length - windowSize; i++) {
                let sum = 0;
                for (let j = -windowSize; j <= windowSize; j++) {
                    sum += samples[i + j].energy;
                }
                smoothed.push({
                    time: samples[i].time,
                    energy: sum / (windowSize * 2 + 1)
                });
            }

            if (smoothed.length < 10) return null;

            const energies = smoothed.map(s => s.energy).sort((a, b) => a - b);
            const median = energies[Math.floor(energies.length / 2)];
            const threshold = median * 1.5;
            const minThreshold = median * 0.5;

            let peakStart = null;
            let peakEnd = null;
            let peakEnergy = 0;
            let inPeak = false;

            for (let i = 0; i < smoothed.length; i++) {
                const sample = smoothed[i];
                if (sample.time > CONFIG.INTRO_MAX_END) break;

                if (sample.energy > threshold) {
                    if (!inPeak) {
                        inPeak = true;
                        peakStart = sample.time;
                        peakEnergy = sample.energy;
                    } else if (sample.energy > peakEnergy) {
                        peakEnergy = sample.energy;
                    }
                } else if (inPeak && sample.energy < minThreshold) {
                    const duration = sample.time - peakStart;
                    if (duration >= 10 && duration <= 150) {
                        peakEnd = sample.time;
                        break;
                    }
                    inPeak = false;
                    peakStart = null;
                }
            }

            if (peakStart !== null && peakEnd !== null) {
                return {
                    type: 'intro',
                    start: Math.round(peakStart),
                    end: Math.round(peakEnd),
                    _source: 'audio'
                };
            }

            return null;
        },

        _detectFromScenes(video, duration) {
            return new Promise((resolve) => {
                try {
                    // Простой анализ по времени
                    const segments = [];
                    
                    // Если видео длинное и есть характерные паттерны
                    if (duration > 600) {
                        // Проверяем наличие заставки в первых 3 минутах
                        // по изменению яркости/цвета можно определить границы
                        const canvas = document.createElement('canvas');
                        canvas.width = 160;
                        canvas.height = 90;
                        const ctx = canvas.getContext('2d');
                        
                        const videoElement = Utils.getVideoElement();
                        if (!videoElement) {
                            resolve([]);
                            return;
                        }

                        // Сохраняем текущее время
                        const currentTime = videoElement.currentTime;
                        
                        const checkFrame = (time) => {
                            return new Promise((resolveFrame) => {
                                videoElement.currentTime = time;
                                videoElement.addEventListener('seeked', function onSeeked() {
                                    videoElement.removeEventListener('seeked', onSeeked);
                                    try {
                                        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                        const data = imageData.data;
                                        
                                        let brightness = 0;
                                        for (let i = 0; i < data.length; i += 4) {
                                            brightness += (data[i] + data[i+1] + data[i+2]) / 3;
                                        }
                                        brightness /= (data.length / 4);
                                        resolveFrame(brightness);
                                    } catch(e) {
                                        resolveFrame(0);
                                    }
                                }, { once: true });
                                
                                setTimeout(() => {
                                    videoElement.removeEventListener('seeked', onSeeked);
                                    resolveFrame(0);
                                }, 1000);
                            });
                        };

                        // Проверяем несколько точек
                        Promise.all([
                            checkFrame(0),
                            checkFrame(30),
                            checkFrame(60),
                            checkFrame(90),
                            checkFrame(120),
                            checkFrame(150)
                        ]).then(results => {
                            // Восстанавливаем позицию
                            videoElement.currentTime = currentTime;
                            
                            // Анализируем изменения яркости
                            const changes = [];
                            for (let i = 1; i < results.length; i++) {
                                if (results[i] > 0 && results[i-1] > 0) {
                                    const diff = Math.abs(results[i] - results[i-1]);
                                    changes.push({
                                        time: i * 30,
                                        diff: diff,
                                        brightness: results[i]
                                    });
                                }
                            }
                            
                            // Ищем резкие изменения
                            const avgDiff = changes.reduce((sum, c) => sum + c.diff, 0) / changes.length;
                            const threshold2 = avgDiff * 2;
                            
                            for (const change of changes) {
                                if (change.diff > threshold2 && change.brightness > 50) {
                                    segments.push({
                                        type: 'intro',
                                        start: Math.max(0, change.time - 5),
                                        end: Math.min(change.time + 15, CONFIG.INTRO_MAX_END),
                                        _source: 'scene'
                                    });
                                    break;
                                }
                            }
                            
                            resolve(segments);
                        }).catch(() => resolve([]));
                    } else {
                        resolve([]);
                    }
                } catch(e) {
                    resolve([]);
                }
            });
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

    // ===== API КЛИЕНТ =====
    const ApiClient = {
        _cache: {},

        async load(tmdbId, imdbId, season, episode) {
            if (!tmdbId || season == null || episode == null) return [];

            const cached = Cache.get(tmdbId, season, episode);
            if (cached) return cached;

            const segments = [];

            // Пробуем TheIntroDB
            try {
                const url = `${CONFIG.THEINTRODB_URL}?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
                const data = await this._fetch(url);
                const parsed = this._parseTheIntroDB(data);
                if (parsed.length) {
                    segments.push(...parsed);
                }
            } catch(e) {}

            // Пробуем IntroDB
            try {
                const url = `${CONFIG.API_URL}/get_intros?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
                const data = await this._fetch(url);
                if (data && data.start && data.end) {
                    segments.push({
                        type: 'intro',
                        start: Math.round(data.start),
                        end: Math.round(data.end)
                    });
                }
            } catch(e) {}

            // Пробуем IntroHater
            if (imdbId) {
                try {
                    const url = `https://introhater.com/api/segments/${imdbId}:${season}:${episode}`;
                    const data = await this._fetch(url);
                    const parsed = this._parseIntroHater(data);
                    if (parsed.length) {
                        segments.push(...parsed);
                    }
                } catch(e) {}
            }

            if (segments.length) {
                const merged = Utils.mergeSegments(segments);
                Cache.set(tmdbId, season, episode, merged);
                return merged;
            }

            return [];
        },

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
                        if (end > start && start >= 0) {
                            segments.push({ type, start: Math.round(start), end: Math.round(end) });
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

    // ===== ОСНОВНОЙ ПЛАГИН =====
    const SkipIntroPlugin = {
        _segments: [],
        _activeSegment: null,
        _lastSkipped: null,
        _currentData: null,
        _detecting: false,
        _initialized: false,
        _retryCount: 0,
        _maxRetries: 3,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            PluginSettings.initSettings();
            ProgressMarker.init();

            Lampa.Player.listener.follow('start', (data) => this._onStart(data));
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());
            
            if (Lampa.PlayerVideo && Lampa.PlayerVideo.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', 
                    Utils.throttle((data) => this._onTimeUpdate(data), 300)
                );
            }

            // Дополнительный слушатель для любых изменений времени
            document.addEventListener('timeupdate', 
                Utils.throttle(() => this._onTimeUpdate({ current: Utils.getCurrentTime() }), 300)
            );

            console.log('[SkipIntro] Universal plugin initialized');
        },

        _onStart(data) {
            this._cleanup();
            this._retryCount = 0;

            if (!PluginSettings.isEnabled()) {
                console.log('[SkipIntro] Plugin disabled');
                return;
            }

            const meta = this._extractMeta(data);
            console.log('[SkipIntro] Extracted metadata:', meta);

            if (!meta.is_series || meta.season == null || meta.episode == null) {
                console.log('[SkipIntro] Not a series or missing episode info');
                return;
            }

            this._currentData = data;
            this._loadSegments(meta);
        },

        _extractMeta(data) {
            const meta = {
                tmdb_id: null,
                imdb_id: null,
                season: null,
                episode: null,
                is_series: false,
                title: null
            };

            // 1. Из данных плеера
            if (data.tmdb_id) meta.tmdb_id = data.tmdb_id;
            if (data.imdb_id) meta.imdb_id = data.imdb_id;
            if (data.season != null) meta.season = parseInt(data.season);
            if (data.episode != null) meta.episode = parseInt(data.episode);
            if (data.title) meta.title = data.title;

            // 2. Из активности
            try {
                const activity = Lampa.Activity.active();
                if (activity) {
                    const card = activity.card || activity.movie || {};
                    if (!meta.tmdb_id) meta.tmdb_id = card.id || null;
                    if (!meta.imdb_id) meta.imdb_id = card.imdb_id || null;
                    if (!meta.title && card.title) meta.title = card.title;
                    if (!meta.title && card.name) meta.title = card.name;
                    
                    if (card.name || card.title || card.number_of_seasons || card.first_air_date) {
                        meta.is_series = true;
                    }
                }
            } catch(e) {}

            // 3. Из плейлиста
            if (data.playlist && Array.isArray(data.playlist)) {
                const url = data.url || Utils.getVideoElement()?.src || '';
                for (const item of data.playlist) {
                    const itemUrl = typeof item.url === 'string' ? item.url : '';
                    
                    if (itemUrl === url || !url) {
                        if (item.season != null && meta.season == null) meta.season = parseInt(item.season);
                        if (item.episode != null && meta.episode == null) meta.episode = parseInt(item.episode);
                        if (item.s != null && meta.season == null) meta.season = parseInt(item.s);
                        if (item.e != null && meta.episode == null) meta.episode = parseInt(item.e);
                        if (item.season_num != null && meta.season == null) meta.season = parseInt(item.season_num);
                        if (item.episode_num != null && meta.episode == null) meta.episode = parseInt(item.episode_num);
                        
                        if (item.title && !meta.title) meta.title = item.title;
                        if (item.name && !meta.title) meta.title = item.name;
                    }
                }
            }

            // 4. Из URL видео
            if (!meta.tmdb_id || !meta.season || !meta.episode) {
                try {
                    const url = data.url || Utils.getVideoElement()?.src || '';
                    
                    // Универсальный парсинг URL
                    // S01E02, s01e02, 1x02, Season 1 Episode 2
                    let match = url.match(/[Ss](\d+)[Ee](\d+)/);
                    if (match) {
                        if (meta.season == null) meta.season = parseInt(match[1]);
                        if (meta.episode == null) meta.episode = parseInt(match[2]);
                        meta.is_series = true;
                    }
                    
                    match = url.match(/(\d+)x(\d+)/);
                    if (match) {
                        if (meta.season == null) meta.season = parseInt(match[1]);
                        if (meta.episode == null) meta.episode = parseInt(match[2]);
                        meta.is_series = true;
                    }
                    
                    match = url.match(/season[_\s-]*(\d+)[_\s-]*episode[_\s-]*(\d+)/i);
                    if (match) {
                        if (meta.season == null) meta.season = parseInt(match[1]);
                        if (meta.episode == null) meta.episode = parseInt(match[2]);
                        meta.is_series = true;
                    }
                    
                    // Поиск TMDB ID в URL
                    match = url.match(/[\/_](\d{5,8})[\/_]/);
                    if (match && !meta.tmdb_id) {
                        meta.tmdb_id = match[1];
                    }
                } catch(e) {}
            }

            // 5. Из заголовка (для всех источников)
            if (!meta.season || !meta.episode) {
                const titles = [data.title, data.name, meta.title];
                for (const title of titles) {
                    if (!title) continue;
                    
                    // S01E02
                    let match = title.match(/[Ss](\d+)[Ee](\d+)/);
                    if (match) {
                        if (meta.season == null) meta.season = parseInt(match[1]);
                        if (meta.episode == null) meta.episode = parseInt(match[2]);
                        meta.is_series = true;
                        break;
                    }
                    
                    // 1x02
                    match = title.match(/(\d+)x(\d+)/);
                    if (match) {
                        if (meta.season == null) meta.season = parseInt(match[1]);
                        if (meta.episode == null) meta.episode = parseInt(match[2]);
                        meta.is_series = true;
                        break;
                    }
                    
                    // Season 1 Episode 2
                    match = title.match(/season\s*(\d+)\s*episode\s*(\d+)/i);
                    if (match) {
                        if (meta.season == null) meta.season = parseInt(match[1]);
                        if (meta.episode == null) meta.episode = parseInt(match[2]);
                        meta.is_series = true;
                        break;
                    }
                    
                    // 1 сезон 2 серия
                    match = title.match(/(\d+)\s*сезон\s*(\d+)\s*серия/i);
                    if (match) {
                        if (meta.season == null) meta.season = parseInt(match[1]);
                        if (meta.episode == null) meta.episode = parseInt(match[2]);
                        meta.is_series = true;
                        break;
                    }
                }
            }

            // 6. Если есть сезон и серия, это сериал
            if (meta.season != null && meta.episode != null) {
                meta.is_series = true;
            }

            return meta;
        },

        async _loadSegments(meta) {
            // Пробуем загрузить из кэша
            let segments = Cache.get(meta.tmdb_id, meta.season, meta.episode);
            
            if (!segments && meta.tmdb_id) {
                // Загружаем из API
                try {
                    segments = await ApiClient.load(meta.tmdb_id, meta.imdb_id, meta.season, meta.episode);
                } catch(e) {
                    console.log('[SkipIntro] API load error:', e);
                }
            }

            if (segments && segments.length) {
                this._segments = segments;
                this._updateProgressMarkers(segments);
                console.log(`[SkipIntro] Loaded ${segments.length} segments from API/cache`);
                return;
            }

            // Если нет в API, пробуем детекцию
            if (PluginSettings.isDetectEnabled()) {
                this._runDetection(meta);
            }
        },

        _runDetection(meta) {
            if (this._detecting) return;
            this._detecting = true;

            const video = Utils.getVideoElement();
            if (!video) {
                // Пробуем через Lampa
                try {
                    const videoEl = Lampa.PlayerVideo.video();
                    if (videoEl) {
                        this._performDetection(videoEl, meta);
                        return;
                    }
                } catch(e) {}
                
                // Отложенная попытка
                setTimeout(() => {
                    const v = Utils.getVideoElement();
                    if (v) {
                        this._performDetection(v, meta);
                    } else {
                        this._detecting = false;
                    }
                }, 2000);
                return;
            }

            this._performDetection(video, meta);
        },

        async _performDetection(video, meta) {
            try {
                const method = PluginSettings.getDetectionMethod();
                const segments = await UniversalDetector.detect(video, method);
                
                this._detecting = false;
                
                if (segments && segments.length) {
                    this._segments = segments;
                    if (meta.tmdb_id) {
                        Cache.set(meta.tmdb_id, meta.season, meta.episode, segments);
                    }
                    this._updateProgressMarkers(segments);
                    console.log(`[SkipIntro] Detected ${segments.length} segments`);
                } else {
                    console.log('[SkipIntro] No segments detected');
                    // Попробовать еще раз при следующем старте
                    if (this._retryCount < this._maxRetries) {
                        this._retryCount++;
                        setTimeout(() => {
                            if (this._currentData) {
                                const meta2 = this._extractMeta(this._currentData);
                                if (meta2.is_series) {
                                    this._runDetection(meta2);
                                }
                            }
                        }, 5000 * this._retryCount);
                    }
                }
            } catch(e) {
                console.log('[SkipIntro] Detection error:', e);
                this._detecting = false;
            }
        },

        _updateProgressMarkers(segments) {
            const duration = Utils.getPlayerDuration();
            if (duration > 0 && segments && segments.length) {
                ProgressMarker.updateMarkers(segments, duration);
                return;
            }
            
            // Ждем появления длительности
            let attempts = 0;
            const checkDuration = () => {
                attempts++;
                const dur = Utils.getPlayerDuration();
                if (dur > 0) {
                    ProgressMarker.updateMarkers(segments, dur);
                } else if (attempts < 20) {
                    setTimeout(checkDuration, 500);
                }
            };
            checkDuration();
        },

        _onTimeUpdate(data) {
            if (!PluginSettings.isEnabled() || !this._segments.length) return;
            
            const current = data.current || Utils.getCurrentTime();
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
                    } else {
                        // Показываем уведомление с возможностью пропуска
                        this._showSkipNotification(segment);
                    }
                }
            } else if (this._activeSegment) {
                this._hideNotification();
            }
        },

        _showSkipNotification(segment) {
            const labels = {
                intro: 'Заставка',
                recap: 'Рекап',
                credits: 'Титры',
                preview: 'Превью'
            };
            
            const label = labels[segment.type] || segment.type;
            Notification.show(
                `⏭ ${label}`,
                `${Math.round(segment.end - segment.start)}с`,
                false,
                5000
            );
            
            // Создаем кнопку пропуска
            this._addSkipButton(segment);
        },

        _addSkipButton(segment) {
            // Удаляем старую кнопку
            this._removeSkipButton();
            
            const button = document.createElement('div');
            button.className = 'skip-intro-skip-button';
            button.style.cssText = `
                position: fixed;
                bottom: 120px;
                right: 30px;
                background: rgba(76, 175, 80, 0.9);
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                z-index: 99998;
                border: none;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                transition: all 0.3s ease;
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            button.textContent = '⏭ Пропустить';
            button.onmouseover = () => {
                button.style.transform = 'scale(1.05)';
                button.style.background = 'rgba(76, 175, 80, 1)';
            };
            button.onmouseout = () => {
                button.style.transform = 'scale(1)';
                button.style.background = 'rgba(76, 175, 80, 0.9)';
            };
            button.onclick = () => {
                this._doSkip(segment, false);
                this._removeSkipButton();
            };
            
            document.body.appendChild(button);
            this._skipButton = button;
        },

        _removeSkipButton() {
            if (this._skipButton && this._skipButton.parentNode) {
                this._skipButton.parentNode.removeChild(this._skipButton);
            }
            this._skipButton = null;
        },

        _hideNotification() {
            this._activeSegment = null;
            Notification.hide();
            this._removeSkipButton();
        },

        _doSkip(segment, auto) {
            this._lastSkipped = segment;
            this._activeSegment = null;
            this._removeSkipButton();
            
            const labels = {
                intro: 'Заставка',
                recap: 'Рекап',
                credits: 'Титры',
                preview: 'Превью'
            };
            
            const label = labels[segment.type] || segment.type;
            const time = Math.round(segment.end - segment.start);
            
            Notification.show(
                `⏭ ${label} пропущена`,
                `${time}с${auto ? ' ⚡' : ''}`,
                false,
                2000
            );
            
            const target = Math.min(segment.end, Utils.getPlayerDuration() || segment.end);
            Utils.seekTo(target);
            console.log(`[SkipIntro] Skipped ${segment.type} to ${target}s${auto ? ' (auto)' : ''}`);
        },

        _cleanup() {
            this._segments = [];
            this._activeSegment = null;
            this._lastSkipped = null;
            this._currentData = null;
            this._detecting = false;
            this._removeSkipButton();
            Notification.destroy();
            UniversalDetector.destroy();
        },

        _onDestroy() {
            this._cleanup();
            ProgressMarker.destroy();
            console.log('[SkipIntro] Plugin destroyed');
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
