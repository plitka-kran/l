(function () {
    'use strict';

    if (window.__lampa_playlist_autoselect_fix__) return;
    window.__lampa_playlist_autoselect_fix__ = true;

    var VOLATILE_PARAMS = ['preload', 'play', 'session', 'sid', 't', 'time', 'ts', '_', 'token', 'rnd', 'r', 'cache', 'stream_id', 'streamid'];
    var IDENTITY_PARAMS = ['link', 'hash', 'index', 'file_index', 'fi', 'id'];

    function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

    function parseQuery(url) {
        var q = {};
        var qIndex = (url || '').indexOf('?');
        if (qIndex === -1) return q;
        var qs = url.slice(qIndex + 1).split('#')[0];
        qs.split('&').forEach(function (pair) {
            if (!pair) return;
            var idx = pair.indexOf('=');
            var k = idx === -1 ? pair : pair.slice(0, idx);
            var v = idx === -1 ? '' : pair.slice(idx + 1);
            q[safeDecode(k).toLowerCase()] = safeDecode(v);
        });
        return q;
    }

    function pathOf(url) {
        var noProto = (url || '').replace(/^https?:\/\//i, '');
        var slashIndex = noProto.indexOf('/');
        var host = slashIndex === -1 ? noProto : noProto.slice(0, slashIndex);
        var path = slashIndex === -1 ? '' : noProto.slice(slashIndex);
        return host.toLowerCase() + path.split('?')[0].split('#')[0];
    }

    function identityKey(url) {
        var q = parseQuery(url);
        var parts = [];
        IDENTITY_PARAMS.forEach(function (p) { if (q[p] !== undefined) parts.push(p + '=' + q[p]); });
        return parts.length ? parts.join('&') : null;
    }

    function normalizedKey(url) {
        var q = parseQuery(url);
        var keys = Object.keys(q).filter(function (k) { return VOLATILE_PARAMS.indexOf(k) === -1; }).sort();
        return pathOf(url) + '?' + keys.map(function (k) { return k + '=' + q[k]; }).join('&');
    }

    function findMatch(rawUrl, items) {
        if (!rawUrl || !items || !items.length) return null;

        var exact = items.filter(function (it) { return it.url === rawUrl; })[0];
        if (exact) return exact;

        var rawId = identityKey(rawUrl);
        if (rawId) {
            var byId = items.filter(function (it) { return identityKey(it.url) === rawId; })[0];
            if (byId) return byId;
        }

        var rawNorm = normalizedKey(rawUrl);
        return items.filter(function (it) { return normalizedKey(it.url) === rawNorm; })[0] || null;
    }

    // если плеер подменяет url на конкретное качество, чиним playlist заранее
    function reimplementGetUrlQuality(quality) {
        if (!quality || typeof quality !== 'object') return '';
        var def = null;
        try { def = Lampa.Storage.field('video_quality_default'); } catch (e) {}
        for (var q in quality) {
            var qa = quality[q];
            var qu = (typeof qa === 'object' && qa) ? qa.url : (typeof qa === 'string' ? qa : '');
            if (parseInt(q) === parseInt(def) && qu) return qu;
        }
        return '';
    }

    function patchPlayerCreate() {
        if (!window.Lampa || !Lampa.Player || !Lampa.Player.listener || typeof Lampa.Player.listener.follow !== 'function') return false;

        Lampa.Player.listener.follow('create', function (e) {
            try {
                var data = e && e.data;
                if (!data || !data.playlist || !data.playlist.length) return;

                var originalUrl = data.url;
                var qualityKeysCount = data.quality && typeof data.quality === 'object' ? Object.keys(data.quality).length : 0;
                var finalUrl = originalUrl;

                if (qualityKeysCount > 1) {
                    var picked = reimplementGetUrlQuality(data.quality);
                    if (picked) finalUrl = picked;
                }

                if (finalUrl !== originalUrl) {
                    var match = data.playlist.filter(function (it) { return it.url === originalUrl; })[0];
                    if (match) match.url = finalUrl;
                }
            } catch (err) {}
        });

        return true;
    }

    var lastRawUrl = null;

    function patchPlayerPlaylist() {
        if (!window.Lampa || !Lampa.PlayerPlaylist) return false;

        var pl = Lampa.PlayerPlaylist;
        if (pl.__autoselect_patched__) return true;
        pl.__autoselect_patched__ = true;

        var origUrl = pl.url;
        var origSet = pl.set;

        pl.url = function (u) {
            lastRawUrl = u;
            try {
                var match = findMatch(u, pl.get() || []);
                if (match) u = match.url;
            } catch (e) {}
            return origUrl(u);
        };

        pl.set = function (p) {
            var res = origSet(p);
            try {
                if (lastRawUrl) {
                    var match = findMatch(lastRawUrl, p || []);
                    if (match) {
                        origUrl(match.url);
                        origSet(p);
                    }
                }
            } catch (e) {}
            return res;
        };

        return true;
    }

    function tryPatchAll() {
        var ok1 = patchPlayerCreate();
        var ok2 = patchPlayerPlaylist();
        if (!ok1 || !ok2) setTimeout(tryPatchAll, 500);
    }

    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') tryPatchAll(); });
    }
    tryPatchAll();
})();
