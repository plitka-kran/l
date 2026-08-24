(function () {
    'use strict';

    function translate() {
        Lampa.Lang.add({
            lme_parser_main: {
                ru: 'Каталог парсеров (Основная)',
                en: 'Parsers catalog (Main)',
                uk: 'Каталог парсерів (Основна)',
                zh: '解析器目录（主）'
            },
            lme_parser_secondary: {
                ru: 'Каталог парсеров (Доп.)',
                en: 'Parsers catalog (Secondary)',
                uk: 'Каталог парсерів (Додаткова)',
                zh: '解析器目录（副）'
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
            }
        });
    }

    var Lang = { translate: translate };

    var parsersInfo = [{
        id: 'lampa_app',
        name: 'Lampa.app',
        settings: { url: 'lampa.app', key: '', parser_torrent_type: 'jackett' }
    }, {
        id: 'jac_black',
        name: 'jac.black',
        settings: { url: 'jac.black', key: '', parser_torrent_type: 'jackett' }
    }, {
        id: 'jacred',
        name: 'Jac.red',
        settings: { url: 'jac.red', key: '', parser_torrent_type: 'jackett' }
    }, {
        id: 'JaCred_xyz',
        name: 'Jacred.xyz',
        settings: { url: 'jacred.xyz', key: '', parser_torrent_type: 'jackett' }
    }, {
        id: 'JaCred_su',
        name: 'JacRed.su',
        settings: { url: 'jacred.su', key: '', parser_torrent_type: 'jackett' }
    }, {
        id: 'jac_red_ru',
        name: 'jac-red.ru',
        settings: { url: 'jac-red.ru', key: '', parser_torrent_type: 'jackett' }
    }];

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
        get: function (key) {
            var cached = this.data[key];
            if (cached && Date.now() < cached.expiresAt) return cached;
            return null;
        },
        set: function (key, value) {
            this.data[key] = Object.assign({}, value, { expiresAt: Date.now() + this.TTL });
        }
    };

    function getProtocol() {
        if (Lampa.Utils && typeof Lampa.Utils.protocol === 'function') return Lampa.Utils.protocol();
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
        return protocol + settings.url + basePath + "?apikey=" + apiKey;
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
        var requests = parsers.map(function (parser) {
            return new Promise(function (resolve) {
                var url = createHealthCheckUrl(parser);
                var parserId = parser.id || parser.name || 'unknown';
                if (!url) {
                    results[parserId] = STATUS.unknown;
                    resolve();
                    return;
                }
                var key = parserId + "::" + url;
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
                    success: function (response, textStatus, xhr) {
                        var status = statusFromXhr(xhr);
                        if (xhr.status === 200 || xhr.status === 401) {
                            cache.set(key, { status: status });
                        }
                        results[parserId] = status;
                        resolve();
                    },
                    error: function (xhr) {
                        results[parserId] = statusFromXhr(xhr);
                        resolve();
                    }
                });
            });
        });
        return Promise.allSettled(requests).then(function () { return results; });
    }

    var STORAGE_KEY_MAIN = 'lme_url_main';
    var STORAGE_KEY_SECONDARY = 'lme_url_secondary';
    var NO_PARSER_ID = 'no_parser';

    function getSelectedParserId(target) {
        var key = target === 'secondary' ? STORAGE_KEY_SECONDARY : STORAGE_KEY_MAIN;
        return Lampa.Storage.get(key, NO_PARSER_ID);
    }

    function getParserById(parserId) {
        return parsersInfo.find(function (p) { return p.id === parserId; });
    }

    function applySelectedParser(target, parserId) {
        target = target || 'main';
        parserId = parserId || getSelectedParserId(target);
        var selectedParser = getParserById(parserId);
        
        if (!selectedParser || !selectedParser.settings) return false;

        var settings = selectedParser.settings;
        var parserType = settings.parser_torrent_type || 'jackett';

        if (target === 'secondary') {
            Lampa.Storage.set(parserType === 'prowlarr' ? 'prowlarr_url_two' : 'jackett_url_two', settings.url);
            Lampa.Storage.set(parserType === 'prowlarr' ? 'prowlarr_key_two' : 'jackett_key_two', settings.key || '');
        } else {
            Lampa.Storage.set(parserType === 'prowlarr' ? 'prowlarr_url' : 'jackett_url', settings.url);
            Lampa.Storage.set(parserType === 'prowlarr' ? 'prowlarr_key' : 'jackett_key', settings.key || '');
            Lampa.Storage.set('parser_torrent_type', parserType);
        }
        return true;
    }

    function applyStoredParserOnStart() {
        applySelectedParser('main');
        applySelectedParser('secondary');
    }

    var STATUS_CLASS = {};
    STATUS_CLASS[STATUS.ok] = 'status-ok';
    STATUS_CLASS[STATUS.authError] = 'status-auth-error';
    STATUS_CLASS[STATUS.networkError] = 'status-network-error';
    STATUS_CLASS[STATUS.unknown] = 'status-unknown';
    STATUS_CLASS[STATUS.checking] = 'status-checking';

    function statusLabel(status) {
        switch (status) {
            case STATUS.ok: return Lampa.Lang.translate('lme_parser_status_ok');
            case STATUS.authError: return Lampa.Lang.translate('lme_parser_status_auth');
            case STATUS.networkError: return Lampa.Lang.translate('lme_parser_status_network');
            case STATUS.checking: return Lampa.Lang.translate('lme_parser_status_checking');
            default: return Lampa.Lang.translate('lme_parser_status_unknown');
        }
    }

    function applyStatus(item, status) {
        var classes = Object.values(STATUS_CLASS).join(' ');
        item.removeClass(classes);
        item.addClass(STATUS_CLASS[status] || STATUS_CLASS[STATUS.unknown]);
        item.find('.pubtorr-parser-modal__status').text(statusLabel(status));
    }

    function openParserModal(target) {
        target = target || 'main';
        var storageKey = target === 'secondary' ? STORAGE_KEY_SECONDARY : STORAGE_KEY_MAIN;
        var modalTitle = Lampa.Lang.translate(target === 'secondary' ? 'lme_parser_secondary' : 'lme_parser_main');

        var parsers = [{ id: NO_PARSER_ID, name: Lampa.Lang.translate('lme_parser_none') }].concat(parsersInfo);
        var selectedId = getSelectedParserId(target);

        var modal = $("<div class=\"pubtorr-parser-modal\">\n<div class=\"pubtorr-parser-modal__head\">\n<div class=\"pubtorr-parser-modal__current\">\n<div class=\"pubtorr-parser-modal__current-label\">" + Lampa.Lang.translate('lme_parser_current') + "</div>\n<div class=\"pubtorr-parser-modal__current-value\"></div>\n</div>\n<div class=\"pubtorr-parser-modal__actions\">\n<div class=\"pubtorr-parser-modal__action selector\">" + Lampa.Lang.translate('lme_parser_refresh') + "</div>\n</div>\n</div>\n<div class=\"pubtorr-parser-modal__list\"></div>\n<div class=\"pubtorr-parser-modal__legend\">\n<div class=\"pubtorr-parser-modal__legend-item status-ok\">" + Lampa.Lang.translate('lme_parser_status_ok') + "</div>\n<div class=\"pubtorr-parser-modal__legend-item status-auth-error\">" + Lampa.Lang.translate('lme_parser_status_auth') + "</div>\n<div class=\"pubtorr-parser-modal__legend-item status-network-error\">" + Lampa.Lang.translate('lme_parser_status_network') + "</div>\n<div class=\"pubtorr-parser-modal__legend-item status-unknown\">" + Lampa.Lang.translate('lme_parser_status_unknown') + "</div>\n</div>\n</div>");

        var list = modal.find('.pubtorr-parser-modal__list');
        var refreshAction = modal.find('.pubtorr-parser-modal__action');

        parsers.forEach(function (parser) {
            var item = $("<div class=\"pubtorr-parser-modal__item selector status-unknown\" data-parser-id=\"" + parser.id + "\">\n<div class=\"pubtorr-parser-modal__info\">\n<div class=\"pubtorr-parser-modal__name\">" + parser.name + "</div>\n</div>\n<div class=\"pubtorr-parser-modal__status\"></div>\n</div>");
            applyStatus(item, STATUS.unknown);

            item.on('hover:enter', function () {
                Lampa.Storage.set(storageKey, parser.id);
                list.find('.pubtorr-parser-modal__item').removeClass('is-selected');
                item.addClass('is-selected');
                
                var current = parsers.find(function (p) { return p.id === parser.id; });
                var label = current ? current.name : Lampa.Lang.translate('lme_parser_none');
                modal.find('.pubtorr-parser-modal__current-value').text(label);

                var paramName = target === 'secondary' ? 'lme_parser_manage_secondary' : 'lme_parser_manage_main';
                $('div[data-name="' + paramName + '"]').find('.pubtorr-parser-selected').text(Lampa.Lang.translate('lme_parser_selected') + ": " + label);

                applySelectedParser(target, parser.id);
            });
            list.append(item);
        });

        list.find("[data-parser-id=\"" + selectedId + "\"]").addClass('is-selected');
        var currentParser = parsers.find(function (p) { return p.id === selectedId; });
        modal.find('.pubtorr-parser-modal__current-value').text(currentParser ? currentParser.name : Lampa.Lang.translate('lme_parser_none'));

        Lampa.Modal.open({
            title: modalTitle,
            html: modal,
            size: 'medium',
            scroll_to_center: true,
            select: list.find('.pubtorr-parser-modal__item').first(),
            onBack: function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings_component');
            }
        });

        if (!Lampa.Storage.get('lme_parser_health', true)) {
            refreshAction.addClass('hide');
            modal.find('.pubtorr-parser-modal__legend').addClass('hide');
            return;
        }

        var parserItems = list.find('.pubtorr-parser-modal__item').not("[data-parser-id=\"" + NO_PARSER_ID + "\"]");
        var runChecks = function () {
            parserItems.each(function () { applyStatus($(this), STATUS.checking); });
            checkAlive(parsersInfo).then(function (statusMap) {
                parserItems.each(function () {
                    var item = $(this);
                    var pid = item.data('parserId');
                    applyStatus(item, statusMap[pid] || STATUS.unknown);
                });
            });
        };

        refreshAction.on('hover:enter', runChecks);
        runChecks();
    }

    function parserSetting() {
        // Основная ссылка
        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: { name: 'lme_parser_manage_main', type: 'button' },
            field: {
                name: Lampa.Lang.translate('lme_parser_main'),
                description: Lampa.Lang.translate('lme_parser_description') + parsersInfo.length + "<div class=\"pubtorr-parser-selected\"></div>"
            },
            onChange: function () { openParserModal('main'); },
            onRender: function (item) {
                var selectedId = getSelectedParserId('main');
                var current = parsersInfo.find(function (p) { return p.id === selectedId; });
                var label = current ? current.name : Lampa.Lang.translate('lme_parser_none');
                item.find('.pubtorr-parser-selected').text(Lampa.Lang.translate('lme_parser_selected') + ": " + label);
                item.show();
            }
        });

        // Дополнительная ссылка
        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: { name: 'lme_parser_manage_secondary', type: 'button' },
            field: {
                name: Lampa.Lang.translate('lme_parser_secondary'),
                description: Lampa.Lang.translate('lme_parser_description') + parsersInfo.length + "<div class=\"pubtorr-parser-selected\"></div>"
            },
            onChange: function () { openParserModal('secondary'); },
            onRender: function (item) {
                var selectedId = getSelectedParserId('secondary');
                var current = parsersInfo.find(function (p) { return p.id === selectedId; });
                var label = current ? current.name : Lampa.Lang.translate('lme_parser_none');
                item.find('.pubtorr-parser-selected').text(Lampa.Lang.translate('lme_parser_selected') + ": " + label);
                item.show();
            }
        });

        // Переключатель индикации
        Lampa.SettingsApi.addParam({
            component: 'parser',
            param: { name: 'lme_parser_health', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('lme_parser_health') },
            onRender: function (item) {
                item.show();
            }
        });
    }

    Lampa.Platform.tv();

    function add() {
        Lang.translate();
        Lampa.Template.add('pubtorr_style', "\n<style>\n.pubtorr-parser-modal{--pubtorr-status-ok:#19c37d;--pubtorr-status-auth:#ff4d4f;--pubtorr-status-network:#ff4d4f;--pubtorr-status-unknown:#8c8c8c;--pubtorr-status-checking:#f5a623;--pubtorr-selected-border:#fff;display:flex;flex-direction:column;gap:1em}.pubtorr-parser-modal__head{display:flex;align-items:center;justify-content:space-between;gap:1em}.pubtorr-parser-modal__current-label{font-size:.9em;opacity:.7}.pubtorr-parser-modal__current-value{font-size:1.1em}.pubtorr-parser-modal__action{padding:.5em .9em;border-radius:.6em;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2)}.pubtorr-parser-modal__action.focus{border-color:var(--pubtorr-selected-border)}.pubtorr-parser-modal__list{display:flex;flex-direction:column;gap:.6em}.pubtorr-parser-modal__item{position:relative;display:flex;align-items:center;justify-content:space-between;gap:1em;padding:.8em 1em .8em 1.8em;border-radius:.7em;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08)}.pubtorr-parser-modal__item::before{content:'';position:absolute;left:.8em;top:50%;width:.55em;height:.55em;border-radius:50%;background:var(--pubtorr-status-color,var(--pubtorr-status-unknown));transform:translateY(-50%);box-shadow:0 0 .6em rgba(0,0,0,0.3)}.pubtorr-parser-modal__item.is-selected,.pubtorr-parser-modal__item.focus{border-color:var(--pubtorr-selected-border)}.pubtorr-parser-modal__info{display:flex;flex-direction:column;gap:.25em;min-width:0}.pubtorr-parser-modal__name{font-size:1em}.pubtorr-parser-modal__status{font-size:.8em;opacity:.7;text-align:right;align-self:center}.pubtorr-parser-modal__legend{display:flex;flex-wrap:wrap;gap:.8em 1.2em;font-size:.85em;opacity:.7}.pubtorr-parser-modal__legend-item{position:relative;padding-left:1.2em}.pubtorr-parser-modal__legend-item::before{content:'';position:absolute;left:0;top:.55em;width:.5em;height:.5em;border-radius:50%;background:var(--pubtorr-status-color,var(--pubtorr-status-unknown))}.pubtorr-parser-modal__item.status-ok,.pubtorr-parser-modal__legend-item.status-ok{--pubtorr-status-color:var(--pubtorr-status-ok)}.pubtorr-parser-modal__item.status-auth-error,.pubtorr-parser-modal__legend-item.status-auth-error{--pubtorr-status-color:var(--pubtorr-status-auth)}.pubtorr-parser-modal__item.status-network-error,.pubtorr-parser-modal__legend-item.status-network-error{--pubtorr-status-color:var(--pubtorr-status-network)}.pubtorr-parser-modal__item.status-unknown,.pubtorr-parser-modal__legend-item.status-unknown{--pubtorr-status-color:var(--pubtorr-status-unknown)}.pubtorr-parser-modal__item.status-checking{--pubtorr-status-color:var(--pubtorr-status-checking)}@media(max-width:600px){.pubtorr-parser-modal__head{flex-direction:column;align-items:flex-start}.pubtorr-parser-modal__item{flex-direction:column;align-items:flex-start}.pubtorr-parser-modal__status{text-align:left}}\n</style>\n");
        $('body').append(Lampa.Template.get('pubtorr_style', {}, true));
        parserSetting();
    }

    function startPlugin() {
        window.plugin_lmepublictorr_ready = true;
        if (window.appready) {
            applyStoredParserOnStart();
            add();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') {
                    applyStoredParserOnStart();
                    add();
                }
            });
        }
    }

    if (!window.plugin_lmepublictorr_ready) startPlugin();

})();
