(function () {
    'use strict';

    if (window.plugin_playlist_sync_fix) return;
    window.plugin_playlist_sync_fix = true;

    function log() {
        console.log('[PlaylistSync]', ...arguments);
    }

    function sync() {
        try {
            if (!window.Lampa) return;

            var playlist = window.PlayerPlaylist || Lampa.PlayerPlaylist;
            if (!playlist) {
                log('PlayerPlaylist not found');
                return;
            }

            var list = playlist.get ? playlist.get() : null;
            if (!list || !list.length) return;

            var current = -1;

            // Поиск активного файла
            for (var i = 0; i < list.length; i++) {
                if (list[i].continue_play || list[i].active || list[i].playing) {
                    current = i;
                    break;
                }
            }

            if (current < 0) {
                log('Current episode not found');
                return;
            }

            log('Sync to', current);

            if (playlist.position)
                playlist.position(current);

            if (playlist.active)
                playlist.active();

            if (playlist.update)
                playlist.update();

        } catch (e) {
            console.error('[PlaylistSync]', e);
        }
    }

    function install() {

        [
            'player',
            'player_start',
            'torrent',
            'play',
            'full'
        ].forEach(function (name) {

            Lampa.Listener.follow(name, function () {
                setTimeout(sync, 500);
                setTimeout(sync, 1500);
                setTimeout(sync, 3000);
            });

        });

        log('installed');
    }

    if (window.appready)
        install();
    else
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready')
                install();
        });

})();
