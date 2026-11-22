(function () {
    'use strict';

	// 1. ВКЛЮЧАЕМ ТОРРЕНТЫ (Строго в самом начале!)
    window.lampa_settings = window.lampa_settings || {};
    window.lampa_settings.torrents_use = true;
	
    // Базовый URL, где лежат ваши скрипты (чтобы не писать его каждый раз)
    var BASE_URL = 'https://plitka-kran.github.io/l/';

    // Список скриптов и их индивидуальные версии
    var config = {
        'online.js': '1.0.133',
        'pubtorr.js': '1.0.17',
        'torrent_style.js': '1.0.6',
        'no-autostart.js': '1.0.1',
        'ss.js': '1.0.3',
        'playlist.js': '1.0.33',
        'reload.js': '1.0',
        'cub_off.js': '1.4',
        'trailers-itunes.js': '1.0',		
        'audio.js': '1.0.11'
	};

    // Собираем массив готовых ссылок с версиями
    var scriptsToLoad = Object.keys(config).map(function (fileName) {
        var version = config[fileName];
        return BASE_URL + fileName + '?v=' + version;
    });

    // Запускаем загрузку всех скриптов в Lampa
    Lampa.Utils.putScriptAsync(scriptsToLoad, function () {
        console.log('Все скрипты загружены со своими версиями!');
    });

})();
