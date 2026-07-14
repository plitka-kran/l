!function() {
    "use strict";
    
    if (window.__skipIntroV2) return;
    window.__skipIntroV2 = !0;

    // ===== КОНФИГУРАЦИЯ =====
    const CFG = {
        API_THEINTRODB: 'https://api.theintrodb.org/v2/media',
        API_INTRODB: 'https://api.introdb.app',
        API_INTROHATER: 'https://introhater.com/api/segments',
        CACHE_TTL: 7 * 24 * 60 * 60 * 1000,
        TIMEOUT: 6000,
        INTRO_MAX_START: 180,
        INTRO_MAX_END: 300,
        CREDITS_MIN_GAP: 25,
        MIN_SUBS: 5,
        AUTO_SKIP_DELAY: 3500,
        NOTIFY_DURATION: 3000,
        AUDIO_INTERVAL: 500,
        AUDIO_MAX_TIME: 420,
        AUDIO_MIN_SAMPLES: 20
    };

    // ===== ХРАНИЛИЩЕ =====
    const Store = {
        _cache: {},
        get(k, d) { 
            try { 
                const v = Lampa.Storage.get(k, d);
                if (typeof v === 'string' && (v[0] === '{' || v[0] === '[')) {
                    try { return JSON.parse(v); } catch(e) {}
                }
                return v;
            } catch(e) { return d; }
        },
        set(k, v) { 
            try { Lampa.Storage.set(k, typeof v === 'object' ? JSON.stringify(v) : v); } catch(e) {}
        },
        cacheGet(id, s, e) {
            const d = this.get('si_cache', {});
            const k = `${id}_${s}_${e}`;
            const item = d[k];
            if (item && Date.now() - item.t < CFG.CACHE_TTL) return item.segs;
            if (item) { delete d[k]; this.set('si_cache', d); }
            return null;
        },
        cacheSet(id, s, e, segs) {
            const d = this.get('si_cache', {});
            d[`${id}_${s}_${e}`] = { segs, t: Date.now() };
            this.set('si_cache', d);
        }
    };

    // ===== ПАРСЕР НАЗВАНИЙ =====
    const Parser = {
        parseSeEp(str) {
            if (!str) return null;
            const pats = [
                /(\d+)\s*[сs]езон\s*(\d+)\s*[сs]ер/i,
                /[сs]езон\s*(\d+)\s*[сs]ер/i,
                /[Ss](\d+)[Ee](\d+)/,
                /(\d+)\s*[xх]\s*(\d+)/,
                /\[(\d+)x(\d+)\]/,
                /_(\d+)x(\d+)_/,
                /(\d+)\s*[сs]ер\s*(\d+)\s*[сs]езон/i
            ];
            for (const p of pats) {
                const m = str.match(p);
                if (m) return { s: +m[1], e: +m[2] };
            }
            return null;
        }
    };

    // ===== ИЗВЛЕЧЕНИЕ МЕТАДАННЫХ =====
    const Meta = {
        extract(data) {
            const r = { tmdb: null, imdb: null, s: null, e: null, ok: false };
            
            // Собираем все возможные источники данных
            const sources = [data];
            
            // data.movie (Balancer, некоторые моды)
            if (data.movie && typeof data.movie === 'object') sources.push(data.movie);
            
            // data.episode как объект
            if (data.episode && typeof data.episode === 'object') sources.push(data.episode);
            
            // data.file
            if (data.file) sources.push(data.file);
            
            // Активность
            let activity = null;
            try { activity = Lampa.Activity.active(); } catch(e) {}
            if (activity) {
                if (activity.movie) sources.push(activity.movie);
                if (activity.card) sources.push(activity.card);
                if (activity.episode) sources.push(activity.episode);
            }
            
            // Ищем tmdb_id
            for (const src of sources) {
                if (!src || typeof src !== 'object') continue;
                const id = src.tmdb_id || src.id || src.tmdbId;
                if (id && typeof id === 'number' && id > 10) {
                    r.tmdb = id;
                    break;
                }
                if (id && typeof id === 'string' && /^\d+$/.test(id) && +id > 10) {
                    r.tmdb = +id;
                    break;
                }
            }
            
            // Ищем imdb_id
            for (const src of sources) {
                if (!src || typeof src !== 'object') continue;
                if (src.imdb_id || src.imdbId) {
                    r.imdb = src.imdb_id || src.imdbId;
                    break;
                }
            }
            
            // Ищем season
            for (const src of sources) {
                if (!src || typeof src !== 'object') continue;
                const s = src.season ?? src.s ?? src.season_num ?? src.seasonNumber ?? src.season_num;
                if (s != null && !isNaN(+s)) { r.s = +s; break; }
            }
            
            // Ищем episode
            for (const src of sources) {
                if (!src || typeof src !== 'object') continue;
                const e = src.episode ?? src.e ?? src.episode_num ?? src.episodeNumber ?? src.episode_num;
                if (e != null && !isNaN(+e)) { r.e = +e; break; }
            }
            
            // Из playlist
            if ((r.s == null || r.e == null) && data.playlist?.length) {
                const url = data.url;
                for (const item of data.playlist) {
                    const iu = item.url || '';
                    if (iu === url || (!r.s && !r.e)) {
                        if (r.s == null) r.s = +(item.season ?? item.s ?? 0) || null;
                        if (r.e == null) r.e = +(item.episode ?? item.e ?? 0) || null;
                    }
                    if (iu === url) break;
                }
            }
            
            // Парсим из строк
            const strs = [data.title, data.path, data.file?.title, data.episode?.title].filter(Boolean);
            if ((r.s == null || r.e == null)) {
                for (const str of strs) {
                    const p = Parser.parseSeEp(str);
                    if (p) {
                        if (r.s == null) r.s = p.s;
                        if (r.e == null) r.e = p.e;
                        if (r.s != null && r.e != null) break;
                    }
                }
            }
            
            // Определяем это сериал
            let isSeries = false;
            for (const src of sources) {
                if (!src || typeof src !== 'object') continue;
                if (src.number_of_seasons || src.first_air_date || src.seasons) {
                    isSeries = true;
                    break;
                }
                if (src.type === 'serial' || src.type === 'tv' || src.type === 'series') {
                    isSeries = true;
                    break;
                }
            }
            if (r.s != null && r.e != null) isSeries = true;
            
            // Финальный fallback для tmdb_id
            if (!r.tmdb && isSeries) {
                try {
                    const last = Store.get('last_movie', null);
                    if (last?.id) r.tmdb = +last.id;
                } catch(e) {}
            }
            
            if (!r.tmdb && isSeries) {
                try {
                    const hist = Store.get('history', []);
                    if (Array.isArray(hist) && hist.length) {
                        for (let i = hist.length - 1; i >= 0; i--) {
                            if (hist[i]?.id && +hist[i].id > 10) {
                                r.tmdb = +hist[i].id;
                                break;
                            }
                        }
                    }
                } catch(e) {}
            }
            
            r.ok = !!(r.tmdb && isSeries && r.s != null && r.e != null);
            
            console.log('[SkipIntro]', JSON.stringify(r), 'sources:', sources.map(s => s?.id || s?.title || '?').join(', '));
            
            return r;
        }
    };

    // ===== HTTP =====
    const Http = {
        get(url, timeout) {
            return new Promise((resolve, reject) => {
                let done = false;
                const xhr = new XMLHttpRequest();
                const timer = setTimeout(() => { done = true; xhr.abort(); reject('timeout'); }, timeout || CFG.TIMEOUT);
                
                xhr.open('GET', url, true);
                xhr.setRequestHeader('Accept', 'application/json');
                xhr.onload = () => {
                    if (done) return;
                    done = true;
                    clearTimeout(timer);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try { resolve(JSON.parse(xhr.responseText)); }
                        catch(e) { reject(e); }
                    } else {
                        resolve(null);
                    }
                };
                xhr.onerror = () => { if (!done) { done = true; clearTimeout(timer); reject('net'); } };
                xhr.send();
            });
        }
    };

    // ===== API =====
    const API = {
        async load(tmdb, imdb, s, e) {
            // Кэш
            const cached = Store.cacheGet(tmdb, s, e);
            if (cached) return cached;

            let segs = [];
            
            // TheIntroDB
            try {
                const d = await Http.get(`${CFG.API_THEINTRODB}?tmdb_id=${tmdb}&season=${s}&episode=${e}`);
                segs = this._parseTheIntroDB(d);
            } catch(e) {}
            
            // IntroDB
            if (!segs.length) {
                try {
                    const [intro, cred] = await Promise.all([
                        Http.get(`${CFG.API_INTRODB}/get_intros?tmdb=${tmdb}&season=${s}&episode=${e}`).catch(() => null),
                        Http.get(`${CFG.API_INTRODB}/get_credits?tmdb=${tmdb}&season=${s}&episode=${e}`).catch(() => null)
                    ]);
                    if (intro?.start) segs.push({ type: 'intro', start: +intro.start, end: +intro.end });
                    if (cred?.start) segs.push({ type: 'credits', start: +cred.start, end: +cred.end });
                } catch(e) {}
            }
            
            // IntroHater
            if (!segs.length && imdb) {
                try {
                    const d = await Http.get(`${CFG.API_INTROHATER}/${imdb}:${s}:${e}`);
                    segs = this._parseIntroHater(d);
                } catch(e) {}
            }
            
            if (segs.length) Store.cacheSet(tmdb, s, e, segs);
            return segs;
        },
        
        _parseTheIntroDB(d) {
            if (!d) return [];
            const segs = [];
            for (const type of ['intro', 'recap', 'credits', 'preview']) {
                const items = d[type];
                if (Array.isArray(items)) {
                    for (const it of items) {
                        const start = it.start_ms ? it.start_ms / 1000 : (it.start || 0);
                        const end = it.end_ms ? it.end_ms / 1000 : (it.end || 0);
                        if (end > start) segs.push({ type, start, end });
                    }
                }
            }
            return segs;
        },
        
        _parseIntroHater(d) {
            if (!Array.isArray(d)) return [];
            return d.filter(i => i.start != null && i.end != null && i.end > i.start).map(i => {
                let type = 'intro';
                const l = (i.label || '').toLowerCase();
                if (l.includes('credit') || l === 'ed') type = 'credits';
                else if (l.includes('recap')) type = 'recap';
                else if (l.includes('preview')) type = 'preview';
                return { type, start: +i.start, end: +i.end };
            });
        }
    };

    // ===== ДЕТЕКЦИЯ ПО СУБТИТРАМ =====
    const SubsDetect = {
        async detect(video, dur) {
            try {
                // Встроенные треки
                if (video.textTracks?.length) {
                    for (let i = 0; i < video.textTracks.length; i++) {
                        const t = video.textTracks[i];
                        if (t.cues?.length > CFG.MIN_SUBS) return this._analyze(t.cues, dur);
                    }
                }
                // Внешние субтитры
                const subs = Lampa.PlayerVideo?.subtitles?.();
                if (subs?.length) {
                    for (const s of subs) {
                        if (s.url) {
                            try {
                                const xhr = await new Promise((res, rej) => {
                                    const x = new XMLHttpRequest();
                                    x.open('GET', s.url, true);
                                    x.timeout = CFG.TIMEOUT;
                                    x.onload = () => res(x.responseText);
                                    x.onerror = () => rej();
                                    x.ontimeout = () => rej();
                                    x.send();
                                });
                                const segs = this._parseSrt(xhr, dur);
                                if (segs.length) return segs;
                            } catch(e) {}
                        }
                    }
                }
            } catch(e) {}
            return [];
        },
        
        _parseSrt(text, dur) {
            const cues = [];
            const lines = text.replace(/\r\n/g, '\n').split('\n');
            for (const line of lines) {
                const m = line.match(/(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})/);
                if (m) {
                    const start = this._t(m[1]), end = this._t(m[2]);
                    if (end > start) cues.push({ start, end });
                }
            }
            return this._analyze(cues, dur);
        },
        
        _t(s) {
            const p = s.match(/(\d+):(\d{2}):(\d{2})[.,](\d{3})/);
            return p ? +p[1]*3600 + +p[2]*60 + +p[3] + +p[4]/1000 : 0;
        },
        
        _analyze(cues, dur) {
            if (cues.length < CFG.MIN_SUBS) return [];
            cues.sort((a, b) => a.start - b.start);
            const segs = [];
            
            // Заставка если первый субтитр далеко
            if (cues[0].start >= 12 && cues[0].start <= CFG.INTRO_MAX_START) {
                segs.push({ type: 'intro', start: 0, end: Math.round(cues[0].start), _src: 'subs' });
            }
            
            // Большой разрыв в начале
            let maxGap = 0, gs = 0, ge = 0;
            for (let i = 0; i < cues.length - 1 && cues[i].end < CFG.INTRO_MAX_END; i++) {
                const gap = cues[i+1].start - cues[i].end;
                if (gap >= 12 && gap <= CFG.INTRO_MAX_END && gap > maxGap) {
                    maxGap = gap; gs = Math.round(cues[i].end); ge = Math.round(cues[i+1].start);
                }
            }
            if (gs && ge) segs.push({ type: 'intro', start: gs, end: ge, _src: 'subs' });
            
            // Титры в конце
            if (dur > 600 && cues.length) {
                const last = cues[cues.length - 1];
                if (dur - last.end >= CFG.CREDITS_MIN_GAP) {
                    segs.push({ type: 'credits', start: Math.round(last.end), end: Math.round(dur), _src: 'subs' });
                }
            }
            
            return segs;
        }
    };

    // ===== ДЕТЕКЦИЯ ПО ЗВУКУ =====
    const AudioDetect = {
        _ctx: null, _an: null, _src: null, _ok: false, _t: null,
        
        async detect(video) {
            this.stop();
            try {
                if (!window.AudioContext && !window.webkitAudioContext) return null;
                if (!this._ctx || this._ctx.state === 'closed') {
                    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (!this._ok) {
                    this._src = this._ctx.createMediaElementSource(video);
                    this._an = this._ctx.createAnalyser();
                    this._an.fftSize = 1024;
                    this._src.connect(this._an);
                    this._an.connect(this._ctx.destination);
                    this._ok = true;
                }
                
                const samples = [];
                const data = new Uint8Array(this._an.frequencyBinCount);
                const t0 = video.currentTime;
                
                await new Promise(resolve => {
                    this._t = setInterval(() => {
                        try {
                            if (video.currentTime - t0 > CFG.AUDIO_MAX_TIME) { this.stop(); resolve(); return; }
                            this._an.getByteFrequencyData(data);
                            let sum = 0;
                            for (let i = 0; i < data.length; i++) sum += data[i];
                            samples.push({ time: video.currentTime, energy: sum / data.length });
                        } catch(e) { this.stop(); resolve(); }
                    }, CFG.AUDIO_INTERVAL);
                    setTimeout(() => { this.stop(); resolve(); }, CFG.AUDIO_MAX_TIME * 1000);
                });
                
                return this._analyze(samples);
            } catch(e) { this.stop(); return null; }
        },
        
        _analyze(samples) {
            if (samples.length < CFG.AUDIO_MIN_SAMPLES) return null;
            
            const sm = [];
            for (let i = 2; i < samples.length - 2; i++) {
                sm.push({ time: samples[i].time, energy: (samples[i-2].energy + samples[i-1].energy + samples[i].energy + samples[i+1].energy + samples[i+2].energy) / 5 });
            }
            if (sm.length < 10) return null;
            
            const energies = sm.map(s => s.energy).sort((a,b) => a-b);
            const med = energies[Math.floor(energies.length/2)];
            const hi = med * 1.3, lo = med * 0.8;
            
            let ps = null, pc = 0, pe = null;
            for (const s of sm) {
                if (s.time > CFG.INTRO_MAX_END) break;
                if (s.energy > hi) {
                    if (!ps) { ps = s.time; pc = 1; } else pc++;
                } else if (ps && s.energy < lo) {
                    const d = s.time - ps;
                    if (d >= 15 && d <= 150 && pc >= 10) { pe = s.time; break; }
                    ps = null; pc = 0;
                }
            }
            
            return ps && pe ? { type: 'intro', start: Math.round(ps), end: Math.round(pe), _src: 'audio' } : null;
        },
        
        stop() {
            if (this._t) { clearInterval(this._t); this._t = null; }
        },
        
        destroy() {
            this.stop();
            try {
                this._src?.disconnect();
                this._an?.disconnect();
                this._ctx?.close();
            } catch(e) {}
            this._src = this._an = this._ctx = null;
            this._ok = false;
        }
    };

    // ===== УВЕДОМЛЕНИЯ =====
    const Notify = {
        _el: null, _t: null,
        
        show(text, badge, spin) {
            this.hide();
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;top:30px;left:50%;transform:translateX(-50%) translateY(-20px);background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);color:#fff;padding:14px 36px;border-radius:12px;font-size:17px;font-weight:500;z-index:99999;opacity:0;transition:all .4s cubic-bezier(.4,0,.2,1);font-family:system-ui,sans-serif;border:1px solid rgba(255,255,255,.1);box-shadow:0 8px 32px rgba(0,0,0,.6);text-align:center;max-width:80vw';
            el.innerHTML = `⏭ <span>${text}</span>${badge ? `<span style="margin-left:10px;font-size:13px;opacity:.6">${badge}</span>` : ''}${spin ? '<span style="display:inline-block;margin-left:12px;width:18px;height:18px;border:2px solid rgba(255,255,255,.2);border-top-color:#4CAF50;border-radius:50%;animation:sis .8s linear infinite;vertical-align:middle"></span>' : ''}`;
            document.body.appendChild(el);
            this._el = el;
            requestAnimationFrame(() => el.style.cssText = el.style.cssText.replace('opacity:0;transform:translateX(-50%) translateY(-20px)', 'opacity:1;transform:translateX(-50%) translateY(0)'));
            this._t = setTimeout(() => this.hide(), CFG.NOTIFY_DURATION);
        },
        
        hide() {
            if (this._t) { clearTimeout(this._t); this._t = null; }
            if (this._el) {
                this._el.style.opacity = '0';
                setTimeout(() => { this._el?.remove(); this._el = null; }, 400);
            }
        }
    };

    // ===== МАРКЕРЫ НА ПРОГРЕССЕ =====
    const Markers = {
        _cont: null,
        
        init() {
            this._find();
            if (!document.getElementById('si-mk')) {
                const s = document.createElement('style');
                s.id = 'si-mk';
                s.textContent = `.si-mk{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10}.si-m{position:absolute;top:15%;height:70%;border-radius:2px;opacity:.5;transition:all .3s}.si-m-intro{background:linear-gradient(180deg,rgba(76,175,80,.7),rgba(76,175,80,.2));border:1px solid rgba(76,175,80,.4)}.si-m-recap{background:linear-gradient(180deg,rgba(255,152,0,.7),rgba(255,152,0,.2));border:1px solid rgba(255,152,0,.4)}.si-m-credits{background:linear-gradient(180deg,rgba(33,150,243,.7),rgba(33,150,243,.2));border:1px solid rgba(33,150,243,.4)}.si-m-preview{background:linear-gradient(180deg,rgba(156,39,176,.7),rgba(156,39,176,.2));border:1px solid rgba(156,39,176,.4)}.si-m.active{opacity:.9!important;height:100%!important;top:0;animation:sip 1s ease-in-out infinite}@keyframes sip{0%,100%{opacity:.6}50%{opacity:1}}@keyframes sis{to{transform:rotate(360deg)}}`;
                document.head.appendChild(s);
            }
        },
        
        _find() {
            const sels = ['.player-progress','.video-progress','.progress-bar','.progress','.seek-bar','.timeline','.player-timeline','[class*="progress"]','[class*="timeline"]'];
            for (const s of sels) {
                const el = document.querySelector(s);
                if (el) { this._cont = el; break; }
            }
            if (!this._cont) {
                try {
                    const p = document.querySelector('.player');
                    if (p) this._cont = p.querySelector('[class*="progress"]') || p.querySelector('[class*="timeline"]');
                } catch(e) {}
            }
            if (this._cont) {
                this._cont.style.position = 'relative';
                let mc = this._cont.querySelector('.si-mk');
                if (!mc) {
                    mc = document.createElement('div');
                    mc.className = 'si-mk';
                    this._cont.appendChild(mc);
                }
            }
        },
        
        update(segs, dur) {
            if (!this._cont) this._find();
            if (!this._cont) return;
            let mc = this._cont.querySelector('.si-mk');
            if (!mc) {
                mc = document.createElement('div');
                mc.className = 'si-mk';
                this._cont.appendChild(mc);
            }
            mc.innerHTML = '';
            if (!segs?.length || !dur) return;
            for (const seg of segs.sort((a,b) => a.start - b.start)) {
                const m = document.createElement('div');
                m.className = `si-m si-m-${seg.type}`;
                m.style.left = `${(seg.start/dur)*100}%`;
                m.style.width = `${Math.max((seg.end - seg.start)/dur*100, 0.3)}%`;
                m.dataset.start = seg.start;
                m.dataset.end = seg.end;
                m.dataset.type = seg.type;
                mc.appendChild(m);
            }
        },
        
        highlight(seg) {
            if (!this._cont) return;
            this._cont.querySelectorAll('.si-m').forEach(m => {
                const active = seg && +m.dataset.start === seg.start && +m.dataset.end === seg.end && m.dataset.type === seg.type;
                m.classList.toggle('active', active);
            });
        },
        
        clear() {
            this._cont?.querySelector('.si-mk')?.remove();
        }
    };

    // ===== НАСТРОЙКИ =====
    const Settings = {
        init() {
            Lampa.SettingsApi.addComponent({
                component: 'skip_intro',
                name: 'Пропуск заставок',
                icon: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>'
            });
            [
                { n: 'skip_intro_enabled', d: true, l: 'Включить плагин', ds: 'Показывать уведомления о пропуске' },
                { n: 'skip_intro_auto', d: true, l: 'Автопропуск', ds: 'Автоматически пропускать заставки' },
                { n: 'skip_intro_detect', d: true, l: 'Умное обнаружение', ds: 'Определять по субтитрам и звуку' },
                { n: 'skip_intro_type_intro', d: true, l: 'Пропускать заставку' },
                { n: 'skip_intro_type_recap', d: true, l: 'Пропускать рекап' },
                { n: 'skip_intro_type_credits', d: true, l: 'Пропускать титры' },
                { n: 'skip_intro_type_preview', d: false, l: 'Пропускать превью' }
            ].forEach(p => {
                Lampa.SettingsApi.addParam({
                    component: 'skip_intro',
                    param: { name: p.n, type: 'trigger', default: p.d },
                    field: { name: p.l, description: p.ds || '' }
                });
            });
        },
        
        on(k) { return Store.get(k, true) !== false; },
        typeOn(t) { return Store.get(`skip_intro_type_${t}`, true) !== false; }
    };

    // ===== ОСНОВНОЙ ПЛАГИН =====
    const Plugin = {
        segs: [],
        active: null,
        skipped: new Set(),
        data: null,
        tmdb: null,
        detecting: false,
        inited: false,

        init() {
            if (this.inited) return;
            this.inited = true;
            
            Settings.init();
            Markers.init();
            
            // Перехватываем start чтобы инжектить метаданные
            this._hookStart();
            
            Lampa.Player.listener.follow('start', (d) => this.onStart(d));
            Lampa.Player.listener.follow('destroy', () => this.onDestroy());
            
            if (Lampa.PlayerVideo?.listener) {
                Lampa.PlayerVideo.listener.follow('timeupdate', this._throttle((d) => this.onTime(d), 250));
            }
            
            console.log('[SkipIntro] v2 initialized');
        },
        
        _hookStart() {
            // Патчим чтобы все моды передавали метаданные
            const origFollow = Lampa.Player.listener.follow.bind(Lampa.Player.listener);
            const self = this;
            
            // Сохраняем ссылку на активность при навигации
            try {
                const origPush = Lampa.Activity.push.bind(Lampa.Activity);
                Lampa.Activity.push = function(obj) {
                    if (obj?.movie?.id) {
                        self._lastMovie = obj.movie;
                        Store.set('last_movie', { id: obj.movie.id });
                    }
                    return origPush.apply(this, arguments);
                };
            } catch(e) {}
        },
        
        _throttle(fn, ms) {
            let last = 0;
            return function(...args) {
                const now = Date.now();
                if (now - last >= ms) { last = now; fn.apply(this, args); }
            };
        },
        
        onStart(data) {
            this.onDestroy();
            if (!Settings.on('skip_intro_enabled')) return;
            
            // Инжектим метаданные из последней активности
            if (this._lastMovie && !data.tmdb_id && !data.movie?.id) {
                data._injected_movie = this._lastMovie;
            }
            
            const meta = Meta.extract(data);
            
            if (!meta.ok) {
                console.log('[SkipIntro] Недостаточно данных для пропуска');
                return;
            }
            
            this.data = data;
            this.tmdb = meta.tmdb;
            this.skipped = new Set();
            
            console.log(`[SkipIntro] Загрузка S${meta.s}E${meta.e} (TMDB: ${meta.tmdb})`);
            
            let apiDone = false, detDone = false;
            let apiSegs = [], detSegs = [];
            
            const merge = () => {
                if (!apiDone || !detDone) return;
                if (this.data !== data) return;
                
                const merged = [...apiSegs];
                for (const ds of detSegs) {
                    const exists = merged.find(m => m.type === ds.type);
                    if (exists) {
                        if (ds.start < exists.start) Object.assign(exists, ds);
                    } else {
                        merged.push(ds);
                    }
                }
                
                this.segs = merged.filter(s => Settings.typeOn(s.type));
                Markers.update(this.segs, this._getDuration());
                console.log(`[SkipIntro] Загружено ${this.segs.length} сегментов`);
            };
            
            // API
            API.load(meta.tmdb, meta.imdb, meta.s, meta.e)
                .then(segs => { apiSegs = segs || []; apiDone = true; merge(); })
                .catch(() => { apiDone = true; merge(); });
            
            // Детекция
            if (Settings.on('skip_intro_detect')) {
                this._detect(data, (segs) => { detSegs = segs || []; detDone = true; merge(); });
            } else {
                detDone = true;
                merge();
            }
        },
        
        _detect(data, cb) {
            if (this.detecting) { cb([]); return; }
            this.detecting = true;
            
            let video = null;
            try { video = Lampa.PlayerVideo.video(); } catch(e) {}
            if (!video) { this.detecting = false; cb([]); return; }
            
            const dur = this._getDuration();
            
            // Субтитры
            SubsDetect.detect(video, dur).then(subSegs => {
                if (subSegs.length) { this.detecting = false; cb(subSegs); return; }
                
                // Аудио (только если нет субтитров)
                if (video.currentTime < 5) {
                    setTimeout(() => {
                        AudioDetect.detect(video).then(audioSeg => {
                            this.detecting = false;
                            cb(audioSeg ? [audioSeg] : []);
                        });
                    }, 1000);
                } else {
                    this.detecting = false;
                    cb([]);
                }
            });
        },
        
        _getDuration() {
            try {
                const v = Lampa.PlayerVideo.video();
                return v?.duration || 0;
            } catch(e) { return 0; }
        },
        
        _getCurrentTime() {
            try {
                const v = Lampa.PlayerVideo.video();
                return v?.currentTime || 0;
            } catch(e) { return 0; }
        },
        
        onTime(data) {
            if (!this.segs.length || this.data === null) return;
            
            const time = this._getCurrentTime();
            const dur = this._getDuration();
            
            // Найти текущий сегмент
            let found = null;
            for (const seg of this.segs) {
                if (time >= seg.start && time < seg.end) { found = seg; break; }
            }
            
            if (found) {
                Markers.highlight(found);
                
                const key = `${found.type}_${found.start}`;
                
                if (!this.skipped.has(key)) {
                    this.skipped.add(key);
                    
                    const names = { intro: 'Заставка', recap: 'Рекап', credits: 'Титры', preview: 'Превью' };
                    const name = names[found.type] || found.type;
                    
                    if (Settings.on('skip_intro_auto')) {
                        Notify.show(`Пропуск: ${name}`, `${Math.round(found.end - found.start)}с`, false);
                        setTimeout(() => {
                            try { Lampa.PlayerVideo.seek(found.end); } catch(e) {}
                        }, CFG.AUTO_SKIP_DELAY);
                    } else {
                        Notify.show(`${name} — нажмите для пропуска`, `${Math.round(found.end - found.start)}с`, false);
                    }
                }
            } else {
                Markers.highlight(null);
            }
            
            // Обновить маркеры если длительность изменилась
            if (dur > 0 && !this._markerDur) {
                this._markerDur = dur;
                Markers.update(this.segs, dur);
            }
        },
        
        onDestroy() {
            this.segs = [];
            this.active = null;
            this.data = null;
            this.tmdb = null;
            this.skipped = new Set();
            this._markerDur = 0;
            Markers.clear();
            Notify.hide();
            AudioDetect.stop();
        }
    };

    // ===== ЗАПУСК =====
    if (typeof Lampa !== 'undefined' && Lampa.Player) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => Plugin.init());
        } else {
            Plugin.init();
        }
    } else {
        // Ждём Lampa
        const waitLampa = setInterval(() => {
            if (typeof Lampa !== 'undefined' && Lampa.Player) {
                clearInterval(waitLampa);
                Plugin.init();
            }
        }, 500);
        setTimeout(() => clearInterval(waitLampa), 15000);
    }

}();
