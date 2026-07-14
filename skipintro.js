!function() {
    "use strict";
    
    if (window.__skipIntroLoaded) return;
    window.__skipIntroLoaded = !0;

    // ===== КОНФИГУРАЦИЯ =====
    const CONFIG = {
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
        NOTIFICATION_DURATION: 3000
    };

    // ===== УТИЛИТЫ =====
    const Utils = {
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

        show(text, badge) {
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
                    // Пробуем textTracks
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

                    // Пробуем Lampa субтитры
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
            
            // Ищем INTRO (большой гэп в начале)
            if (cues[0].start >= 15 && cues[0].start <= CONFIG.INTRO_MAX_START) {
                segments.push({
                    type: 'intro',
                    start: 0,
                    end: Math.round(cues[0].start),
                    _source: 'subs'
                });
            }

            // Ищем INTRO по гэпам между субтитрами
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

            // Ищем CREDITS (большой гэп в конце)
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

                // Ищем гэп в последних 10 минутах
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

            // Сглаживание
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

            // Находим медиану
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

    // ===== ОСНОВНОЙ КЛАСС =====
    const SkipIntroPlugin = {
        _segments: [],
        _activeSegment: null,
        _lastSkipped: null,
        _detecting: false,
        _initialized: false,
        _videoLoaded: false,

        init() {
            if (this._initialized) return;
            this._initialized = true;

            ProgressMarker.init();

            Lampa.Player.listener.follow('start', () => this._onStart());
            Lampa.Player.listener.follow('destroy', () => this._onDestroy());
            
            if (Lampa.PlayerVideo && Lampa.PlayerVideo.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', 
                    Utils.throttle((data) => this._onTimeUpdate(data), 300)
                );
            }

            console.log('[SkipIntro] Plugin started (no API, pure detection)');
        },

        _onStart() {
            this._cleanup();
            this._videoLoaded = false;
            
            console.log('[SkipIntro] Player started, waiting for video...');
            
            // Ждем загрузки видео
            let attempts = 0;
            const checkVideo = () => {
                attempts++;
                let video = null;
                try {
                    video = Lampa.PlayerVideo.video();
                } catch(e) {}
                
                if (video && video.duration > 0) {
                    this._videoLoaded = true;
                    console.log(`[SkipIntro] Video loaded (${Math.round(video.duration)}s)`);
                    this._runDetection(video);
                } else if (attempts < 30) {
                    setTimeout(checkVideo, 500);
                } else {
                    console.log('[SkipIntro] Video load timeout');
                }
            };
            checkVideo();
        },

        _runDetection(video) {
            if (this._detecting) return;
            this._detecting = true;

            const duration = video.duration;
            
            console.log('[SkipIntro] Starting subtitle detection...');
            
            SubtitleDetector.detect(video, duration)
                .then(subSegments => {
                    if (subSegments && subSegments.length) {
                        this._segments = subSegments;
                        this._updateProgressMarkers(subSegments);
                        this._detecting = false;
                        console.log(`[SkipIntro] Subtitle detection: ${subSegments.length} segments found`);
                        subSegments.forEach(seg => {
                            console.log(`  - ${seg.type}: ${seg.start}s → ${seg.end}s (${seg.end - seg.start}s)`);
                        });
                        return;
                    }

                    console.log('[SkipIntro] No subtitle segments, trying audio...');
                    AudioDetector.detect(video)
                        .then(audioSegment => {
                            this._detecting = false;
                            if (audioSegment) {
                                this._segments = [audioSegment];
                                this._updateProgressMarkers([audioSegment]);
                                console.log(`[SkipIntro] Audio detection: ${audioSegment.type} ${audioSegment.start}s → ${audioSegment.end}s`);
                            } else {
                                console.log('[SkipIntro] No segments found');
                            }
                        })
                        .catch(() => {
                            this._detecting = false;
                            console.log('[SkipIntro] Audio detection failed');
                        });
                })
                .catch(() => {
                    this._detecting = false;
                    console.log('[SkipIntro] Subtitle detection failed');
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
            if (!this._segments.length) return;
            
            const current = data.current;
            if (!Utils.isNumeric(current)) return;
            
            const segment = Utils.findSegment(this._segments, current);
            
            if (segment) {
                ProgressMarker.highlightActive(segment);
            } else {
                ProgressMarker.resetHighlights();
            }
            
            if (segment && this._lastSkipped !== segment) {
                this._activeSegment = segment;
                this._doSkip(segment);
            }
        },

        _doSkip(segment) {
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
            
            Notification.show(
                `⏭ ${label} пропущена`,
                `${time}с`
            );
            
            try {
                const video = Lampa.PlayerVideo.video();
                if (video) {
                    const target = Math.min(segment.end, video.duration || segment.end);
                    video.currentTime = target;
                    console.log(`[SkipIntro] Skipped ${segment.type} to ${target}s`);
                    
                    setTimeout(() => {
                        try {
                            if (video.paused) video.play();
                        } catch(e) {}
                    }, 100);
                }
            } catch(e) {
                console.log('[SkipIntro] Error seeking:', e);
            }
        },

        _cleanup() {
            this._segments = [];
            this._activeSegment = null;
            this._lastSkipped = null;
            this._detecting = false;
            this._videoLoaded = false;
            Notification.destroy();
            AudioDetector.destroy();
        },

        _onDestroy() {
            console.log('[SkipIntro] Player destroyed');
            this._cleanup();
            ProgressMarker.destroy();
        }
    };

    // ===== ИНИЦИАЛИЗАЦИЯ =====
    function initPlugin() {
        if (window.Lampa && Lampa.Player && Lampa.PlayerVideo) {
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
