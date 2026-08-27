/* Lampa.plugin — Жанрові рядки (UA) + серіали + пагінація «завантажити ще» */
(function () {
    'use strict';

    if (window.__genres_ua_plugin) return;
    window.__genres_ua_plugin = true;

    function waitForLampa(callback) {
        if (window.Lampa && Lampa.ContentRows && Lampa.Api) {
            callback();
        } else {
            setTimeout(function () {
                waitForLampa(callback);
            }, 100);
        }
    }

    waitForLampa(function () {
        var PLUGIN = 'genres_ua';

        function setting(name, def) {
            return Lampa.Storage.get(name, def);
        }

        // ========== ФІЛЬМИ (жанри TMDB) ==========
        var MOVIE_GENRES = {
            comedy:      { id: 35,    title: 'Комедії' },
            action:      { id: 28,    title: 'Бойовики' },
            thriller:    { id: 53,    title: 'Трилери' },
            drama:       { id: 18,    title: 'Драми' },
            family:      { id: 10751, title: 'Сімейні' },
            horror:      { id: 27,    title: 'Жахи' },
            scifi:       { id: 878,   title: 'Фантастика' },
            fantasy:     { id: 14,    title: 'Фентезі' },
            adventure:   { id: 12,    title: 'Пригоди' },
            crime:       { id: 80,    title: 'Кримінал' },
            animation:   { id: 16,    title: 'Мультфільми' },
            romance:     { id: 10749, title: 'Мелодрами' },
            mystery:     { id: 9648,  title: 'Детективи' },
            war:         { id: 10752, title: 'Військові' },
            history:     { id: 36,    title: 'Історичні' },
            documentary: { id: 99,    title: 'Документальні' },
            music:       { id: 10402, title: 'Музичні' },
            western:     { id: 37,    title: 'Вестерни' }
        };

        var GAIDAI_ID = 1190421;

        // ========== СЕРІАЛИ ==========
        var SERIES_ROWS = {
            ua: {
                title: 'Українські серіали',
                base: 'discover/tv?with_origin_country=UA&sort_by=popularity.desc&include_adult=false&vote_count.gte=5'
            },
            ru: {
                title: 'Російські серіали',
                base: 'discover/tv?with_origin_country=RU&with_original_language=ru&sort_by=popularity.desc&include_adult=false&vote_count.gte=20'
            },
            other: {
                title: 'Серіали інших студій',
                base: 'discover/tv?without_origin_country=UA|RU&sort_by=popularity.desc&include_adult=false&vote_count.gte=100'
            }
        };

        function registerSettings() {
            if (!Lampa.SettingsApi) return;

            Lampa.SettingsApi.addComponent({
                component: PLUGIN,
                name: 'Жанрові рядки',
                icon: '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>'
            });

            Object.keys(MOVIE_GENRES).forEach(function (key) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN,
                    param: {
                        name: PLUGIN + '_m_' + key,
                        type: 'trigger',
                        default: true
                    },
                    field: {
                        name: 'Фільми · ' + MOVIE_GENRES[key].title
                    }
                });
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: PLUGIN + '_gaidai',
                    type: 'trigger',
                    default: true
                },
                field: {
                    name: 'Фільми · Комедії Гайдая'
                }
            });

            Object.keys(SERIES_ROWS).forEach(function (key) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN,
                    param: {
                        name: PLUGIN + '_s_' + key,
                        type: 'trigger',
                        default: true
                    },
                    field: {
                        name: 'Серіали · ' + SERIES_ROWS[key].title
                    }
                });
            });

            Lampa.SettingsApi.addParam({
                component: PLUGIN,
                param: {
                    name: PLUGIN + '_limit',
                    type: 'select',
                    values: {
                        20: '20',
                        30: '30',
                        40: '40',
                        60: '60'
                    },
                    default: 30
                },
                field: {
                    name: 'Карток у рядку на головній'
                }
            });
        }

        function normalizeResults(results) {
            var exists = {};
            results = (results || []).filter(function (card) {
                if (!card.poster_path) return false;
                var title = (card.title || card.name || '').toLowerCase();
                var year = (card.release_date || card.first_air_date || '').slice(0, 4);
                var key = title + '|' + year;
                if (exists[key]) return false;
                exists[key] = true;
                card.promo = card.overview;
                card.promo_title = card.title || card.name;
                if (!card.source) card.source = 'tmdb';
                return true;
            });
            return results;
        }

        /**
         * Завантаження з пагінацією.
         * На головній — більше карток одразу (кілька сторінок TMDB).
         * У повному списку — page=N і total_pages для кнопки «ще».
         */
        function fetchPaged(title, baseUrl, params, ready) {
            params = params || {};
            var page = Math.max(1, parseInt(params.page, 10) || 1);
            var isMainLine = !params.page;

            var lineLimit = Number(setting(PLUGIN + '_limit', 30));
            var pagesNeeded = isMainLine ? Math.ceil(lineLimit / 20) : 1;
            var startPage = isMainLine ? 1 : page;

            var collected = [];
            var totalPages = 1;
            var totalResults = 0;
            var done = 0;
            var failed = false;

            function finish() {
                if (failed && collected.length === 0) {
                    ready({
                        title: title,
                        name: title,
                        results: [],
                        page: page,
                        total_pages: 1,
                        total_results: 0
                    });
                    return;
                }

                var results = normalizeResults(collected);
                if (isMainLine) {
                    results = results.slice(0, lineLimit);
                }

                ready({
                    title: title,
                    name: title,
                    results: results,
                    page: page,
                    total_pages: totalPages || 1,
                    total_results: totalResults || results.length,
                    source: 'tmdb',
                    url: baseUrl
                });
            }

            for (var i = 0; i < pagesNeeded; i++) {
                (function (p) {
                    var url = baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'page=' + p;

                    Lampa.Api.list(
                        {
                            source: 'tmdb',
                            url: url,
                            page: p
                        },
                        function (json) {
                            json = json || {};
                            var list = json.results || [];
                            for (var j = 0; j < list.length; j++) {
                                collected.push(list[j]);
                            }
                            if (json.total_pages) totalPages = json.total_pages;
                            if (json.total_results) totalResults = json.total_results;
                            done++;
                            if (done >= pagesNeeded) finish();
                        },
                        function () {
                            failed = true;
                            done++;
                            if (done >= pagesNeeded) finish();
                        }
                    );
                })(startPage + i);
            }
        }

        function makeCall(title, baseUrl) {
            return function (params, screen) {
                return function (ready) {
                    fetchPaged(title, baseUrl, params || {}, ready);
                };
            };
        }

        function movieGenreBase(genreId) {
            return (
                'discover/movie' +
                '?with_genres=' + genreId +
                '&sort_by=popularity.desc' +
                '&include_adult=false' +
                '&vote_count.gte=50'
            );
        }

        function gaidaiBase() {
            return (
                'discover/movie' +
                '?with_people=' + GAIDAI_ID +
                '&sort_by=primary_release_date.desc' +
                '&include_adult=false'
            );
        }

        registerSettings();

        var index = 4;

        Object.keys(MOVIE_GENRES).forEach(function (key) {
            var g = MOVIE_GENRES[key];
            var base = movieGenreBase(g.id);

            Lampa.ContentRows.add({
                name: PLUGIN + '_m_' + key,
                title: g.title,
                screen: ['main'],
                index: index++,
                call: function (params, screen) {
                    if (!setting(PLUGIN + '_m_' + key, true)) return [];
                    return makeCall(g.title, base)(params, screen);
                }
            });
        });

        Lampa.ContentRows.add({
            name: PLUGIN + '_gaidai',
            title: 'Комедії Гайдая',
            screen: ['main'],
            index: index++,
            call: function (params, screen) {
                if (!setting(PLUGIN + '_gaidai', true)) return [];
                return makeCall('Комедії Гайдая', gaidaiBase())(params, screen);
            }
        });

        Object.keys(SERIES_ROWS).forEach(function (key) {
            var s = SERIES_ROWS[key];

            Lampa.ContentRows.add({
                name: PLUGIN + '_s_' + key,
                title: s.title,
                screen: ['main'],
                index: index++,
                call: function (params, screen) {
                    if (!setting(PLUGIN + '_s_' + key, true)) return [];
                    return makeCall(s.title, s.base)(params, screen);
                }
            });
        });

        console.log('[Genres UA] loaded — пагінація + більше карток');
    });
})();
