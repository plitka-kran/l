(function() {
    'use strict';
    
    // Инициализация платформы ТВ
    Lampa.Platform.tv();
    
    // Конфигурация настроек
    const CONFIG = {
        features: {
            socket_use: false,
            socket_url: undefined,
            install_proxy: false,
            nodemo: true,
            plugins_store: true,
            plugins_use: true,
            account_sync: true,
            trailers: true,
            torrents_use: true,
            read_only: false,
            lang_use: true,
            white_use: false,
            push_state: true,
            interface: false,
            feed: false,
            iptv: false,
            geo: false,
            persons: false
        },
        disabled_features: {
            dmca: true,
            discuss: false,
            ai: true,
            reactions: true,
            terminal: true,
            mirrors: true,
            ads: true,
            blacklist: false,
            socket_methods: true
        },
        developer: {
            ads: false,
            nodemo: true,
            account_use: false,
            torrents_use: false
        }
    };
    
    // Применение настроек
    window.lampa_settings = window.lampa_settings || {};
    Object.assign(window.lampa_settings, CONFIG.features);
    window.lampa_settings.disable_features = CONFIG.disabled_features;
    window.lampa_settings.developer = CONFIG.developer;
    
    /**
     * Удаление элементов с задержкой
     */
    function removeWithDelay(selector, delay = 0) {
        if (typeof $ !== 'undefined') {
            setTimeout(() => {
                const element = document.querySelector(selector);
                if (element) element.remove();
            }, delay);
        }
    }
    
    /**
     * Проверка наличия элемента в DOM
     */
    function elementExists(selector) {
        return document.querySelector(selector) !== null;
    }
    
    /**
     * Безопасное удаление элемента
     */
    function safeRemove(selector) {
        if (typeof $ !== 'undefined') {
            const element = $(selector);
            if (element.length > 0) element.remove();
        }
    }
    
    /**
     * Инициализация основного функционала
     */
    function initializeFeatures() {
        // Добавление CSS стилей
        const style = document.createElement('style');
        const styles = `
            .black-friday__button { display: none; }
            .womens_day__button { display: none; }
            .christmas__button { display: none; }
            .button--subscribe { display: none; }
            .icon--blink { display: none; }
            .notice--icon { display: none; }
            .ad-server { display: none !important; }
            .button--book { display: none; }
        `;
        style.textContent = styles.trim();
        document.head.appendChild(style);
        
        // Удаление рекламных блоков
        safeRemove('.ad-server');
        
        // Настройка слушателей
        setupEventListeners();
    }
    
    /**
     * Настройка обработчиков событий
     */
    function setupEventListeners() {
        const settings = Lampa.Settings;
        const listener = Lampa.Listener;
        
        // Слушатель смены страниц
        listener.follow('app', function(data) {
            if (data.type === 'complite') {
                setTimeout(() => {
                    const activeComponent = Lampa.Component.active();
                    if (activeComponent && activeComponent.type === 'full') {
                        safeRemove('.ad-server');
                    }
                }, 300);
            }
        });
        
        // Слушатель открытия настроек
        settings.listener.follow('open', function(data) {
            if (data.name === 'server') {
                // Удаление элементов вкладки "Сервер"
                const serverTab = data.body?.find('[data-name="server"]');
                if (serverTab) serverTab.remove();
                
                // Удаление элемента "Спорт" в настройках
                const sportElement = document.querySelector('#app > div.wrap.layer--height.layer--width > div.wrap__left.layer--height > div > div > div > div > div:nth-child(1) > ul > li:contains("Спорт")');
                if (sportElement) sportElement.remove();
                
                // Удаление кнопки подписки
                safeRemove('.button--subscribe');
                
                // Удаление карточки качества
                const qualityElement = data.body?.find('[data-name="card_quality"]');
                if (qualityElement) qualityElement.remove();
                
                // Удаление реакции
                const reactionsElement = data.body?.find('[data-name="card_interfice_reactions"]');
                if (reactionsElement) reactionsElement.remove();
            }
        });
        
        // Слушатель завершения загрузки
        listener.follow('appready', function(data) {
            if (data.status === 'ready') {
                initializeFeatures();
            }
        });
    }
    
    /**
     * Обход консоли (защита от дебага)
     */
    function preventConsoleDebug() {
        const consoleMethods = ['log', 'info', 'warn', 'debug', 'error', 'trace'];
        const consolePrototype = Function.prototype.bind.bind(Function.prototype.call);
        const originalConsole = window.console || {};
        
        consoleMethods.forEach(method => {
            const fakeMethod = consolePrototype(console.log, console);
            fakeMethod.toString = () => method;
            originalConsole[method] = fakeMethod;
        });
    }
    
    // Запуск
    if (window.appready) {
        preventConsoleDebug();
        initializeFeatures();
    } else {
        Lampa.Listener.follow('appready', function(data) {
            if (data.status === 'ready') {
                preventConsoleDebug();
                initializeFeatures();
                
                // Удаление загрузочных элементов
                safeRemove('.loader--wrap');
                setTimeout(() => {
                    safeRemove('.loader');
                }, 1000);
            }
        });
    }
})();
