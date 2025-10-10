// Плагин для Lampa: Добавление категорий стриминговых сервисов
// Автор: Grok (на основе Lampa API)
// Версия: 1.0

(function() {
    'use strict';

    // Список сервисов (ID из TMDB: netflix=8, hbo=2, hulu=3, disney=99, prime=9)
    const providers = {
        'Netflix': 8,
        'HBO Max': 2,
        'Hulu': 3,
        'Disney+': 99,
        'Prime Video': 9
    };

    // TMDB API ключ (замени на свой, если нужно; Lampa может использовать дефолтный)
    const TMDB_API_KEY = 'твой_api_key_здесь'; // Получи на https://www.themoviedb.org/
    const TMDB_BASE = 'https://api.themoviedb.org/3';
    const REGION = 'US'; // Измени на 'RU' для России, если нужно

    // Функция для fetching данных из TMDB
    function fetchContent(providerId, category, page = 1) {
        let endpoint = '';
        let params = `?api_key=${TMDB_API_KEY}&language=ru-RU&watch_region=${REGION}&with_watch_providers=${providerId}&page=${page}`;
        
        switch (category) {
            case 'movies':
                endpoint = '/discover/movie' + params;
                break;
            case 'series':
                endpoint = '/discover/tv' + params;
                break;
            case 'new':
                endpoint = '/trending/all/week' + params; // Новинки (trending)
                break;
            case 'popular':
                endpoint = '/discover/movie' + params + '&sort_by=popularity.desc'; // Популярные (для фильмов, аналог для сериалов)
                if (category === 'series') endpoint = '/discover/tv' + params + '&sort_by=popularity.desc';
                break;
            default:
                return Promise.reject('Неизвестная категория');
        }

        return fetch(TMDB_BASE + endpoint)
            .then(response => response.json())
            .then(data => {
                if (data.results) {
                    return data.results.map(item => ({
                        title: item.title || item.name,
                        original_title: item.original_title || item.original_name,
                        img: `https://image.tmdb.org/t/p/w300${item.poster_path}`,
                        description: item.overview,
                        year: item.release_date ? new Date(item.release_date).getFullYear() : item.first_air_date ? new Date(item.first_air_date).getFullYear() : '',
                        id: item.id,
                        type: category === 'movies' || category === 'popular' && !item.name ? 'movie' : 'tv'
                    }));
                }
                return [];
            })
            .catch(err => {
                Lampa.Noty.show('Ошибка загрузки: ' + err.message);
                return [];
            });
    }

    // Функция для создания подменю (фильмы, сериалы и т.д.)
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

        // Обработчики кликов
        $(html).find('[data-action]').on('hover:enter', function(e) {
            const action = $(this).data('action');
            loadContent(providerName, providerId, action);
        });

        return html;
    }

    // Функция для загрузки и отображения контента
    function loadContent(providerName, providerId, category) {
        fetchContent(providerId, category).then(items => {
            if (items.length === 0) {
                Lampa.Noty.show('Контент не найден');
                return;
            }

            // Создаем карточки (используем шаблон Lampa)
            const html = items.map(item => Lampa.Template.get('card', {
                title: item.title,
                subtitle: item.year,
                img: item.img,
                description: item.description,
                href: item.id // Для перехода в детали Lampa
            })).join('');

            // Отображаем в компоненте Lampa (cards view)
            var params = {
                title: `${providerName} - ${category.toUpperCase()}`,
                html: html,
                object: { // Объект для навигации
                    source: 'tmdb',
                    page: 1
                }
            };
            Lampa.Activity.push({
                url: '',
                title: params.title,
                component: 'full',
                search: params.title,
                search_one: params.title,
                search_two: params.title,
                movie: { object: params.object },
                page: 1,
                html: Lampa.Template.get('items_line', { items: items }) // Или cards
            });
        });
    }

    // Добавление в главное меню (левый сайдбар)
    Lampa.Listener.follow('app', function(e) {
        if (e.type === 'ready') {
            // Добавляем раздел "Сервисы" в меню
            const menuItem = {
                title: 'Сервисы',
                items: Object.keys(providers).map(providerName => ({
                    title: providerName,
                    subtitle: 'Фильмы, сериалы и новинки',
                    one: '🛋️',
                    action: () => {
                        // Показываем подменю
                        html_string = createSubMenu(providerName, providers[providerName]);
                        Lampa.Select.show({
                            title: providerName,
                            items: [], // Пустой, используем кастом html
                            html: html_string,
                            onSelect: false,
                            onBack: () => Lampa.Activity.back()
                        });
                    }
                }))
            };

            // Вставляем в меню (Lampa.Menu.add или extend)
            if (typeof Lampa.Menu !== 'undefined') {
                Lampa.Menu.add('main', menuItem, { before: 'catalog' }); // Добавляем перед "Каталог"
            } else {
                console.log('Lampa.Menu не доступен, плагин не загружен');
            }
        }
    });

    // Логирование для дебага
    console.log('Плагин Streaming Services загружен');
})();
