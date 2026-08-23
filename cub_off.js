(function() {
    'use strict';
    
    // Инициализация платформы
    Lampa.Platform.tv();
    
    // КОНФИГУРАЦИЯ ОТКЛЮЧЕНИЙ
    const DISABLE = {
        // Отключение премиум-функций
        premium: {
            account_sync: false,      // Отключить синхронизацию аккаунта
            plugins_store: false,     // Отключить магазин плагинов
            torrents_use: false,      // Отключить торренты (если премиум)
            socket_use: false,        // Отключить сокеты
            install_proxy: false,     // Отключить прокси
            white_use: false,         // Отключить белый список
            read_only: false,         // Только чтение (откл)
            nodemo: true,             // Демо-режим
            lang_use: true,           // Мультиязычность
            trailers: true            // Трейлеры
        },
        
        // Скрытие элементов интерфейса
        ui: {
            subscribe_button: true,   // Скрыть кнопку подписки
            purchase_button: true,    // Скрыть кнопку покупки
            premium_badge: true,      // Скрыть значок премиум
            dmca_warning: true,       // Скрыть DMCA предупреждение
            ads: true,                // Скрыть рекламу
            blacklist: true,          // Скрыть черный список
            reactions: true,          // Скрыть реакции
            discuss: true,            // Скрыть обсуждения
            ai: true,                 // Скрыть AI функции
            terminal: true,           // Скрыть терминал
            mirrors: true,            // Скрыть зеркала
            geo: true                 // Скрыть геолокацию
        },
        
        // Блокировка премиум-проверок
        checks: {
            premium_check: false,     // Блокировать проверку премиум
            license_check: false,     // Блокировать проверку лицензии
            dmca_check: false         // Блокировать DMCA проверку
        }
    };
    
    // ПРИМЕНЕНИЕ НАСТРОЕК
    window.lampa_settings = window.lampa_settings || {};
    
    // Отключение премиум-функций
    Object.assign(window.lampa_settings, DISABLE.premium);
    
    // Отключение функций интерфейса
    window.lampa_settings.disable_features = DISABLE.ui;
    
    // Отключение премиум-проверок
    window.lampa_settings.disable_features.premium = true;
    window.lampa_settings.disable_features.license = true;
    window.lampa_settings.disable_features.dmca = true;
    
    // ОБХОД ПРЕМИУМ-ПРОВЕРОК
    function bypassPremiumChecks() {
        // Переопределение функции проверки премиум
        if (Lampa.Account) {
            const originalIsPremium = Lampa.Account.isPremium;
            Lampa.Account.isPremium = function() {
                return true; // Всегда премиум
            };
            
            const originalIsLicensed = Lampa.Account.isLicensed;
            Lampa.Account.isLicensed = function() {
                return true; // Всегда лицензирован
            };
        }
        
        // Переопределение функции проверки DMCA
        if (Lampa.DMCA) {
            const originalCheckDMCA = Lampa.DMCA.check;
            Lampa.DMCA.check = function() {
                return false; // DMCA отключена
            };
        }
        
        // Блокировка проверки подписки
        if (Lampa.Subscription) {
            const originalCheckSubscription = Lampa.Subscription.check;
            Lampa.Subscription.check = function() {
                return Promise.resolve(true); // Всегда успешно
            };
        }
    }
    
    // УДАЛЕНИЕ ЭЛЕМЕНТОВ ИНТЕРФЕЙСА
    function removeUIElements() {
        const selectors = {
            subscribe: [
                '.button--subscribe',
                '.subscribe-button',
                '[data-action="subscribe"]',
                '.btn-subscribe'
            ],
            purchase: [
                '.button--purchase',
                '.purchase-button',
                '[data-action="purchase"]',
                '.btn-buy'
            ],
            premium: [
                '.premium-badge',
                '.premium-label',
                '.premium-icon',
                '[data-premium]'
            ],
            dmca: [
                '.dmca-warning',
                '.dmca-notice',
                '.copyright-warning',
                '[data-dmca]'
            ],
            ads: [
                '.ad-server',
                '.ad-block',
                '.advertisement',
                '[data-ad]',
                '.banner-ad'
            ],
            blacklist: [
                '.blacklist-item',
                '.blacklist-warning',
                '[data-blacklist]'
            ],
            reactions: [
                '.reaction-button',
                '.reaction-icon',
                '[data-reaction]',
                '.card-interfice-reactions'
            ],
            discuss: [
                '.discuss-button',
                '.discuss-block',
                '[data-discuss]'
            ]
        };
        
        // Удаление всех элементов по селекторам
        Object.values(selectors).forEach(selectorList => {
            selectorList.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => el.remove());
                } catch (e) {
                    // Игнорируем ошибки
                }
            });
        });
        
        // Специальные удаления через jQuery (если доступен)
        if (typeof $ !== 'undefined') {
            try {
                // Удаление кнопки подписки в настройках
                $('.settings-item:contains("Подписка")').remove();
                $('.settings-item:contains("Premium")').remove();
                $('.settings-item:contains("Премиум")').remove();
                
                // Удаление DMCA предупреждения
                $('.notice:contains("DMCA")').remove();
                $('.notice:contains("Авторские")').remove();
                $('.warning:contains("DMCA")').remove();
                
                // Удаление рекламных блоков
                $('.ad-container').remove();
                $('.banner').remove();
                
                // Удаление элементов с атрибутами
                $('[data-premium="true"]').remove();
                $('[data-paid="true"]').remove();
                $('[data-subscribe]').remove();
            } catch (e) {
                // Игнорируем ошибки jQuery
            }
        }
    }
    
    // CSS СТИЛИ ДЛЯ СКРЫТИЯ ЭЛЕМЕНТОВ
    function addHiddenStyles() {
        const styles = `
            /* Скрытие кнопок подписки и покупки */
            .button--subscribe,
            .button--purchase,
            .subscribe-button,
            .purchase-button,
            .btn-subscribe,
            .btn-buy,
            .premium-button,
            .pro-button,
            [data-action="subscribe"],
            [data-action="purchase"],
            [data-premium="true"],
            [data-paid="true"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
                position: absolute !important;
                z-index: -9999 !important;
            }
            
            /* Скрытие DMCA предупреждений */
            .dmca-warning,
            .dmca-notice,
            .copyright-warning,
            .dmca-block,
            .dmca-banner,
            [data-dmca="true"] {
                display: none !important;
            }
            
            /* Скрытие рекламы */
            .ad-server,
            .ad-block,
            .advertisement,
            .banner-ad,
            .ad-container,
            .banner,
            [data-ad="true"] {
                display: none !important;
            }
            
            /* Скрытие премиум-элементов */
            .premium-badge,
            .premium-label,
            .premium-icon,
            .pro-badge,
            .paid-badge {
                display: none !important;
            }
            
            /* Скрытие чёрного списка */
            .blacklist-item,
            .blacklist-warning,
            [data-blacklist="true"] {
                display: none !important;
            }
            
            /* Скрытие реакций */
            .card-interfice-reactions,
            .reaction-button,
            .reaction-icon,
            [data-reaction="true"] {
                display: none !important;
            }
            
            /* Скрытие обсуждений и AI */
            .discuss-button,
            .discuss-block,
            .ai-block,
            .ai-feature,
            [data-discuss="true"],
            [data-ai="true"] {
                display: none !important;
            }
            
            /* Скрытие терминала и зеркал */
            .terminal-block,
            .mirrors-block,
            .geo-block,
            [data-terminal="true"],
            [data-mirrors="true"],
            [data-geo="true"] {
                display: none !important;
            }
            
            /* Обход премиум-блокировок */
            .premium-lock,
            .premium-overlay,
            .premium-block {
                display: none !important;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.textContent = styles.trim();
        document.head.appendChild(styleElement);
    }
    
    // ПЕРЕОПРЕДЕЛЕНИЕ API МЕТОДОВ
    function overrideAPIMethods() {
        // Переопределение метода проверки премиум
        if (Lampa.Api) {
            const originalCheckPremium = Lampa.Api.checkPremium;
            Lampa.Api.checkPremium = function(params) {
                return Promise.resolve({ 
                    success: true, 
                    premium: true,
                    licensed: true,
                    dmca: false
                });
            };
            
            const originalCheckLicense = Lampa.Api.checkLicense;
            Lampa.Api.checkLicense = function(params) {
                return Promise.resolve({ 
                    success: true, 
                    licensed: true 
                });
            };
        }
    }
    
    // ПЕРЕХВАТ XHR ЗАПРОСОВ (дополнительная защита)
    function interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            // Блокировка запросов к премиум-эндпоинтам
            const blockedEndpoints = [
                '/premium',
                '/check-premium',
                '/validate-license',
                '/dmca-check',
                '/subscription',
                '/payment',
                '/purchase',
                '/license'
            ];
            
            if (blockedEndpoints.some(endpoint => url.includes(endpoint))) {
                // Возвращаем фейковый ответ
                this.readyState = 4;
                this.status = 200;
                this.responseText = JSON.stringify({ 
                    success: true, 
                    premium: true,
                    licensed: true,
                    dmca: false
                });
                this.onreadystatechange?.();
                return;
            }
            
            return originalOpen.call(this, method, url, ...args);
        };
    }
    
    // НАБЛЮДЕНИЕ ЗА ИЗМЕНЕНИЯМИ DOM
    function observeDOMChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Проверяем добавленные узлы
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element
                        // Проверяем на наличие премиум-элементов
                        if (node.matches?.('.button--subscribe, .button--purchase, .premium-badge, .dmca-warning, .ad-server')) {
                            node.remove();
                        }
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        return observer;
    }
    
    // ИНИЦИАЛИЗАЦИЯ
    function init() {
        console.log('[Lampa Unlocker] Инициализация...');
        
        // Применяем настройки
        Object.assign(window.lampa_settings, DISABLE.premium);
        window.lampa_settings.disable_features = DISABLE.ui;
        
        // Обходим премиум-проверки
        bypassPremiumChecks();
        
        // Переопределяем API
        overrideAPIMethods();
        
        // Перехватываем XHR
        interceptXHR();
        
        // Скрываем элементы
        removeUIElements();
        addHiddenStyles();
        
        // Наблюдаем за изменениями
        const observer = observeDOMChanges();
        
        // Слушаем события приложения
        Lampa.Listener.follow('app', function(data) {
            if (data.type === 'complite' || data.type === 'open') {
                setTimeout(() => {
                    removeUIElements();
                }, 100);
            }
        });
        
        // Слушаем открытие настроек
        Lampa.Listener.follow('open', function(data) {
            if (data.name === 'server') {
                setTimeout(() => {
                    removeUIElements();
                    // Удаляем вкладку подписки в настройках
                    const subscribeTab = document.querySelector('[data-name="subscribe"], [data-name="premium"], [data-name="subscription"]');
                    if (subscribeTab) subscribeTab.remove();
                }, 50);
            }
        });
        
        console.log('[Lampa Unlocker] Готово!');
    }
    
    // ЗАПУСК
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('appready', function(data) {
            if (data.status === 'ready') {
                init();
            }
        });
    }
})();
