// Расширение для Лампы - Стриминговые сервисы
// Использует встроенный TMDb API Лампы
// Версия: 2.0

(function() {
    'use strict';

    // Конфигурация стриминговых сервисов
    const STREAMING_SERVICES = {
        netflix: {
            name: 'Netflix',
            id: 8,
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#E50914"><path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.994 2.344.056 4.85.398 7.254.4-3.462-9.547-5.923-16.219-9.15-24.4H5.398zm7.415 0c3.184 8.013 5.717 14.766 8.779 23.931.699-.002 1.216-.025 1.991-.04C18.661 13.772 16.166 7.26 12.813 0h-7.43c3.229 8.188 5.513 14.755 8.878 24h.503c-.656-1.83-1.24-3.504-1.951-5.518V0zm-6.234 0L2.983 12.45v11.47c1.739-.003 3.447-.04 5.202-.035V0H6.579z"/></svg>',
            color: '#E50914'
        },
        hbo: {
            name: 'HBO Max',
            id: 384,
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#9c27b0"><circle cx="12" cy="12" r="10"/></svg>',
            color: '#9c27b0'
        },
        hulu: {
            name: 'Hulu',
            id: 15,
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#3DBB3D"><rect width="24" height="24" rx="4"/></svg>',
            color: '#3DBB3D'
        },
        disney: {
            name: 'Disney+',
            id: 337,
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#113CCF"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
            color: '#113CCF'
        },
        amazon: {
            name: 'Prime Video',
            id: 9,
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#00A8E1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
            color: '#00A8E1'
        },
        apple: {
            name: 'Apple TV+',
            id: 350,
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>',
            color: '#000000'
        }
    };

    // Категории контента
    const CONTENT_CATEGORIES = [
        { 
            id: 'movies_popular', 
            name: 'Популярные фильмы', 
            type: 'movie', 
            filter: 'popularity.desc',
            icon: '🔥'
        },
        { 
            id: 'movies_new', 
            name: 'Новинки фильмов', 
            type: 'movie', 
            filter: 'primary_release_date.desc',
            icon: '🆕'
        },
        { 
            id: 'series_popular', 
            name: 'Популярные сериалы', 
            type: 'tv', 
            filter: 'popularity.desc',
            icon: '📺'
        },
        { 
            id: 'series_new', 
            name: 'Новинки сериалов', 
            type: 'tv', 
            filter: 'first_air_date.desc',
            icon: '✨'
        }
    ];

    // Класс для работы с контентом через Lampa API
    class StreamingContent {
        constructor(serviceId, serviceName) {
            this.serviceId = serviceId;
            this.serviceName = serviceName;
        }

        getDiscoverUrl(category) {
            const type = category.type;
            const endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv';
            
            let url = Lampa.TMDB.api(endpoint + '?sort_by=' + category.filter);
            url += '&with_watch_providers=' + this.serviceId;
            url += '&watch_region=US';
            url += '&vote_count.gte=50';
            
            // Для новинок добавляем фильтр по дате
            if (category.id.includes('_new')) {
                const today = new Date();
                const sixMonthsAgo = new Date(today.setMonth(today.getMonth() - 6));
                const dateStr = sixMonthsAgo.toISOString().split('T')[0];
                
                if (type === 'movie') {
                    url += '&primary_release_date.gte=' + dateStr;
                } else {
                    url += '&first_air_date.gte=' + dateStr;
                }
            }
            
            return url;
        }

        show(category) {
            const url = this.getDiscoverUrl(category);
            
            Lampa.Activity.push({
                url: url,
                title: this.serviceName + ' - ' + category.name,
                component: 'category',
                page: 1,
                card_type: true,
                source: 'tmdb',
                type: category.type
            });
        }
    }

    // Создание меню для сервиса
    function createServiceMenu(serviceKey, serviceData) {
        const content = new StreamingContent(serviceData.id, serviceData.name);
        
        // Создаем подменю с категориями
        const submenu = CONTENT_CATEGORIES.map(category => {
            return {
                title: category.icon + ' ' + category.name,
                subtitle: '',
                selected: false,
                service: serviceKey,
                category: category,
                action: function() {
                    content.show(category);
                }
            };
        });

        return submenu;
    }

    // Показ меню категорий
    function showCategoriesMenu(serviceKey, serviceData) {
        const submenu = createServiceMenu(serviceKey, serviceData);
        
        Lampa.Select.show({
            title: serviceData.name,
            items: submenu,
            onSelect: function(item) {
                item.action();
            },
            onBack: function() {
                Lampa.Controller.toggle('menu');
            }
        });
    }

    // Инициализация расширения
    function initExtension() {
        // Проверяем наличие Lampa API
        if (!Lampa || !Lampa.TMDB) {
            console.error('⚠️ Ошибка: Lampa API недоступен');
            return;
        }

        // Добавляем пункты меню для каждого сервиса
        Object.entries(STREAMING_SERVICES).forEach(([serviceKey, serviceData]) => {
            Lampa.SettingsApi.addParam({
                component: 'add_interface',
                param: {
                    name: 'streaming_' + serviceKey,
                    type: 'button',
                    default: true
                },
                field: {
                    name: serviceData.name,
                    description: 'Контент из ' + serviceData.name
                },
                onChange: function() {
                    showCategoriesMenu(serviceKey, serviceData);
                }
            });

            // Добавляем в главное меню
            Lampa.Listener.follow('full', function(e) {
                if (e.type == 'complite') {
                    const menuItem = $('<li class="menu__item selector" data-action="streaming_' + serviceKey + '">' +
                        '<div class="menu__ico">' + serviceData.icon + '</div>' +
                        '<div class="menu__text">' + serviceData.name + '</div>' +
                        '</li>');

                    menuItem.on('hover:enter', function() {
                        showCategoriesMenu(serviceKey, serviceData);
                    });

                    $('.menu .menu__list').eq(0).append(menuItem);
                }
            });
        });

        console.log('✅ Расширение "Стриминговые сервисы" загружено');
        Lampa.Noty.show('Стриминговые сервисы добавлены в меню');
    }

    // Альтернативный метод добавления через Settings
    function addToSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'streaming_services',
            name: 'Стриминговые сервисы',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>'
        });

        Object.entries(STREAMING_SERVICES).forEach(([serviceKey, serviceData]) => {
            Lampa.SettingsApi.addParam({
                component: 'streaming_services',
                param: {
                    name: serviceKey,
                    type: 'button',
                    default: true
                },
                field: {
                    name: serviceData.name,
                    description: 'Открыть каталог ' + serviceData.name
                },
                onChange: function() {
                    showCategoriesMenu(serviceKey, serviceData);
                }
            });
        });
    }

    // Запуск расширения
    if (window.Lampa) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') {
                addToSettings();
                console.log('✅ Расширение "Стриминговые сервисы" активировано');
            }
        });
    }

})();
