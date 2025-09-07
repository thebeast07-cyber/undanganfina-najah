// undangan\js\app\guest\image.js

import { progress } from './progress.js';
import { cache } from '../../connection/cache.js';

export const image = (() => {

    /**
     * @type {NodeListOf<HTMLImageElement>|null}
     */
    let images = null;

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    let hasSrc = false;

    /**
     * @type {object[]}
     */
    const urlCache = [];

    /**
     * @param {string} src 
     * @returns {Promise<HTMLImageElement>}
     */
    const loadedImage = (src) => new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
    });

    /**
     * @param {HTMLImageElement} el 
     * @param {string} src 
     * @returns {Promise<void>}
     */
    const appendImage = (el, src) => loadedImage(src).then((img) => {
        el.width = img.naturalWidth;
        el.height = img.naturalHeight;
        el.src = img.src;
        img.remove();
        // progress.complete('image'); // <-- HAPUS PANGGILAN INI
    });

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByFetch = (el) => {
        urlCache.push({
            url: el.getAttribute('data-src'),
            res: (url) => appendImage(el, url),
            rej: (err) => {
                console.error(err);
                // progress.invalid('image'); // <-- HAPUS PANGGILAN INI
            },
        });
    };

    /**
     * @param {HTMLImageElement} el 
     * @returns {void}
     */
    const getByDefault = (el) => {
        el.onerror = () => {
            // progress.invalid('image'); // <-- HAPUS PANGGILAN INI
            console.error(`[Image Load] Error loading default image: ${el.src}`);
        };
        el.onload = () => {
            el.width = el.naturalWidth;
            el.height = el.naturalHeight;
            // progress.complete('image'); // <-- HAPUS PANGGILAN INI
        };

        if (el.complete && el.naturalWidth !== 0 && el.naturalHeight !== 0) {
            // progress.complete('image'); // <-- HAPUS PANGGILAN INI
        } else if (el.complete) {
            // progress.invalid('image'); // <-- HAPUS PANGGILAN INI
            console.error(`[Image Load] Default image failed to load immediately: ${el.src}`);
        }
    };

    /**
     * @returns {boolean}
     */
    const hasDataSrc = () => hasSrc;

    /**
     * @returns {Promise<void>}
     */
    const load = async () => {
        // progress.add('image'); // <-- TAMBAHKAN INI DI SINI
        const arrImages = Array.from(images);
        const loadPromises = []; // Kumpulkan semua promise loading gambar

        arrImages.filter((el) => el.getAttribute('data-fetch-img') !== 'high').forEach((el) => {
            // Untuk gambar non-high-res, kita tidak perlu Promise.allSettled yang menunggu,
            // tapi kita tetap ingin memastikan getByFetch/getByDefault dipanggil.
            // Jika mereka menggunakan Promise, tambahkan ke loadPromises.
            if (el.hasAttribute('data-src')) {
                // getByFetch mendorong ke urlCache yang diproses oleh c.run nanti
                getByFetch(el);
            } else {
                getByDefault(el);
            }
        });

        if (!hasSrc) {
            // Jika tidak ada gambar dengan data-src (yang akan diproses oleh c.run),
            // maka progress 'image_group' harus selesai di sini jika tidak ada tugas lain.
            // progress.complete('image_group'); // <-- HAPUS INI, kita akan panggil di finally
            return Promise.resolve();
        }

        await c.open();

        // Kumpulkan semua promise yang perlu diselesaikan sebelum progress complete
        const highResPromises = arrImages.filter((el) => el.getAttribute('data-fetch-img') === 'high').map((el) => {
            return c.get(el.getAttribute('data-src'), progress.getAbort())
                .then((i) => appendImage(el, i))
                .then(() => el.classList.remove('opacity-0'))
                .catch((err) => {
                    console.error(`[Image Load] Error loading high-res image ${el.getAttribute('data-src')}:`, err);
                    return Promise.reject(err); // Tolak promise agar Promise.allSettled menangkapnya
                });
        });
        loadPromises.push(...highResPromises);

        const urlCachePromises = c.run(urlCache, progress.getAbort()).catch(err => {
            console.error("[Image Load] Error processing URL cache:", err);
            return Promise.reject(err); // Tolak promise
        });
        loadPromises.push(urlCachePromises);


        // Tunggu semua promise loading gambar selesai (berhasil atau gagal)
        return Promise.allSettled(loadPromises).then(() => {
            // Semua gambar sudah diproses atau dicoba diproses.
            // Progress 'image_group' akan di-complete di finally dari guest.js
            console.log("[Image Load] All image loading attempts concluded."); // LOG BARU
        });
    };

    /**
     * @param {string} blobUrl 
     * @returns {Promise<Response>}
     */
    const download = (blobUrl) => c.download(blobUrl, `image_${Date.now()}`);

    /**
     * @returns {object}
     */
    const init = () => {
        c = cache('image').withForceCache();
        images = document.querySelectorAll('img');

        // HANYA ADA SATU KALI progress.add() UNTUK SELURUH GRUP GAMBAR DI SINI
        // Ini akan dipanggil di init() modul image, bukan untuk setiap gambar.
        progress.add('image_group'); // <-- Progress untuk SELURUH GRUP GAMBAR

        hasSrc = Array.from(images).some((i) => i.hasAttribute('data-src'));

        return {
            load,
            download,
            hasDataSrc,
        };
    };

    return {
        init,
    };
})();