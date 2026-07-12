(function () {
    'use strict';

	// 1. ВКЛЮЧАЕМ ТОРРЕНТЫ (Строго в самом начале!)
    window.lampa_settings = window.lampa_settings || {};
    window.lampa_settings.torrents_use = true;

    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite') {
            e.object.activity.render().find('.view--trailer').remove();
        }
    }); 
	
    // Базовый URL, где лежат ваши скрипты (чтобы не писать его каждый раз)
    var BASE_URL = 'https://plitka-kran.github.io/l/';

    // Список скриптов и их индивидуальные версии
    var config = {
    // 	'online.js': '1.1', покане рабоатет 
        'pubtorr.js': '1.0',
        'ss.js': '1.0.1',
	'playlist.js': '1.0.10',
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
