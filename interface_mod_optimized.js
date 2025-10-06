(function () {
    'use strict';

    var InterFaceMod = {
        name: 'interface_mod',
        version: '2.3.0',
        debug: false,
        settings: {
            enabled: true,
            show_movie_type: true,
            colored_ratings: true,
            colored_elements: true,
            label_position: 'top-right'
        }
    };

    // Функция для добавления лейблов типа контента
    function changeMovieTypeLabels() {
        var styleTag = $('<style id="movie_type_styles"></style>').html(`
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
            
            .serial-label { background-color: #3498db !important; }
            .movie-label { background-color: #2ecc71 !important; }
            .cartoon-label { background-color: #9b59b6 !important; }
            .cartoon-serial-label { background-color: #e67e22 !important; }
            
            body[data-movie-labels="on"] .card--tv .card__type {
                display: none !important;
            }
        `);
        $('head').append(styleTag);
        
        if (InterFaceMod.settings.show_movie_type) {
            $('body').attr('data-movie-labels', 'on');
        }
        
        function addLabelToCard(card) {
            if (!InterFaceMod.settings.show_movie_type) return;
            if ($(card).find('.content-label').length) return;
            
            var view = $(card).find('.card__view');
            if (!view.length) return;
            
            var metadata = {};
            var is_tv = false;
            var is_cartoon = false;
            
            try {
                var cardData = $(card).attr('data-card');
                if (cardData) {
                    try {
                        metadata = JSON.parse(cardData);
                    } catch (e) {}
                }
                
                var jqData = $(card).data();
                if (jqData && Object.keys(jqData).length > 0) {
                    metadata = { ...metadata, ...jqData };
                }
            } catch (e) {
                console.error('Ошибка при получении метаданных:', e);
            }
            
            // Определяем тип контента
            if (metadata) {
                // Проверка на сериал
                if (metadata.type === 'tv' || metadata.card_type === 'tv' || 
                    metadata.seasons || metadata.number_of_seasons > 0) {
                    is_tv = true;
                }
                
                // Проверка на мультфильм/мультсериал
                var genres = metadata.genres || metadata.genre || [];
                if (Array.isArray(genres)) {
                    is_cartoon = genres.some(g => 
                        (g.name && g.name.toLowerCase().includes('мультфильм')) ||
                        (g.name && g.name.toLowerCase().includes('animation')) ||
                        (typeof g === 'string' && g.toLowerCase().includes('мультфильм')) ||
                        (typeof g === 'string' && g.toLowerCase().includes('animation'))
                    );
                }
            }
            
            // Дополнительная проверка по классам
            if (!is_tv && $(card).hasClass('card--tv')) {
                is_tv = true;
            }
            
            var label = $('<div class="content-label"></div>');
            
            // Определяем тип и устанавливаем текст и класс
            if (is_cartoon && is_tv) {
                label.addClass('cartoon-serial-label');
                label.text('Мультсериал');
            } else if (is_cartoon) {
                label.addClass('cartoon-label');
                label.text('Мультик');
            } else if (is_tv) {
                label.addClass('serial-label');
                label.text('Сериал');
            } else {
                label.addClass('movie-label');
                label.text('Фильм');
            }
            
            view.append(label);
        }
        
        function processAllCards() {
            if (!InterFaceMod.settings.show_movie_type) return;
            $('.card').each(function() {
                addLabelToCard(this);
            });
        }
        
        Lampa.Listener.follow('full', function(data) {
            if (data.type === 'complite' && data.data.movie) {
                var movie = data.data.movie;
                var posterContainer = $(data.object.activity.render()).find('.full-start__poster');
                
                if (posterContainer.length && movie && InterFaceMod.settings.show_movie_type) {
                    var is_tv = movie.number_of_seasons > 0 || movie.seasons || movie.type === 'tv';
                    var is_cartoon = false;
                    
                    if (movie.genres && Array.isArray(movie.genres)) {
                        is_cartoon = movie.genres.some(g => 
                            g.name && (g.name.toLowerCase().includes('мультфильм') || 
                                      g.name.toLowerCase().includes('animation'))
                        );
                    }
                    
                    var existingLabel = posterContainer.find('.content-label');
                    if (existingLabel.length) {
                        existingLabel.remove();
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
                    
                    if (is_cartoon && is_tv) {
                        label.addClass('cartoon-serial-label');
                        label.text('Мультсериал');
                        label.css('background-color', '#e67e22');
                    } else if (is_cartoon) {
                        label.addClass('cartoon-label');
                        label.text('Мультик');
                        label.css('background-color', '#9b59b6');
                    } else if (is_tv) {
                        label.addClass('serial-label');
                        label.text('Сериал');
                        label.css('background-color', '#3498db');
                    } else {
                        label.addClass('movie-label');
                        label.text('Фильм');
                        label.css('background-color', '#2ecc71');
                    }
                    
                    posterContainer.css('position', 'relative');
                    posterContainer.append(label);
                }
            }
        });
        
        var observer = new MutationObserver(function(mutations) {
            var cardsToUpdate = new Set();
            
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length) {
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
            });
            
            if (cardsToUpdate.size > 0) {
                setTimeout(function() {
                    cardsToUpdate.forEach(function(card) {
                        $(card).find('.content-label').remove();
                        addLabelToCard(card);
                    });
                }, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        processAllCards();
        setInterval(processAllCards, 2000);
    }

    // Функция для изменения цвета рейтинга
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
        
        $(".card__vote, .full-start__rate, .full-start-new__rate, .info__rate").each(function() {
            applyColorByRating(this);
        });
    }

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
        
        Lampa.Listener.follow('full', function (data) {
            if (data.type === 'complite') {
                setTimeout(updateVoteColors, 100);
            }
        });
    }

    // Функция для цветных статусов
    function colorizeSeriesStatus() {
        if (!InterFaceMod.settings.colored_elements) return;
        
        function applyStatusColor(statusElement) {
            var statusText = $(statusElement).text().trim();
            
            var statusColors = {
                'completed': { bg: 'rgba(46, 204, 113, 0.8)', text: 'white' },
                'canceled': { bg: 'rgba(231, 76, 60, 0.8)', text: 'white' },
                'ongoing': { bg: 'rgba(243, 156, 18, 0.8)', text: 'black' }
            };
            
            var bgColor = '';
            var textColor = '';
            
            if (statusText.includes('Заверш') || statusText.includes('Ended')) {
                bgColor = statusColors.completed.bg;
                textColor = statusColors.completed.text;
            } else if (statusText.includes('Отмен') || statusText.includes('Canceled')) {
                bgColor = statusColors.canceled.bg;
                textColor = statusColors.canceled.text;
            } else if (statusText.includes('Выход') || statusText.includes('В процессе') || statusText.includes('Return')) {
                bgColor = statusColors.ongoing.bg;
                textColor = statusColors.ongoing.text;
            }
            
            if (bgColor) {
                $(statusElement).css({
                    'background-color': bgColor,
                    'color': textColor,
                    'border-radius': '0.3em',
                    'border': '0px',
                    'font-size': '1.3em',
                    'display': 'inline-block',
                    'padding': '0.2em 0.5em'
                });
            }
        }
        
        $('.full-start__status').each(function() {
            applyStatusColor(this);
        });
        
        var statusObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length) {
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

    // Функция инициализации
    function startPlugin() {
        Lampa.SettingsApi.addComponent({
            component: 'interface_mod_simple',
            name: 'Интерфейс мод (простой)',
            icon: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V7C20 7.55228 19.5523 8 19 8H5C4.44772 8 4 7.55228 4 7V5Z" fill="currentColor"/></svg>'
        });
        
        Lampa.SettingsApi.addParam({
            component: 'interface_mod_simple',
            param: {
                name: 'show_movie_type',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Показывать лейблы типа',
                description: 'Фильм, Сериал, Мультик, Мультсериал'
            },
            onChange: function (value) {
                InterFaceMod.settings.show_movie_type = value;
                Lampa.Storage.set('show_movie_type', value);
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
                Lampa.Storage.set('colored_ratings', value);
                
                if (value) {
                    setupVoteColorsObserver();
                } else {
                    $(".card__vote, .full-start__rate, .full-start-new__rate, .info__rate").css("color", "");
                }
            }
        });
        
        Lampa.SettingsApi.addParam({
            component: 'interface_mod_simple',
            param: {
                name: 'colored_elements',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Цветные статусы',
                description: 'Завершён, Отменён, Выходит'
            },
            onChange: function (value) {
                InterFaceMod.settings.colored_elements = value;
                Lampa.Storage.set('colored_elements', value);
                
                if (value) {
                    colorizeSeriesStatus();
                } else {
                    $('.full-start__status').css({
                        'background-color': '',
                        'color': ''
                    });
                }
            }
        });
        
        // Применяем настройки
        InterFaceMod.settings.show_movie_type = Lampa.Storage.get('show_movie_type', true);
        InterFaceMod.settings.colored_ratings = Lampa.Storage.get('colored_ratings', true);
        InterFaceMod.settings.colored_elements = Lampa.Storage.get('colored_elements', true);
        
        changeMovieTypeLabels();
        
        if (InterFaceMod.settings.colored_ratings) {
            setupVoteColorsObserver();
        }
        
        if (InterFaceMod.settings.colored_elements) {
            colorizeSeriesStatus();
        }
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') {
                startPlugin();
            }
        });
    }

    window.interface_mod_simple = InterFaceMod;
})();
