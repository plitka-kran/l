// Плагин для Lampa: Добавление категорий стриминговых сервисов с использованием встроенного TMDB
// Автор: Grok (на основе Lampa API)
// Версия: 1.1

(function() {
    'use strict';

    // Список сервисов (ID из TMDB)
    const providers = {
        'Netflix': 8,
        'HBO Max': 2,
        'Hulu': 3,
        'Disney+': 99,
        'Prime Video': 9
    };

    const REGION = 'US'; // Или 'RU' для России

    // Функция для fetching через встроенный TMDB Lampa
    function fetchContent(providerId, category, page = 1) {
        let url = '';
        let params = {
            language: 'ru-RU',
            watch_region: REGION,
            with_watch_providers: providerId,
            page: page
        };

        switch (category) {
            case 'movies':
                url = '/discover/movie';
                break;
            case 'series':
                url = '/discover/tv';
                break;
            case 'new':
                url = '/trending/all/week';
                break;
            case 'popular':
                url = '/discover/movie'; // Для сериалов — '/discover/tv'
                if (category === 'series') url = '/discover/tv';
                params.sort_by = 'popularity.desc';
                break;
            default:
                return Promise.reject('Неизвестная категория');
        }

        // Используем встроенный TMDB Lampa (если доступен)
        if (typeof Lampa.TMDB !== 'undefined' && Lampa.TMDB.request) {
            return Lampa.TMDB.request(url, params).then(data => processTMDBData(data));
        } else if (typeof Lampa.Api !== 'undefined' && Lampa.Api.tmdb) {
            return Lampa.Api.tmdb({url: url, params: params}).then(data => processTMDBData(data));
        } else {
            // Fallback на прямой fetch (с дефолтным ключом Lampa, если известен; иначе укажи свой)
            const TMDB_API_KEY = ''; // Lampa использует свой, но для теста возьми с themoviedb.org
            const fullUrl = `https://api.themoviedb.org/3${url}?api_key=${TMDB_API_KEY}&${new URLSearchParams(params)}`;
            return fetch(fullUrl).then(res => res.json()).then(data => processTMDBData(data));
        }
    }

    // Обработка данных TMDB (общее для всех методов)
    function processTMDBData(data) {
        if (data.results) {
            return data.results.map(item => ({
                title: item.title || item.name,
                original_title: item.original_title || item.original_name,
                img: `https://image.tmdb.org/t/p/w300${item.poster_path}`,
                description: item.overview,
                year: item.release_date ? new Date(item.release_date).getFullYear() : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : ''),
                id: item.id,
                type: item.title ? 'movie' : 'tv'
            }));
        }
        return [];
    }

    // Функция для создания подменю (без изменений)
    function createSubMenu(providerName, providerId) {
        const html = `
            <div class="selector" style="padding: 20px;">
                <div class="full-start__buttons selector no-margin">
                    <div class="full-start__button selector" data-action="movies">
                        <div class="full-start__button-titles">
                            <div class="full-start__button-title">Фильмы</div>
                        </div>
                    </div>
                    <div class="full-start__button selector" data-action="series">
                        <div class="full-start__button-titles">
                            <div class="full-start__button-title">Сериалы</div>
                        </div>
                    </div>
                    <div class="full-start__button selector" data-action="new">
                        <div class="full-start__button-titles">
                            <div class="full-start__button-title">Новинки</div>
                        </div>
                    </div>
                    <div class="full-start__button selector" data-action="popular">
                        <div class="full-start__button-titles">
                            <div class="full-start__button-title">Популярные</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $(html).find('[data-action]').on('hover:enter', function(e) {
            const action = $(this).data('action');
            if (action === 'series') action = 'series'; // Для popular скорректировать в fetch
            loadContent(providerName, providerId, action);
        });

        return html;
    }

    // Функция для загрузки и отображения (адаптировано под Lampa)
    function loadContent(providerName, providerId, category) {
        fetchContent(providerId, category).then(items => {
            if (items.length === 0) {
                Lampa.Noty.show('Контент не найден');
                return;
            }

            // Создаём HTML для карточек
            let html = '';
            items.forEach(item => {
                html += `<div class="full-item" data-item="${JSON.stringify(item)}">
                    <div class="full-item__img" style="background-image: url(${item.img});"></div>
                    <div class="full-item__title">${item.title} (${item.year})</div>
                    <div class="full-item__text">${item.description.substring(0, 100)}...</div>
                </div>`;
            });

            // Пушим в Activity Lampa
            Lampa.Activity.push({
                url: '',
                title: `${providerName} - ${category.charAt(0).toUpperCase() + category.slice(1)}`,
                component: 'full',
                html: `<div class="full-start__body selector">${html}</div>`,
                onBack: () => Lampa.Activity.back(),
                // Обработчик клика на карточку (Lampa сама найдёт торренты/онлайн)
                toggle: () => {
                    $('.full-item').on('hover:enter', function() {
                        const item = JSON.parse($(this).attr('data-item'));
                        Lampa.Activity.push({
                            url: item.id,
                            component: 'full',
                            movie: { object: item }
                        });
                    });
                }
            });
        }).catch(err => Lampa.Noty.show('Ошибка: ' + err.message));
    }

    // Добавление в меню (без изменений)
    Lampa.Listener.follow('app', function(e) {
        if (e.type == 'ready') {
            const menuItem = {
                title: 'Сервисы',
                items: Object.keys(providers).map(name => ({
                    title: name,
                    subtitle: 'Фильмы, сериалы, новинки',
                    one: '🛋️',
                    action: () => {
                        const html_string = createSubMenu(name, providers[name]);
                        Lampa.Select.show({
                            title: name,
                            items: [],
                            html: html_string,
                            onSelect: false,
                            onBack: () => Lampa.Activity.back()
                        });
                    }
                }))
            };
            if (Lampa.Menu) {
                Lampa.Menu.add('main', menuItem, { before: 'catalog' });
            }
        }
    });

    console.log('Плагин Streaming Services (TMDB Lampa) загружен');
})();
