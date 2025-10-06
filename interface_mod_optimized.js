(function () {
    'use strict';

    // Основной объект плагина
    var InterFaceMod = {
        // Название плагина
        name: 'interface_mod_simple',
        // Версия плагина
        version: '1.0.0',
        // Включить отладку
        debug: false,
        // Настройки по умолчанию
        settings: {
            enabled: true,
            show_movie_type: true,
            colored_ratings: true,
            colored_status: true // Настройка для цветных статусов
        }
    };

    // Функция для изменения лейблов типов контента (фильм, сериал, мультик, мультсериал)
    function changeMovieTypeLabels() {
        // Добавляем CSS стили для изменения лейблов
        var styleTag = $('<style id="movie_type_styles"></style>').html(`
            /* Базовый стиль для всех лейблов */
            .content-label {
                position: absolute !important;
                top: 1.4em !important;
                left: -0.8em !important;
                color: white !important;
                padding: 0.4em 0.4em !important;
                border-radius: 0.3em !important;
                font-size: 0.8em !important;
                z-index: 10 !important;
            }
            
            /* Сериал - синий */
            .serial-label {
                background-color: #3498db !important;
            }
            
            /* Мультсериал - фиолетовый */
            .multserial-label {
                background-color: #9b59b6 !important;
            }
            
            /* Фильм - зелёный */
            .movie-label {
                background-color: #2ecc71 !important;
            }
            
            /* Мультик - оранжевый */
            .mult-label {
                background-color: #e67e22 !important;
            }
            
            /* Скрываем встроенный лейбл TV только при включенной функции */
            body[data-movie-labels="on"] .card--tv .card__type {
                display: none !important;
            }
        `);
        $('head').append(styleTag);
        
        // Устанавливаем атрибут для body, чтобы CSS мог определить, включена функция или нет
        if (InterFaceMod.settings.show_movie_type) {
            $('body').attr('data-movie-labels', 'on');
        } else {
            $('body').attr('data-movie-labels', 'off');
        }
        
        // Функция для добавления лейбла к карточке
        function addLabelToCard(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            
            // Если уже есть наш лейбл, пропускаем
            if ($(card).find('.content-label').length) return;
            
            var view = $(card).find('.card__view');
            if (!view.length) return;
            
            var metadata = {};
            var movie_data = null;
            
            // Попытаемся получить метаданные
            try {
                var cardData = $(card).attr('data-card');
                if (cardData) {
                    metadata = JSON.parse(cardData);
                }
                
                var jqData = $(card).data();
                if (jqData) {
                    metadata = { ...metadata, ...jqData };
                }
                
                if (Lampa.Card && $(card).attr('id')) {
                    var cardObj = Lampa.Card.get($(card).attr('id'));
                    if (cardObj) {
                        metadata = { ...metadata, ...cardObj };
                    }
                }
                
                if (Lampa.Storage && Lampa.Storage.cache) {
                    var itemId = $(card).data('id') || $(card).attr('data-id') || metadata.id;
                    if (itemId && Lampa.Storage.cache('card_' + itemId)) {
                        var cachedData = Lampa.Storage.cache('card_' + itemId);
                        metadata = { ...metadata, ...cachedData };
                    }
                }
                
                movie_data = metadata;
            } catch (e) {
                console.error('Ошибка при получении метаданных:', e);
            }
            
            // Логика определения типа контента
            var type = 'movie'; // По умолчанию фильм
            
            if (movie_data) {
                // Определяем, сериал ли это
                var is_tv = (movie_data.type === 'tv' || movie_data.type === 'serial' ||
                             movie_data.card_type === 'tv' || movie_data.card_type === 'serial' ||
                             movie_data.number_of_seasons > 0 || movie_data.seasons ||
                             movie_data.episodes || movie_data.number_of_episodes > 0 ||
                             movie_data.isSeries === true || movie_data.is_series === true);
                
                // Определяем, анимация ли это (мультик/мультсериал)
                var is_animation = false;
                if (movie_data.genres) {
                    is_animation = movie_data.genres.some(genre => genre.id === 16 || genre.name.toLowerCase().includes('animation') || genre.name.toLowerCase().includes('анимация'));
                } else if (movie_data.genre_ids && movie_data.genre_ids.includes(16)) {
                    is_animation = true;
                } else if (movie_data.genre && movie_data.genre.toLowerCase().includes('animation')) {
                    is_animation = true;
                }
                
                if (is_tv && is_animation) {
                    type = 'multserial'; // Мультсериал
                } else if (is_tv) {
                    type = 'serial'; // Сериал
                } else if (is_animation) {
                    type = 'mult'; // Мультик
                } else {
                    type = 'movie'; // Фильм
                }
            } else {
                // Fallback по классам
                if ($(card).hasClass('card--tv')) {
                    type = 'serial';
                }
            }
            
            // Создаем и добавляем лейбл
            var label = $('<div class="content-label"></div>');
            
            if (type === 'serial') {
                label.addClass('serial-label');
                label.text('Сериал');
            } else if (type === 'multserial') {
                label.addClass('multserial-label');
                label.text('Мультсериал');
            } else if (type === 'movie') {
                label.addClass('movie-label');
                label.text('Фильм');
            } else if (type === 'mult') {
                label.addClass('mult-label');
                label.text('Мультик');
            }
            
            view.append(label);
            
            if (InterFaceMod.debug) {
                console.log('Добавлен лейбл: ' + type, card);
            }
        }
        
        // Обновление лейбла при изменении данных карточки
        function updateCardLabel(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            
            $(card).find('.content-label').remove();
            addLabelToCard(card);
        }
        
        // Обработка всех карточек
        function processAllCards() {
            if (!InterFaceMod.settings.show_movie_type) return;
            
            $('.card').each(function() {
                addLabelToCard(this);
            });
        }
        
        // Дополнительный слушатель для карточек в детальном представлении
        Lampa.Listener.follow('full', function(data) {
            if (data.type === 'complite' && data.data.movie) {
                var movie = data.data.movie;
                var posterContainer = $(data.object.activity.render()).find('.full-start__poster');
                
                if (posterContainer.length && movie && InterFaceMod.settings.show_movie_type) {
                    var existingLabel = posterContainer.find('.content-label');
                    if (existingLabel.length) {
                        existingLabel.remove();
                    }
                    
                    var type = 'movie';
                    var is_tv = (movie.number_of_seasons > 0 || movie.seasons || movie.type === 'tv');
                    var is_animation = false;
                    if (movie.genres) {
                        is_animation = movie.genres.some(genre => genre.id === 16 || genre.name.toLowerCase().includes('animation'));
                    } else if (movie.genre_ids && movie.genre_ids.includes(16)) {
                        is_animation = true;
                    }
                    
                    if (is_tv && is_animation) {
                        type = 'multserial';
                    } else if (is_tv) {
                        type = 'serial';
                    } else if (is_animation) {
                        type = 'mult';
                    }
                    
                    var label = $('<div class="content-label"></div>').css({
                        'position': 'absolute',
                        'top': '1.4em',
                        'left': '-0.8em',
                        'color': 'white',
                        'padding': '0.4em 0.4em',
                        'border-radius': '0.3em',
                        'font-size': '0.8em',
                        'z-index': '10'
                    });
                    
                    if (type === 'serial') {
                        label.addClass('serial-label');
                        label.text('Сериал');
                        label.css('background-color', '#3498db');
                    } else if (type === 'multserial') {
                        label.addClass('multserial-label');
                        label.text('Мультсериал');
                        label.css('background-color', '#9b59b6');
                    } else if (type === 'movie') {
                        label.addClass('movie-label');
                        label.text('Фильм');
                        label.css('background-color', '#2ecc71');
                    } else if (type === 'mult') {
                        label.addClass('mult-label');
                        label.text('Мультик');
                        label.css('background-color', '#e67e22');
                    }
                    
                    posterContainer.css('position', 'relative');
                    posterContainer.append(label);
                }
            }
        });
        
        // MutationObserver для новых карточек и изменений
        var observer = new MutationObserver(function(mutations) {
            var cardsToUpdate = new Set();
            
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        if ($(node).hasClass('card')) {
                            cardsToUpdate.add(node);
                        } else if ($(node).find('.card').length) {
                            $(node).find('.card').each(function() {
                                cardsToUpdate.add(this);
                            });
                        }
                    }
                }
                
                if (mutation.type === 'attributes' && 
                    (mutation.attributeName === 'class' || mutation.attributeName === 'data-card' || mutation.attributeName === 'data-type')) {
                    var targetNode = mutation.target;
                    if ($(targetNode).hasClass('card')) {
                        cardsToUpdate.add(targetNode);
                    }
                }
            });
            
            if (cardsToUpdate.size > 0) {
                setTimeout(function() {
                    cardsToUpdate.forEach(function(card) {
                        updateCardLabel(card);
                    });
                }, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-card', 'data-type']
        });
        
        processAllCards();
        
        setInterval(processAllCards, 2000);
        
        Lampa.Settings.listener.follow('change', function(e) {
            if (e.name === 'show_movie_type') {
                if (e.value) {
                    $('body').attr('data-movie-labels', 'on');
                    processAllCards();
                } else {
                    $('body').attr('data-movie-labels', 'off');
                    $('.content-label').remove();
                }
            }
        });
    }

    // Функция для изменения цвета рейтинга фильмов и сериалов
    function updateVoteColors() {
        if (!InterFaceMod.settings.colored_ratings) return;
        
        function applyColorByRating(element) {
            const voteText = $(element).text().trim();
            const match = voteText.match(/(\d+(\.\d+)?)/);
            if (!match) return;
            
            const vote = parseFloat(match[0]);
            
            if (vote >= 0 && vote <= 3) {
                $(element).css('color', "red");
            } else if (vote > 3 && vote < 6) {
                $(element).css('color', "orange");
            } else if (vote >= 6 && vote < 8) {
                $(element).css('color', "cornflowerblue");
            } else if (vote >= 8 && vote <= 10) {
                $(element).css('color', "lawngreen");
            }
        }
        
        $(".card__vote, .full-start__rate, .full-start-new__rate, .info__rate, .card__imdb-rate, .card__kinopoisk-rate").each(function() {
            applyColorByRating(this);
        });
    }

    // Наблюдатель за изменениями в DOM для обновления цветов рейтинга
    function setupVoteColorsObserver() {
        if (!InterFaceMod.settings.colored_ratings) return;
        
        setTimeout(updateVoteColors, 500);
        
        const observer = new MutationObserver(function() {
            setTimeout(updateVoteColors, 100);
        });
        
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }

    // Добавляем слушатель для обновления цветов в детальной карточке
    function setupVoteColorsForDetailPage() {
        if (!InterFaceMod.settings.colored_ratings) return;
        
        Lampa.Listener.follow('full', function (data) {
            if (data.type === 'complite') {
                setTimeout(updateVoteColors, 100);
            }
        });
    }

    // Функция для изменения цвета статусов сериалов (Завершён, Не завершён и т.д.)
    function colorizeSeriesStatus() {
        if (!InterFaceMod.settings.colored_status) return;
        
        function applyStatusColor(statusElement) {
            var statusText = $(statusElement).text().trim();
            
            var statusColors = {
                'completed': {
                    bg: 'rgba(46, 204, 113, 0.8)', // Зеленый
                    text: 'white'
                },
                'canceled': {
                    bg: 'rgba(231, 76, 60, 0.8)', // Красный
                    text: 'white'
                },
                'ongoing': {
                    bg: 'rgba(243, 156, 18, 0.8)', // Желтый/Оранжевый
                    text: 'black'
                },
                'production': {
                    bg: 'rgba(52, 152, 219, 0.8)', // Синий
                    text: 'white'
                },
                'planned': {
                    bg: 'rgba(155, 89, 182, 0.8)', // Фиолетовый
                    text: 'white'
                },
                'pilot': {
                    bg: 'rgba(230, 126, 34, 0.8)', // Оранжевый
                    text: 'white'
                },
                'released': {
                    bg: 'rgba(26, 188, 156, 0.8)', // Бирюзовый
                    text: 'white'
                },
                'rumored': {
                    bg: 'rgba(149, 165, 166, 0.8)', // Серый
                    text: 'white'
                },
                'post': {
                    bg: 'rgba(0, 188, 212, 0.8)', // Голубой
                    text: 'white'
                }
            };
            
            var bgColor = '';
            var textColor = '';
            
            if (statusText.includes('Заверш') || statusText.includes('Ended')) {
                bgColor = statusColors.completed.bg;
                textColor = statusColors.completed.text;
            } else if (statusText.includes('Отмен') || statusText.includes('Canceled')) {
                bgColor = statusColors.canceled.bg;
                textColor = statusColors.canceled.text;
            } else if (statusText.includes('Онгоинг') || statusText.includes('Выход') || statusText.includes('В процессе') || statusText.includes('Return')) {
                bgColor = statusColors.ongoing.bg;
                textColor = statusColors.ongoing.text;
            } else if (statusText.includes('производстве') || statusText.includes('Production')) {
                bgColor = statusColors.production.bg;
                textColor = statusColors.production.text;
            } else if (statusText.includes('Запланировано') || statusText.includes('Planned')) {
                bgColor = statusColors.planned.bg;
                textColor = statusColors.planned.text;
            } else if (statusText.includes('Пилотный') || statusText.includes('Pilot')) {
                bgColor = statusColors.pilot.bg;
                textColor = statusColors.pilot.text;
            } else if (statusText.includes('Выпущенный') || statusText.includes('Released')) {
                bgColor = statusColors.released.bg;
                textColor = statusColors.released.text;
            } else if (statusText.includes('слухам') || statusText.includes('Rumored')) {
                bgColor = statusColors.rumored.bg;
                textColor = statusColors.rumored.text;
            } else if (statusText.includes('Скоро') || statusText.includes('Post')) {
                bgColor = statusColors.post.bg;
                textColor = statusColors.post.text;
            }
            
            if (bgColor) {
                $(statusElement).css({
                    'background-color': bgColor,
                    'color': textColor,
                    'border-radius': '0.3em',
                    'border': '0px',
                    'font-size': '1.3em',
                    'display': 'inline-block'
                });
            }
            
            if (InterFaceMod.debug) {
                console.log('Статус сериала:', statusText, bgColor, textColor);
            }
        }
        
        $('.full-start__status').each(function() {
            applyStatusColor(this);
        });
        
        var statusObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes) {
                    for (var i = 0; i < mutation.addedNodes.length; i++) {
                        var node = mutation.addedNodes[i];
                        $(node).find('.full-start__status').each(function() {
                            applyStatusColor(this);
                        });
                        
                        if ($(node).hasClass('full-start__status')) {
                            applyStatusColor(node);
                        }
                    }
                }
            });
        });
        
        statusObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        Lampa.Listener.follow('full', function(data) {
            if (data.type === 'complite' && data.data.movie) {
                setTimeout(function() {
                    $(data.object.activity.render()).find('.full-start__status').each(function() {
                        applyStatusColor(this);
                    });
                }, 100);
            }
        });
    }

    // Функция инициализации плагина
    function startPlugin() {
        // Регистрируем плагин в Lampa
        Lampa.SettingsApi.addComponent({
            component: 'interface_mod_simple',
            name: 'Интерфейс мод (упрощенный)',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/><path d="M4 11C4 10.4477 4.44772 10 5 10H19C19.5523 10 20 10.4477 20 11V13C20 13.5523 19.5523 14 19 14H5C4.44772 14 4 13.5523 4 13V11Z" fill="currentColor"/><path d="M4 17C4 16.4477 4.44772 16 5 16H19C19.5523 16 20 16.4477 20 17V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V17Z" fill="currentColor"/></svg>'
        });
        
        // Добавляем настройки
        Lampa.SettingsApi.addParam({
            component: 'interface_mod_simple',
            param: {
                name: 'show_movie_type',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Лейблы типов (фильм/сериал/мультик/мультсериал)',
                description: 'Отображать лейблы для типов контента'
            },
            onChange: function (value) {
                InterFaceMod.settings.show_movie_type = value;
                Lampa.Settings.update();
            }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'interface_mod_simple',
            param: {
                name: 'colored_ratings',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Цветные рейтинги',
                description: 'Изменять цвет рейтинга в зависимости от оценки'
            },
            onChange: function (value) {
                InterFaceMod.settings.colored_ratings = value;
                Lampa.Settings.update();
                
                setTimeout(function() {
                    if (value) {
                        setupVoteColorsObserver();
                        setupVoteColorsForDetailPage();
                    } else {
                        $(".card__vote, .full-start__rate, .full-start-new__rate, .info__rate, .card__imdb-rate, .card__kinopoisk-rate").css("color", "");
                    }
                }, 0);
            }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'interface_mod_simple',
            param: {
                name: 'colored_status',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Цветные статусы сериалов',
                description: 'Отображать статусы сериалов (Завершён, Не завершён и т.д.) цветными'
            },
            onChange: function (value) {
                InterFaceMod.settings.colored_status = value;
                Lampa.Settings.update();
                
                if (value) {
                    colorizeSeriesStatus();
                } else {
                    $('.full-start__status').css({
                        'background-color': '',
                        'color': '',
                        'border-radius': '',
                        'border': '',
                        'font-size': '',
                        'display': ''
                    });
                }
            }
        });
        
        // Применяем настройки
        InterFaceMod.settings.show_movie_type = Lampa.Storage.get('show_movie_type', true);
        InterFaceMod.settings.colored_ratings = Lampa.Storage.get('colored_ratings', true);
        InterFaceMod.settings.colored_status = Lampa.Storage.get('colored_status', true);
        
        // Запускаем функции
        changeMovieTypeLabels();
        
        if (InterFaceMod.settings.colored_ratings) {
            setupVoteColorsObserver();
            setupVoteColorsForDetailPage();
        }
        
        if (InterFaceMod.settings.colored_status) {
            colorizeSeriesStatus();
        }

        // Перемещение настроек после "Интерфейс"
        Lampa.Settings.listener.follow('open', function (e) {
            setTimeout(function() {
                var interfaceMod = $('.settings-folder[data-component="interface_mod_simple"]');
                var interfaceStandard = $('.settings-folder[data-component="interface"]');
                
                if (interfaceMod.length && interfaceStandard.length) {
                    interfaceMod.insertAfter(interfaceStandard);
                }
            }, 100);
        });
    }

    // Ждем загрузки приложения и запускаем плагин
    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                startPlugin();
            }
        });
    }

    // Регистрация плагина в манифесте
    Lampa.Manifest.plugins = {
        name: 'Интерфейс мод (упрощенный)',
        version: '1.0.0',
        description: 'Упрощенная версия: лейблы типов, цвета рейтингов и статусов'
    };

    // Экспортируем объект плагина
    window.interface_mod_simple = InterFaceMod;
})();
