(function () {
    'use strict';

    function translate() {
        Lampa.Lang.add({
            lme_parser: {
                ru: 'Каталог парсеров',
                en: 'Parsers catalog',
                uk: 'Каталог парсерів',
                zh: '解析器目录'
            },
            lme_parser_description: {
                ru: 'Нажмите для выбора парсера из ',
                en: 'Click to select a parser from the ',
                uk: 'Натисніть для вибору парсера з ',
                zh: '单击以从可用的 '
            },
            lme_parser_current: {
                ru: 'Текущий выбор:',
                en: 'Current selection:',
                uk: 'Поточний вибір:',
                zh: '当前选择：'
            },
            lme_parser_selected: {
                ru: 'Выбрано',
                en: 'Selected',
                uk: 'Обрано',
                zh: '已选择'
            },
            lme_parser_refresh: {
                ru: 'Обновить проверку',
                en: 'Refresh check',
                uk: 'Оновити перевірку',
                zh: '刷新检测'
            },
            lme_parser_none: {
                ru: 'Не выбран',
                en: 'Not selected',
                uk: 'Не вибрано',
                zh: '未选择'
            },
            lme_parser_none_description: {
                ru: 'Без активного парсера',
                en: 'No active parser',
                uk: 'Без активного парсера',
                zh: '未启用解析器'
            },
            lme_parser_health: {
                ru: 'Индикация состояния парсеров',
                en: 'Parser health indicator',
                uk: 'Індикація стану парсерів',
                zh: '解析器状态指示'
            },
            lme_parser_status_ok: {
                ru: 'Доступен',
                en: 'Available',
                uk: 'Доступний',
                zh: '可用'
            },
            lme_parser_status_auth: {
                ru: 'Ошибка ключа',
                en: 'Auth error',
                uk: 'Помилка ключа',
                zh: '密钥错误'
            },
            lme_parser_status_network: {
                ru: 'Недоступен',
                en: 'Unavailable',
                uk: 'Недоступний',
                zh: '不可用'
            },
            lme_parser_status_unknown: {
                ru: 'Не проверен',
                en: 'Unchecked',
                uk: 'Не перевірено',
                zh: '未检查'
            },
            lme_parser_status_checking: {
                ru: 'Проверка...',
                en: 'Checking...',
                uk: 'Перевірка...',
                zh: '检查中...'
            },
            lme_pubtorr: {
                ru: 'Каталог TorrServer',
                en: 'TorrServer catalog',
                uk: 'Каталог TorrServer',
                zh: '解析器目录'
            },
            lme_pubtorr_description: {
                ru: 'Бесплатные серверы от проекта LME',
                en: 'Free servers from the LME project',
                uk: 'Безкоштовні сервери від проєкту LME',
                zh: '来自 LME 项目的免费服务器 '
            },
            lme_pubtorr_firstrun: {
                "ru": "Привет! Ты установил плагин LME PubTorr, учти что если стоит Mods's то в разделе парсеров будет ошибка, которая не влияет на работу. Хочешь избавиться - оставь или LME PubTorr или Mods's.",
                "en": "Hello! You have installed the LME PubTorr plugin. Note that if Mods's is enabled, there will be an error in the parsers section that does not affect functionality. If you want to get rid of it, keep either LME PubTorr or Mods's.",
                "uk": "Привіт! Ви встановили плагін LME PubTorr, врахуйте, що якщо активовано Mods's, то в розділі парсерів буде помилка, яка не впливає на роботу. Якщо хочете позбутися - залиште або LME PubTorr, або Mods's.",
                "zh": "你好！你安装了LME PubTorr插件，请注意，如果启用了Mods's，解析器部分将出现错误，但这不会影响功能。如果你想摆脱它，请保留LME PubTorr或Mods's。"
            }
        });
    }

    var parsersInfo = [{
        id: 'lampa_app',
        name: 'Lampa.app',
        settings: {
            url: 'lampa.app',
            key: '',
            parser_torrent_type: 'jackett'
        }
    }, {
        id: 'jac_black',
        name: 'jac.black',
        settings: {
            url: 'jac.black',
            key: '',
            parser_torrent_type: 'jackett'
        }
    }, {
        id: 'jacred',
        name: 'Jac.red',
        settings: {
            url: 'jac.red',
            key: '',
            parser_torrent_type: 'jackett'
        }
    }, {
        id: 'JaCred_xyz',
        name: 'Jacred.xyz',
        settings: {
            url: 'jacred.xyz',
            key: '',
            parser_torrent_type: 'jackett'
        }
    }, {
        id: 'JaCred_su',
        name: 'JacRed.su',
        settings: {
            url: 'jacred.su',
            key: '',
            parser_torrent_type: 'jackett'
        }
    }, {
        id: 'jac_red_ru',
        name: 'jac-red.ru',
        settings: {
            url: 'jac-red.ru',
            key: '',
            parser_torrent_type: 'jackett'
        }
    }];

    function _arrayLikeToArray(r, a) {
        (null == a || a > r.length) && (a = r.length);
        for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
        return n;
    }
    function _arrayWithoutHoles(r) {
        if (Array.isArray(r)) return _arrayLikeToArray(r);
    }
    function _defineProperty(e, r, t) {
        return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
            value: t,
            enumerable: !0,
            configurable: !0,
            writable: !0
        }) : e[r] = t, e;
    }
    function _iterableToArray(r) {
        if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r);
    }
    function _nonIterableSpread() {
        throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    function ownKeys(e, r) {
        var t = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
            var o = Object.getOwnPropertySymbols(e);
            r && (o = o.filter(function (r) {
                return Object.getOwnPropertyDescriptor(e, r).enumerable;
            })), t.push.apply(t, o);
        }
        return t;
    }
    function _objectSpread2(e) {
        for (var r = 1; r < arguments.length; r++) {
            var t = null != arguments[r] ? arguments[r] : {};
            r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
                _defineProperty(e, r, t[r]);
            }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
                Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
            });
        }
        return e;
    }
    function _toConsumableArray(r) {
        return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread();
    }
    function _toPrimitive(t, r) {
        if ("object" != typeof t || !t) return t;
        var e = t[Symbol.toPrimitive];
        if (void 0 !== e) {
            var i = e.call(t, r || "default");
            if ("object" != typeof i) return i;
            throw new TypeError("@@toPrimitive must return a primitive value.");
        }
        return ("string" === r ? String : Number)(t);
    }
    function _toPropertyKey(t) {
        var i = _toPrimitive(t, "string");
        return "symbol" == typeof i ? i : i + "";
    }
    function _unsupportedIterableToArray(r, a) {
        if (r) {
            if ("string" == typeof r) return _arrayLikeToArray(r, a);
            var t = {}.toString.call(r).slice(8, -1);
            return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
        }
    }

    var STATUS = {
        ok: 'ok',
        authError: 'auth_error',
        networkError: 'network_error',
        unknown: 'unknown',
        checking: 'checking'
    };
    
    var cache = {
        data: {},
        TTL: 10 * 60 * 1000,
        get: function(key) {
            var cached = this.data[key];
            if (cached && Date.now() < cached.expiresAt) return cached;
            return null;
        },
        set: function(key, value) {
            this.data[key] = _objectSpread2(_objectSpread2({}, value), {}, {
                expiresAt: Date.now() + this.TTL
            });
        }
    };

    function getProtocol() {
        if (Lampa.Utils && typeof Lampa.Utils.protocol === 'function') {
            return Lampa.Utils.protocol();
        }
        return location.protocol === 'https:' ? 'https://' : 'http://';
    }

    function createHealthCheckUrl(parser) {
        if (!parser || !parser.settings || !parser.settings.url) return null;
        var settings = parser.settings;
        var parserType = settings.parser_torrent_type || 'jackett';
        var hasProtocol = /^https?:\/\//.test(settings.url);
        var protocol = hasProtocol ? '' : getProtocol();
        var apiKey = settings.key || '';
        var basePath = parserType === 'prowlarr' ? '/api/v1/health' : '/api/v2.0/indexers/status:healthy/results';
        return protocol + settings.url + basePath + '?apikey=' + apiKey;
    }

    function cacheKey(parserId, url) {
        return parserId + '::' + url;
    }

    function statusFromXhr(xhr) {
        if (!xhr) return STATUS.networkError;
        if (xhr.status === 200) return STATUS.ok;
        if (xhr.status === 401) return STATUS.authError;
        return STATUS.networkError;
    }

    function checkAlive(parsers) {
        if (!Array.isArray(parsers) || !parsers.length) return Promise.resolve({});
        var results = {};
        var requests = parsers.map(function(parser) {
            return new Promise(function(resolve) {
                var url = createHealthCheckUrl(parser);
                var parserId = parser.id || parser.name || 'unknown';
                if (!url) {
                    results[parserId] = STATUS.unknown;
                    resolve();
                    return;
                }
                var key = cacheKey(parserId, url);
                var cached = cache.get(key);
                if (cached) {
                    results[parserId] = cached.status;
                    resolve();
                    return;
                }
                $.ajax({
                    url: url,
                    method: 'GET',
                    timeout: 5000,
                    success: function(response, textStatus, xhr) {
                        var status = statusFromXhr(xhr);
                        if (xhr.status === 200 || xhr.status === 401) {
                            cache.set(key, { status: status });
                        }
                        results[parserId] = status;
                        resolve();
                    },
                    error: function(xhr) {
                        results[parserId] = statusFromXhr(xhr);
                        resolve();
                    }
                });
            });
        });
        return Promise.allSettled(requests).then(function() {
            return results;
        });
    }

    var STORAGE_KEY_MAIN = 'lme_main_parser';
    var STORAGE_KEY_EXTRA = 'lme_extra_parser';
    var NO_PARSER_ID = 'no_parser';

    function getSelectedParserId(type) {
        var key = type === 'extra' ? STORAGE_KEY_EXTRA : STORAGE_KEY_MAIN;
        return Lampa.Storage.get(key, NO_PARSER_ID);
    }

    function getParserById(parserId) {
        return parsersInfo.find(function(parser) {
            return parser.id === parserId;
        });
    }

    function applySelectedParser(parserId, type) {
        parserId = parserId || getSelectedParserId(type);
        var selectedParser = getParserById(parserId);
        if (!selectedParser || !selectedParser.settings) {
            if (parserId !== NO_PARSER_ID) {
                console.warn('PubTorr', 'parser not found', parserId);
            }
            return false;
        }
        var settings = selectedParser.settings;
        var parserType = settings.parser_torrent_type || 'jackett';
        
        if (type === 'extra') {
            Lampa.Storage.set('jackett_url_extra', settings.url);
            Lampa.Storage.set('jackett_key_extra', settings.key || '');
            Lampa.Storage.set('parser_torrent_type_extra', parserType);
        } else {
            Lampa.Storage.set(parserType === 'prowlarr' ? 'prowlarr_url' : 'jackett_url', settings.url);
            Lampa.Storage.set(parserType === 'prowlarr' ? 'prowlarr_key' : 'jackett_key', settings.key || '');
            Lampa.Storage.set('parser_torrent_type', parserType);
        }
        return true;
    }

    function applyStoredParserOnStart() {
        var mainId = getSelectedParserId('main');
        var extraId = getSelectedParserId('extra');
        
        if (mainId !== NO_PARSER_ID) {
            applySelectedParser(mainId, 'main');
        }
        if (extraId !== NO_PARSER_ID) {
            applySelectedParser(extraId, 'extra');
        }
    }

    function updateSelectedLabel() {
        var mainId = getSelectedParserId('main');
        var extraId = getSelectedParserId('extra');
        
        var mainCurrent = parsersInfo.find(function(parser) {
            return parser.id === mainId;
        });
        var extraCurrent = parsersInfo.find(function(parser) {
            return parser.id === extraId;
        });
        
        var mainLabel = mainCurrent ? mainCurrent.name : Lampa.Lang.translate('lme_parser_none');
        var extraLabel = extraCurrent ? extraCurrent.name : Lampa.Lang.translate('lme_parser_none');
        
        var text = Lampa.Lang.translate('lme_parser_selected') + ': Основной - ' + mainLabel + ', Доп - ' + extraLabel;
        $('.pubtorr-parser-selected').text(text);
    }

    var HEALTH_KEY = 'lme_parser_health';
    var STATUS_CLASS = _defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty({}, STATUS.ok, 'status-ok'), STATUS.authError, 'status-auth-error'), STATUS.networkError, 'status-network-error'), STATUS.unknown, 'status-unknown'), STATUS.checking, 'status-checking');

    function statusLabel(status) {
        switch (status) {
            case STATUS.ok:
                return Lampa.Lang.translate('lme_parser_status_ok');
            case STATUS.authError:
                return Lampa.Lang.translate('lme_parser_status_auth');
            case STATUS.networkError:
                return Lampa.Lang.translate('lme_parser_status_network');
            case STATUS.checking:
                return Lampa.Lang.translate('lme_parser_status_checking');
            default:
                return Lampa.Lang.translate('lme_parser_status_unknown');
        }
    }

    function applyStatus(item, status) {
        var classes = Object.values(STATUS_CLASS).join(' ');
        item.removeClass(classes);
        item.addClass(STATUS_CLASS[status] || STATUS_CLASS[STATUS.unknown]);
        item.find('.pubtorr-parser-modal__status').text(statusLabel(status));
    }

    function buildItem(parser) {
        var mainId = getSelectedParserId('main');
        var extraId = getSelectedParserId('extra');
        var isMain = parser.id === mainId;
        var isExtra = parser.id === extraId;
        
        var item = $('<div class="pubtorr-parser-modal__item selector status-unknown" data-parser-id="' + parser.id + '">' +
            '<div class="pubtorr-parser-modal__info">' +
                '<div class="pubtorr-parser-modal__name">' + parser.name + '</div>' +
                '<div class="pubtorr-parser-modal__actions">' +
                    '<div class="pubtorr-parser-modal__btn selector ' + (isMain ? 'active-main' : '') + '" data-type="main">Основной</div>' +
                    '<div class="pubtorr-parser-modal__btn selector ' + (isExtra ? 'active-extra' : '') + '" data-type="extra">Дополнительный</div>' +
                '</div>' +
            '</div>' +
            '<div class="pubtorr-parser-modal__status"></div>' +
        '</div>');
        applyStatus(item, STATUS.unknown);
        return item;
    }

    function updateCurrentLabel(wrapper, mainId, extraId, parsers) {
        var mainCurrent = parsers.find(function(parser) {
            return parser.id === mainId;
        });
        var extraCurrent = parsers.find(function(parser) {
            return parser.id === extraId;
        });
        
        var mainLabel = mainCurrent ? mainCurrent.name : Lampa.Lang.translate('lme_parser_none');
        var extraLabel = extraCurrent ? extraCurrent.name : Lampa.Lang.translate('lme_parser_none');
        
        wrapper.find('.pubtorr-parser-modal__current-value').text('Осн: ' + mainLabel + ' | Доп: ' + extraLabel);
    }

    function openParserModal() {
        var parsers = [{
            id: NO_PARSER_ID,
            name: Lampa.Lang.translate('lme_parser_none')
        }].concat(_toConsumableArray(parsersInfo));
        
        var mainId = getSelectedParserId('main');
        var extraId = getSelectedParserId('extra');
        
        var modal = $('<div class="pubtorr-parser-modal">' +
            '<div class="pubtorr-parser-modal__head">' +
                '<div class="pubtorr-parser-modal__current">' +
                    '<div class="pubtorr-parser-modal__current-label">' + Lampa.Lang.translate('lme_parser_current') + '</div>' +
                    '<div class="pubtorr-parser-modal__current-value"></div>' +
                '</div>' +
                '<div class="pubtorr-parser-modal__actions">' +
                    '<div class="pubtorr-parser-modal__action selector">' + Lampa.Lang.translate('lme_parser_refresh') + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pubtorr-parser-modal__list"></div>' +
            '<div class="pubtorr-parser-modal__legend">' +
                '<div class="pubtorr-parser-modal__legend-item status-ok">' + Lampa.Lang.translate('lme_parser_status_ok') + '</div>' +
                '<div class="pubtorr-parser-modal__legend-item status-auth-error">' + Lampa.Lang.translate('lme_parser_status_auth') + '</div>' +
                '<div class="pubtorr-parser-modal__legend-item status-network-error">' + Lampa.Lang.translate('lme_parser_status_network') + '</div>' +
                '<div class="pubtorr-parser-modal__legend-item status-unknown">' + Lampa.Lang.translate('lme_parser_status_unknown') + '</div>' +
            '</div>' +
        '</div>');
        
        var list = modal.find('.pubtorr-parser-modal__list');
        var refreshAction = modal.find('.pubtorr-parser-modal__action');
        var healthEnabled = Lampa.Storage.get(HEALTH_KEY, true);

        function renderList() {
            list.empty();
            
            parsers.forEach(function(parser) {
                var item = buildItem(parser);
                
                // Обработчик для кнопки "Основной"
                item.find('[data-type="main"]').on('hover:enter', function(e) {
                    e.stopPropagation();
                    Lampa.Storage.set(STORAGE_KEY_MAIN, parser.id);
                    applySelectedParser(parser.id, 'main');
                    mainId = parser.id;
                    renderList();
                    updateCurrentLabel(modal, mainId, extraId, parsers);
                    updateSelectedLabel();
                });
                
                // Обработчик для кнопки "Дополнительный"
                item.find('[data-type="extra"]').on('hover:enter', function(e) {
                    e.stopPropagation();
                    Lampa.Storage.set(STORAGE_KEY_EXTRA, parser.id);
                    applySelectedParser(parser.id, 'extra');
                    extraId = parser.id;
                    renderList();
                    updateCurrentLabel(modal, mainId, extraId, parsers);
                    updateSelectedLabel();
                });
                
                list.append(item);
            });
        }

        renderList();
        updateCurrentLabel(modal, mainId, extraId, parsers);

        var actionableItems = list.find('.pubtorr-parser-modal__item').first();
        
        Lampa.Modal.open({
            title: Lampa.Lang.translate('lme_parser'),
            html: modal,
            size: 'medium',
            scroll_to_center: true,
            select: actionableItems,
            onBack: function() {
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings_component');
                updateSelectedLabel();
            }
        });

        if (!healthEnabled) {
            refreshAction.addClass('hide');
            modal.find('.pubtorr-parser-modal__legend').addClass('hide');
            return;
        }

        var parserItems = list.find('.pubtorr-parser-modal__item').not('[data-parser-id="' + NO_PARSER_ID + '"]');
        
        parserItems.each(function() {
            applyStatus($(this), STATUS.checking);
        });

        var runChecks = function() {
            parserItems.each(function() {
                applyStatus($(this), STATUS.checking);
            });
            checkAlive(parsersInfo).then(function(statusMap) {
                parserItems.each(function() {
                    var item = $(this);
                    var parserId = item.data('parserId');
                    var status = statusMap[parserId] || STATUS.unknown;
                    applyStatus(item, status);
                });
            });
        };

        refreshAction.on('hover:enter', function() {
            runChecks();
        });

        runChecks();
    }

    function parserSetting() {
        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: {
                name: 'lme_parser_manage',
                type: 'button'
            },
            field: {
                name: Lampa.Lang.translate('lme_parser'),
                description: Lampa.Lang.translate('lme_parser_description') + ' ' + parsersInfo.length + '<div class="pubtorr-parser-selected"></div>'
            },
            onChange: function() {
                openParserModal();
            },
            onRender: function(item) {
                updateSelectedLabel();
                setTimeout(function() {
                    var parserUse = $('div[data-name="parser_use"]').first();
                    if (parserUse.length) item.insertAfter(parserUse);
                    if (Lampa.Storage.field('parser_use')) item.show();
                    else item.hide();
                });
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: {
                name: HEALTH_KEY,
                type: 'trigger',
                "default": true
            },
            field: {
                name: Lampa.Lang.translate('lme_parser_health')
            },
            onRender: function(item) {
                setTimeout(function() {
                    var manage = $('div[data-name="lme_parser_manage"]').first();
                    if (manage.length) item.insertAfter(manage);
                    if (Lampa.Storage.field('parser_use')) item.show();
                    else item.hide();
                });
            }
        });
    }

    Lampa.Platform.tv();

    function addStyles() {
        var customStyles = '' +
            '.pubtorr-parser-modal__actions {' +
                'display: flex;' +
                'gap: 0.5em;' +
            '}' +
            '.pubtorr-parser-modal__btn {' +
                'padding: 0.2em 0.6em;' +
                'border-radius: 0.3em;' +
                'background: rgba(255,255,255,0.05);' +
                'border: 1px solid rgba(255,255,255,0.1);' +
                'cursor: pointer;' +
                'font-size: 0.8em;' +
                'display: inline-block;' +
            '}' +
            '.pubtorr-parser-modal__btn.active-main {' +
                'background: rgba(25, 195, 125, 0.3);' +
                'border-color: #19c37d;' +
            '}' +
            '.pubtorr-parser-modal__btn.active-extra {' +
                'background: rgba(245, 166, 35, 0.3);' +
                'border-color: #f5a623;' +
            '}' +
            '.pubtorr-parser-modal__btn.focus {' +
                'border-color: var(--pubtorr-selected-border);' +
            '}' +
            '.pubtorr-parser-modal__info {' +
                'display: flex;' +
                'flex-direction: column;' +
                'gap: 0.3em;' +
                'flex: 1;' +
            '}';
        
        var existingStyle = Lampa.Template.get('pubtorr_style', {}, true);
        Lampa.Template.add('pubtorr_style', existingStyle + customStyles);
    }

    function add() {
        translate();
        
        Lampa.Template.add('pubtorr_style', '' +
            '<style>' +
                '.pubtorr-parser-modal{--pubtorr-status-ok:#19c37d;--pubtorr-status-auth:#ff4d4f;--pubtorr-status-network:#ff4d4f;--pubtorr-status-unknown:#8c8c8c;--pubtorr-status-checking:#f5a623;--pubtorr-selected-border:#fff;display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;gap:1em}.pubtorr-parser-modal__head{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:justify;-webkit-justify-content:space-between;-ms-flex-pack:justify;justify-content:space-between;gap:1em}.pubtorr-parser-modal__current-label{font-size:.9em;opacity:.7}.pubtorr-parser-modal__current-value{font-size:1.1em}.pubtorr-parser-modal__action{padding:.5em .9em;-webkit-border-radius:.6em;border-radius:.6em;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2)}.pubtorr-parser-modal__action.focus{border-color:var(--pubtorr-selected-border)}.pubtorr-parser-modal__list{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;gap:.6em}.pubtorr-parser-modal__item{position:relative;display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:justify;-webkit-justify-content:space-between;-ms-flex-pack:justify;justify-content:space-between;gap:1em;padding:.8em 1em .8em 1.8em;-webkit-border-radius:.7em;border-radius:.7em;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08)}.pubtorr-parser-modal__item::before{content:\'\';position:absolute;left:.8em;top:50%;width:.55em;height:.55em;-webkit-border-radius:50%;border-radius:50%;background:var(--pubtorr-status-color,var(--pubtorr-status-unknown));-webkit-transform:translateY(-50%);-ms-transform:translateY(-50%);transform:translateY(-50%);-webkit-box-shadow:0 0 .6em rgba(0,0,0,0.3);box-shadow:0 0 .6em rgba(0,0,0,0.3)}.pubtorr-parser-modal__item.is-selected,.pubtorr-parser-modal__item.focus{border-color:var(--pubtorr-selected-border)}.pubtorr-parser-modal__info{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;gap:.25em;min-width:0}.pubtorr-parser-modal__name{font-size:1em}.pubtorr-parser-modal__status{font-size:.8em;opacity:.7;text-align:right;-webkit-align-self:center;-ms-flex-item-align:center;align-self:center}.pubtorr-parser-modal__legend{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap;gap:.8em 1.2em;font-size:.85em;opacity:.7}.pubtorr-parser-modal__legend-item{position:relative;padding-left:1.2em}.pubtorr-parser-modal__legend-item::before{content:\'\';position:absolute;left:0;top:.55em;width:.5em;height:.5em;-webkit-border-radius:50%;border-radius:50%;background:var(--pubtorr-status-color,var(--pubtorr-status-unknown))}.pubtorr-parser-modal__item.status-ok,.pubtorr-parser-modal__legend-item.status-ok{--pubtorr-status-color:var(--pubtorr-status-ok)}.pubtorr-parser-modal__item.status-auth-error,.pubtorr-parser-modal__legend-item.status-auth-error{--pubtorr-status-color:var(--pubtorr-status-auth)}.pubtorr-parser-modal__item.status-network-error,.pubtorr-parser-modal__legend-item.status-network-error{--pubtorr-status-color:var(--pubtorr-status-network)}.pubtorr-parser-modal__item.status-unknown,.pubtorr-parser-modal__legend-item.status-unknown{--pubtorr-status-color:var(--pubtorr-status-unknown)}.pubtorr-parser-modal__item.status-checking{--pubtorr-status-color:var(--pubtorr-status-checking)}@media(max-width:600px){.pubtorr-parser-modal__head{-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;-webkit-box-align:start;-webkit-align-items:flex-start;-ms-flex-align:start;align-items:flex-start}.pubtorr-parser-modal__item{-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column;-webkit-box-align:start;-webkit-align-items:flex-start;-ms-flex-align:start;align-items:flex-start}.pubtorr-parser-modal__status{text-align:left}}' +
            '</style>'
        );
        
        addStyles();
        $('body').append(Lampa.Template.get('pubtorr_style', {}, true));
        
        parserSetting();
    }

    function startPlugin() {
        window.plugin_lmepublictorr_ready = true;
        if (window.appready) {
            applyStoredParserOnStart();
            add();
        } else {
            Lampa.Listener.follow('app', function(e) {
                if (e.type === 'ready') {
                    applyStoredParserOnStart();
                    add();
                }
            });
        }
    }

    if (!window.plugin_lmepublictorr_ready) {
        startPlugin();
    }

})();
