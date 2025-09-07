// undangan\js\app\components\pagination.js

import { util } from '../../common/util.js';
import { storage } from '../../common/storage.js';
import { lang } from '../../common/language.js';

export const pagination = (() => {

    /**
     * @type {HTMLElement|null}
     */
    let loadMoreButton = null;

    /**
     * @type {HTMLElement|null}
     */
    let loadMoreSpinner = null;

    /**
     * @type {number}
     */
    const perPage = 10; // Jumlah komentar yang dimuat per batch

    /**
     * @returns {number}
     */
    const getPer = () => {
        return perPage;
    };

    /**
     * Menampilkan tombol "Load More" dan menyembunyikan spinner.
     * @returns {void}
     */
    const showLoadMoreButton = () => {
        if (loadMoreButton) {
            loadMoreButton.classList.remove('d-none');
            loadMoreSpinner?.classList.add('d-none'); // Pastikan spinner tersembunyi
            loadMoreButton.disabled = false; // Pastikan tombol aktif
            loadMoreButton.innerHTML = lang.on('id', 'Muat Lebih Banyak Komentar').on('en', 'Load More Comments').get();
        }
    };

    /**
     * Menyembunyikan tombol "Load More".
     * @returns {void}
     */
    const hideLoadMoreButton = () => {
        if (loadMoreButton) {
            loadMoreButton.classList.add('d-none');
            loadMoreSpinner?.classList.add('d-none'); // Pastikan spinner juga tersembunyi
        }
    };

    /**
     * Menampilkan spinner di tombol "Load More" dan menonaktifkan tombol.
     * @returns {void}
     */
    const showLoadingLoadMoreButton = () => {
        if (loadMoreButton) {
            loadMoreButton.disabled = true; // Nonaktifkan tombol saat loading
            loadMoreSpinner?.classList.remove('d-none'); // Tampilkan spinner
            loadMoreButton.innerHTML = lang.on('id', 'Memuat... ').on('en', 'Loading... ').get() + '<i class="fa-solid fa-spinner fa-spin"></i>';
        }
    };

    /**
     * Menyembunyikan spinner di tombol "Load More" dan mengaktifkan tombol.
     * @returns {void}
     */
    const hideLoadingLoadMoreButton = () => {
        if (loadMoreButton) {
            loadMoreButton.disabled = false; // Aktifkan tombol
            loadMoreSpinner?.classList.add('d-none'); // Sembunyikan spinner
            loadMoreButton.innerHTML = lang.on('id', 'Muat Lebih Banyak Komentar').on('en', 'Load More Comments').get();
        }
    };

    /**
     * @returns {void}
     */
    const init = () => {
        loadMoreButton = document.getElementById('load-more-button');
        if (loadMoreButton) {
            // Asumsi spinner adalah child dari tombol atau elemen terpisah yang dikelola
            loadMoreSpinner = loadMoreButton.querySelector('.fa-spinner');

            loadMoreButton.addEventListener('click', () => {
                // Memicu event di commentsContainer untuk memuat lebih banyak
                document.getElementById('comments')?.dispatchEvent(new Event('undangan.comment.loadMore'));
            });
        }

        // Sembunyikan tombol secara default saat inisialisasi, akan ditampilkan oleh comment.js jika ada lebih banyak data
        hideLoadMoreButton();
    };

    return {
        init,
        getPer,
        showLoadMoreButton,
        hideLoadMoreButton,
        showLoadingLoadMoreButton,
        hideLoadingLoadMoreButton,
        // Fungsi setTotal tidak lagi diperlukan untuk paginasi, tetapi mungkin berguna untuk menampilkan total komentar
        setTotal: (total) => {
            // Anda bisa menambahkan logika di sini jika ingin menampilkan total jumlah komentar
            // Misalnya: document.getElementById('total-comments-count').innerText = `${total} Komentar`;
        },
        // reset tidak lagi diperlukan untuk paginasi, tetapi bisa digunakan untuk mereset state jika diperlukan
        reset: () => {
            // Logika reset jika diperlukan, misalnya untuk mereset lastVisibleDoc di comment.js
        }
    };
})();