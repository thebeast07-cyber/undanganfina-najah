import { util } from '../../common/util.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { cache } from '../../connection/cache.js';
import { request, defaultJSON, ERROR_ABORT, HTTP_GET } from '../../connection/request.js';

export const gif = (() => {

    const gifDefault = 'default';

    const breakPoint = {
        128: 2,
        256: 3,
        512: 4,
        768: 5,
    };

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null; // Cache instance

    /**
     * @type {Map<string, object>|null}
     */
    let objectPool = null; // Stores context for each GIF form instance

    /**
     * @type {Map<string, function>|null}
     */
    let eventListeners = null; // Stores onOpen callbacks

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let config = null; // Global config (stores tenor_key)

    // --- TENOR API CONFIGURATION ---
    const TENOR_API_BASE_URL = 'https://tenor.googleapis.com/v2';
    // TENOR_GIF_BASE_URL tidak lagi terlalu relevan jika kita selalu ambil URL langsung dari API response
    // const TENOR_GIF_BASE_URL = 'https://media.tenor.com/images/'; 

    // buildTenorImageUrl juga tidak perlu lagi jika API selalu memberikan URL lengkap
    // const buildTenorImageUrl = (gifId) => {
    //     return `${TENOR_GIF_BASE_URL}${gifId}/tenor.gif`;
    // };


    /**
     * @param {string} uuid
     * @param {object[]} lists
     * @param {object|null} load
     * @returns {object|null[]}
     */
    const show = (uuid, lists, load = null) => {
        const ctx = objectPool.get(uuid);

        return lists.map((data) => {
            // VERIFIKASI DARI RESPONS API TENOR:
            // Pastikan media_formats.tinygif.url ini adalah URL yang LENGKAP dan BENAR.
            // Gunakan format yang paling sesuai (tinygif, gif, mp4, etc.).
            const { id, media_formats, content_description: description } = data;

            // Pilih format GIF yang Anda inginkan. 'tinygif' adalah yang paling ringan.
            const selectedFormat = media_formats.tinygif || media_formats.gif || media_formats.mp4; // Fallback jika tinygif tidak ada

            if (!selectedFormat || !selectedFormat.url || (!selectedFormat.url.startsWith('http://') && !selectedFormat.url.startsWith('https://'))) {
                console.warn(`gif.js: GIF ID ${id} missing valid URL for selected formats.`);
                return null; // Lewati GIF ini jika URL tidak ada atau tidak valid
            }
            const finalGifUrl = selectedFormat.url; // <-- Ini harus URL LENGKAP dari Tenor API

            if (ctx.pointer === -1) {
                ctx.pointer = 0;
            } else if (ctx.pointer === (ctx.col - 1)) {
                ctx.pointer = 0;
            } else {
                ctx.pointer++;
            }

            const el = ctx.lists.childNodes[ctx.pointer] ?? null;
            if (!el) {
                return null; // Should not happen if columns are properly initialized
            }

            // Clear previous content of the element before adding new figure
            el.innerHTML = ''; 

            const res = (uri) => { // 'uri' di sini adalah hasil dari c.get(finalGifUrl)
                el.insertAdjacentHTML('beforeend', `
                <figure class="hover-wrapper m-0 position-relative">
                    <button onclick="undangan.comment.gif.click(this, '${ctx.uuid}', '${id}', '${util.base64Encode(uri)}')" class="btn hover-area position-absolute justify-content-center align-items-center top-0 end-0 bg-overlay-auto p-1 m-1 rounded-circle border shadow-sm z-1">
                        <i class="fa-solid fa-circle-check"></i>
                    </button>
                    <img src="${uri}" class="img-fluid" alt="${util.escapeHtml(description)}" style="width: 100%; height: auto; display: block;">
                </figure>`);

                load?.step();
            };

            return {
                url: finalGifUrl, // This URL will be passed to c.get()
                res: res,
            };
        }).filter(item => item !== null); // Filter out any null items if GIF data was invalid
    };

    /**
     * Prepares the cache.
     * @returns {Promise<void>}
     */
    const prepareCache = () => c.open();

    /**
     * Gets a GIF URL from cache, or fetches and caches it if not present.
     * @param {string} url - The complete URL of the GIF image (e.g., from Tenor's media_formats.tinygif.url).
     * @returns {Promise<string>} - The URL of the GIF.
     */
    const get = async (url) => {
        // Pada titik ini, `url` yang masuk ke fungsi `get` seharusnya SUDAH URL LENGKAP
        // dari respons API Tenor. Jadi, tidak perlu lagi ada logika `buildTenorImageUrl(url)` di sini.
        if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
            // Log ini akan muncul jika ada URL GIF yang disimpan di Firestore yang rusak/tidak valid
            console.error(`gif.js: Invalid URL format passed to get(): ${url}`);
            throw new Error(`Invalid GIF URL provided from data: ${url}`);
        }

        try {
            const cachedUrl = await c.get(url); // Cache URL yang lengkap dan benar
            return cachedUrl;
        } catch (error) {
            console.error(`gif.js: Error fetching or caching GIF for URL ${url}:`, error);
            throw new Error(`Failed to load GIF: ${error.message}`);
        }
    };


    /**
     * @param {string} uuid
     * @returns {object}
     */
    const loading = (uuid) => {
        const ctx = objectPool.get(uuid);

        const list = ctx.lists;
        const load = document.getElementById(`gif-loading-${ctx.uuid}`);
        const prog = document.getElementById(`progress-bar-${ctx.uuid}`);
        const info = document.getElementById(`progress-info-${ctx.uuid}`);

        let total = 0;
        let loaded = 0;

        list.setAttribute('data-continue', 'false');
        list.classList.replace('overflow-y-scroll', 'overflow-y-hidden');

        const timeoutMs = 150;
        let isReleased = false;

        const timeoutId = setTimeout(() => {
            if (isReleased) {
                return;
            }

            info.innerText = `${loaded}/${total}`;
            if (!list.classList.contains('d-none')) {
                load.classList.replace('d-none', 'd-flex');
            }
        }, timeoutMs);

        const release = () => {
            isReleased = true;
            clearTimeout(timeoutId);

            if (!list.classList.contains('d-none')) {
                load.classList.replace('d-flex', 'd-none');
            }

            prog.style.width = '0%';
            info.innerText = `${loaded}/${total}`;
            list.setAttribute('data-continue', 'true');
            list.classList.replace('overflow-y-hidden', 'overflow-y-scroll');
        };

        /**
         * @param {number} num 
         */
        const until = (num) => {
            total = num;
            info.innerText = `${loaded}/${total}`;
        };

        const step = () => {
            loaded += 1;
            info.innerText = `${loaded}/${total}`;
            prog.style.width = Math.min((loaded / total) * 100, 100).toString() + '%';
        };

        return {
            release,
            until,
            step,
        };
    };

    /**
     * @param {string} uuid
     * @param {string} path 
     * @param {object} params
     * @returns {void}
     */
    const render = (uuid, path, params) => {
        // Pastikan config sudah terinisialisasi dan tenor_key ada.
        // config mungkin belum terupdate saat gif.js pertama kali init jika comment.js belum selesai fetch dari Firestore.
        // Mendapatkan nilai terbaru setiap kali render dipanggil.
        const currentTenorKey = storage('config').get('tenor_key'); // <--- Baca nilai terbaru setiap kali render dipanggil

        if (!currentTenorKey || currentTenorKey === 'TENOR-API-KEY-OPTIONAL') {
            util.notify('Tenor API Key is missing or invalid. Please configure it in admin settings.').error();
            objectPool.get(uuid).lists.innerHTML = `<p class="text-center text-secondary">Tenor API Key not configured.</p>`;
            loading(uuid).release();
            return;
        }

        params = {
            media_filter: 'tinygif',
            client_key: 'undangan_app',
            key: currentTenorKey, // <--- Gunakan nilai terbaru
            country: lang.getCountry(),
            locale: lang.getLocale(),
            ...(params ?? {}),
        };

        const param = Object.keys(params)
            .filter((k) => params[k] !== null && params[k] !== undefined)
            .map((k) => `${k}=${encodeURIComponent(params[k])}`)
            .join('&');

        const load = loading(uuid);
        const ctx = objectPool.get(uuid);
        const reqCancel = new Promise((r) => {
            ctx.reqs.push(r);
        });

        ctx.last = request(HTTP_GET, `${TENOR_API_BASE_URL}${path}?${param}`)
            .withCache()
            .withRetry()
            .withCancel(reqCancel)
            .default(defaultJSON)
            .then((r) => r.json())
            .then((j) => {
                if (j.error) {
                    console.error('Tenor API responded with error:', j.error);
                    throw new Error(j.error.message || 'Tenor API Error');
                }

                if (!j.results || j.results.length === 0) {
                    util.notify('No GIFs found.').info();
                    ctx.gifs.length = 0;
                    ctx.lists.innerHTML = `<p class="text-center text-secondary m-3">No GIFs found.</p>`;
                    return j;
                }

                ctx.next = j?.next;
                load.until(j.results.length);
                ctx.gifs.push(...j.results);

                if (ctx.lists.innerHTML === '' || ctx.lists.children.length === 0 || ctx.lists.children[0].children.length === 0) {
                     bootUp(uuid);
                }


                return c.run(show(uuid, j.results, load), reqCancel);
            })
            .catch((err) => {
                if (err.name === ERROR_ABORT) {
                    console.warn('Fetch abort:', err);
                } else {
                    console.error('gif.js: Error fetching GIFs from Tenor:', err);
                    util.notify(`Failed to load GIFs: ${err.message || 'Network error'}`).error();
                    ctx.gifs.length = 0;
                    ctx.lists.innerHTML = `<p class="text-center text-danger m-3">Failed to load GIFs. Check API Key or network.</p>`;
                }
            })
            .finally(() => load.release());
    };

    /**
     * @param {string} uuid 
     * @returns {string}
     */
    const template = (uuid) => {
        uuid = util.escapeHtml(uuid);

        return `
        <label for="gif-search-${uuid}" class="form-label my-1"><i class="fa-solid fa-photo-film me-2"></i>Gif</label>

        <div class="d-flex mb-3" id="gif-search-nav-${uuid}">
            <button class="btn btn-secondary btn-sm rounded-4 shadow-sm me-1 my-1" onclick="undangan.comment.gif.back(this, '${uuid}')" data-offline-disabled="false"><i class="fa-solid fa-arrow-left"></i></button>
            <input type="text" name="gif-search" id="gif-search-${uuid}" autocomplete="on" class="form-control shadow-sm rounded-4" placeholder="Search for a GIF on Tenor" data-offline-disabled="false">
        </div>

        <div class="position-relative">
            <div class="position-absolute d-flex flex-column justify-content-center align-items-center top-50 start-50 translate-middle w-100 h-100 bg-overlay-auto rounded-4 z-3" id="gif-loading-${uuid}">
                <div class="progress w-25" role="progressbar" style="height: 0.5rem;" aria-label="progress bar">
                    <div class="progress-bar" id="progress-bar-${uuid}" style="width: 0%"></div>
                </div>
                <small class="mt-1 text-theme-auto bg-theme-auto py-0 px-2 rounded-4" id="progress-info-${uuid}" style="font-size: 0.7rem;"></small>
            </div>
            <div id="gif-lists-${uuid}" class="d-flex rounded-4 p-0 overflow-y-scroll border" data-continue="true" style="height: 15rem;"></div>
        </div>

        <figure class="d-flex m-0 position-relative" id="gif-result-${uuid}">
            <button onclick="undangan.comment.gif.cancel('${uuid}')" id="gif-cancel-${uuid}" class="btn d-none position-absolute justify-content-center align-items-center top-0 end-0 bg-overlay-auto p-2 m-0 rounded-circle border shadow-sm z-1">
                <i class="fa-solid fa-circle-xmark"></i>
            </button>
        </figure>`;
    };

    /**
     * @param {string} uuid
     * @returns {Promise<void>}
     */
    const waitLastRequest = async (uuid) => {
        const ctx = objectPool.get(uuid);

        // Ensure all pending requests for this context are cancelled
        ctx.reqs.forEach((f) => f(ERROR_ABORT));
        ctx.reqs.length = 0;

        // Wait for the last ongoing request to settle
        if (ctx.last) {
            try {
                await ctx.last;
            } catch (error) {
                if (error.name !== ERROR_ABORT) {
                    console.error(`gif.js: Error in waitLastRequest for ${uuid}:`, error);
                }
            } finally {
                ctx.last = null;
            }
        }
    };

    /**
     * @param {string} uuid
     * @returns {Promise<void>}
     */
    const bootUp = async (uuid) => {
        const ctx = objectPool.get(uuid);
        const prevCol = ctx.col ?? 0;

        let currentCols = 0;
        for (const [k, v] of Object.entries(breakPoint)) {
            if (ctx.lists.clientWidth >= parseInt(k)) {
                currentCols = v;
            }
        }
        ctx.col = currentCols || Object.values(breakPoint)[0];

        if (prevCol === ctx.col && ctx.lists.innerHTML !== '') {
            return;
        }

        ctx.pointer = -1;
        ctx.limit = ctx.col * 5;
        ctx.lists.innerHTML = '';
        for (let i = 0; i < ctx.col; i++) {
            const colDiv = document.createElement('div');
            colDiv.classList.add('d-flex', 'flex-column');
            ctx.lists.appendChild(colDiv);
        }

        // Only run show if there are GIFs to display (e.g., from a previous search)
        if (ctx.gifs.length > 0) {
            try {
                await c.run(show(uuid, ctx.gifs));
            } catch (error) {
                console.error(`gif.js: Error in bootUp while running show for UUID ${uuid}:`, error);
                ctx.gifs.length = 0; // Clear GIFs if rendering failed
                // Show an error message directly here if bootUp fails
                ctx.lists.innerHTML = `<p class="text-center text-danger m-3">Error displaying GIFs.</p>`;
            }
        } else {
             // If no GIFs to display, but bootUp was called, ensure loading is released if stuck
             loading(uuid).release();
             // Optionally show a "No GIFs yet" message if search hasn't run
             if (!ctx.query) { // If it's initial bootUp and no search run yet
                 ctx.lists.innerHTML = `<p class="text-center text-secondary m-3">Search or wait for featured GIFs.</p>`;
             }
        }


        if (prevCol !== ctx.col) {
            ctx.lists.scroll({
                top: ctx.lists.scrollHeight,
                behavior: 'instant',
            });
        }
    };

    /**
     * @param {string} uuid
     * @returns {Promise<void>}
     */
    const scroll = async (uuid) => {
        const ctx = objectPool.get(uuid);

        if (ctx.lists.getAttribute('data-continue') !== 'true') {
            return;
        }

        if (!ctx.next || ctx.next.length === 0) {
            return;
        }

        const isQuery = ctx.query && ctx.query.trim().length > 0;
        const params = { pos: ctx.next, limit: ctx.limit };

        if (isQuery) {
            params.q = ctx.query;
        }

        if (ctx.lists.scrollTop > (ctx.lists.scrollHeight - ctx.lists.clientHeight) * 0.8) {
            render(uuid, isQuery ? '/search' : '/featured', params);
        }
    };

    /**
     * @param {string} uuid
     * @param {string|null} [q=null]
     * @returns {Promise<void>}
     */
    const search = async (uuid, q = null) => {
        const ctx = objectPool.get(uuid);

        // Update query and reset pagination for new search
        ctx.query = (q !== null) ? q : ctx.query;
        if (!ctx.query || ctx.query.trim().length === 0) {
            ctx.query = null;
        }

        ctx.next = null;
        ctx.gifs.length = 0; // Clear previous GIFs

        await waitLastRequest(uuid); // Cancel any previous pending requests

        // Re-initialize columns and pointer if needed
        if (ctx.col === null || (ctx.lists.clientWidth !== ctx.lists.offsetWidth) ) {
            await bootUp(uuid); // This will also release loading if stuck
        } else {
             ctx.pointer = -1;
             ctx.lists.innerHTML = ''; // Clear columns
             for (let i = 0; i < ctx.col; i++) {
                const colDiv = document.createElement('div');
                colDiv.classList.add('d-flex', 'flex-column');
                ctx.lists.appendChild(colDiv);
            }
        }
        
        // Start rendering by fetching from Tenor API
        render(uuid, ctx.query === null ? '/featured' : '/search', { q: ctx.query, limit: ctx.limit });
    };

    /**
     * @param {HTMLButtonElement} button
     * @param {string} uuid
     * @param {string} id - GIF ID from Tenor API
     * @param {string} urlBase64 - Base64 encoded FULL GIF URL (e.g., https://media.tenor.com/images/...)
     * @returns {Promise<void>}
     */
    const click = async (button, uuid, id, urlBase64) => {
        const btn = util.disableButton(button, util.loader.replace('me-1', 'me-0'), true);

        const res = document.getElementById(`gif-result-${uuid}`);
        res.setAttribute('data-id', id); // Store original Tenor GIF ID
        res.setAttribute('data-url', util.base64Decode(urlBase64)); // Store selected GIF's full URL

        res.querySelector(`#gif-cancel-${uuid}`).classList.replace('d-none', 'd-flex');
        
        // Directly use the full URL from urlBase64, no need to call get() again
        res.insertAdjacentHTML('beforeend', `<img src="${util.base64Decode(urlBase64)}" class="img-fluid mx-auto gif-image rounded-4" alt="selected-gif">`);

        btn.restore();

        objectPool.get(uuid).lists.classList.replace('d-flex', 'd-none');
        document.getElementById(`gif-search-nav-${uuid}`).classList.replace('d-flex', 'd-none');
    };

    /**
     * @param {string} uuid
     * @returns {void} 
     */
    const cancel = (uuid) => {
        const res = document.getElementById(`gif-result-${uuid}`);
        res.removeAttribute('data-id');
        res.removeAttribute('data-url'); // Clear the URL as well
        const img = res.querySelector('img');
        if (img) img.remove(); // Remove image if it exists

        res.querySelector(`#gif-cancel-${uuid}`).classList.replace('d-flex', 'd-none');

        objectPool.get(uuid).lists.classList.replace('d-none', 'd-flex');
        document.getElementById(`gif-search-nav-${uuid}`).classList.replace('d-none', 'd-flex');
    };

    /**
     * @param {string|null} uuid 
     * @returns {Promise<void>}
     */
    const remove = async (uuid = null) => {
        if (uuid) {
            if (objectPool.has(uuid)) {
                await waitLastRequest(uuid);
                eventListeners.delete(uuid);
                objectPool.delete(uuid);
            }
        } else {
            await Promise.allSettled(Array.from(objectPool.keys()).map((k) => waitLastRequest(k)));
            eventListeners.clear();
            objectPool.clear();
        }
    };

    /**
     * @param {HTMLButtonElement} button
     * @param {string} uuid
     * @returns {Promise<void>} 
     */
    const back = async (button, uuid) => {
        const btn = util.disableButton(button, util.loader.replace('me-1', 'me-0'), true);
        await waitLastRequest(uuid);
        btn.restore();

        document.getElementById(`gif-form-${uuid}`).classList.toggle('d-none', true);
        document.getElementById(`comment-form-${uuid}`)?.classList.toggle('d-none', false);
    };

    /**
     * @param {string} uuid
     * @returns {Promise<void>} 
     */
    const open = async (uuid) => {
        let ctx = objectPool.get(uuid); // Dapatkan konteks, bisa saja undefined jika baru

        if (!ctx) { // Jika konteks belum ada (pertama kali dibuka untuk UUID ini)
            util.safeInnerHTML(document.getElementById(`gif-form-${uuid}`), template(uuid));
            const lists = document.getElementById(`gif-lists-${uuid}`);

            objectPool.set(uuid, { // Buat dan simpan konteks baru
                uuid: uuid,
                lists: lists,
                last: null,
                limit: null,
                query: null,
                next: null,
                col: null,
                pointer: -1,
                gifs: [],
                reqs: [],
            });
            ctx = objectPool.get(uuid); // <--- PENTING: Re-assign ctx untuk memastikan ia menunjuk ke objek yang baru dibuat

            const deScroll = util.debounce(scroll, 150);
            lists.addEventListener('scroll', () => deScroll(uuid));

            const deSearch = util.debounce(search, 850);
            document.getElementById(`gif-search-${uuid}`).addEventListener('input', (e) => deSearch(uuid, e.target.value));

            await bootUp(uuid); // Panggil bootUp untuk setup kolom awal
        }

        // --- DEBUGGING LOG ---
        console.log(`gif.js: open for UUID ${uuid}. Context state (after init/get):`, ctx); // Log ctx state
        // --- AKHIR DEBUGGING LOG ---

        document.getElementById(`gif-form-${uuid}`).classList.toggle('d-none', false);
        document.getElementById(`comment-form-${uuid}`)?.classList.toggle('d-none', true);

        if (eventListeners.has(uuid)) {
            eventListeners.get(uuid)();
        }

        // Gunakan 'ctx' yang sekarang dijamin terdefinisi
        if (ctx.gifs.length === 0 || !ctx.next) { // <--- Baris ini sekarang aman dari TypeError
            await search(uuid);
        }


        document.getElementById(`gif-form-${uuid}`).classList.toggle('d-none', false);
        document.getElementById(`comment-form-${uuid}`)?.classList.toggle('d-none', true);

        if (eventListeners.has(uuid)) {
            eventListeners.get(uuid)();
        }

        // Jika GIF lists kosong, atau search token tidak ada, lakukan pencarian awal
        // ini untuk memastikan GIF muncul saat pertama kali dibuka atau setelah ada error
        if (ctx.gifs.length === 0 || !ctx.next) {
            await search(uuid);
        }
    };

    /**
     * @param {string} uuid 
     * @returns {boolean}
     */
    const isOpen = (uuid) => {
        const el = document.getElementById(`gif-form-${uuid}`);
        return el && !el.classList.contains('d-none');
    };

    /**
     * Gets the selected GIF's Tenor ID.
     * @param {string} uuid 
     * @returns {string|null}
     */
    const getResultId = (uuid) => document.getElementById(`gif-result-${uuid}`)?.getAttribute('data-id');

    /**
     * Gets the selected GIF's full URL.
     * This is what you should save to Firestore (`gif` field in comment).
     * @param {string} uuid 
     * @returns {string|null}
     */
    const getResultUrl = (uuid) => document.getElementById(`gif-result-${uuid}`)?.getAttribute('data-url');


    /**
     * @param {string} uuid 
     * @returns {void}
     */
    const removeGifSearch = (uuid) => document.querySelector(`[for="gif-search-${uuid}"]`)?.remove();

    /**
     * @param {string} uuid 
     * @returns {void}
     */
    const removeButtonBack = (uuid) => document.querySelector(`[onclick="undangan.comment.gif.back(this, '${uuid}')"]`)?.remove();

    /**
     * @param {string} uuid 
     * @param {function} callback
     * @returns {void}
     */
    const onOpen = (uuid, callback) => eventListeners.set(uuid, callback);

    /**
     * @param {string|null} [uuid=null] 
     * @returns {{ show: function(): void, hide: function(): void, click: function(): void }}
     */
    const buttonCancel = (uuid = null) => {
        const btnCancel = document.getElementById(`gif-cancel-${uuid ? uuid : gifDefault}`);
        if (!btnCancel) {
            console.warn(`gif.js: buttonCancel: Element gif-cancel-${uuid} not found.`);
            return { show: () => {}, hide: () => {}, click: () => {} };
        }

        return {
            show: () => btnCancel.classList.replace('d-none', 'd-flex'),
            hide: () => btnCancel.classList.replace('d-flex', 'd-none'),
            click: () => btnCancel.dispatchEvent(new Event('click')),
        };
    };

    /**
     * @returns {boolean}
     */
    const isActive = () => !!storage('config').get('tenor_key') && storage('config').get('tenor_key') !== 'TENOR-API-KEY-OPTIONAL'; // Baca langsung dari storage untuk nilai terbaru

    /**
     * @returns {void}
     */
    const showButton = () => {
         const tenorKeyPresent = isActive(); // Gunakan isActive yang sudah membaca dari storage
        document.querySelector('[onclick="undangan.comment.gif.open(undangan.comment.gif.default)"]')?.classList.toggle('d-none', !tenorKeyPresent);
    };
 

    /**
     * @returns {void}
     */
    const init = () => {
        c = cache('gif');
        objectPool = new Map();
        eventListeners = new Map();
        config = storage('config'); // Inisialisasi config. Ini adalah reference ke storage('config')

        // Panggil showButton() secara langsung setelah config diinisialisasi
        showButton();

        // Kemudian tambahkan listener untuk pembaruan pengaturan admin
        document.addEventListener('undangan.session', showButton);
        document.addEventListener('adminSettingsUpdated', showButton);
    };

    return {
        default: gifDefault,
        init,
        get,
        back,
        open,
        cancel,
        click,
        remove,
        isOpen,
        onOpen,
        isActive,
        getResultId,
        getResultUrl,
        buttonCancel,
        removeGifSearch,
        removeButtonBack,
        prepareCache,
    };
})();