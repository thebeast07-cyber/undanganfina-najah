// undangan\js\app\guest\guest.js

// Hapus atau komentari impor yang tidak lagi dibutuhkan dari sistem lama
// import { session } from '../../common/session.js';
// import { HTTP_GET, request, HTTP_STATUS_OK, HTTP_STATUS_PARTIAL_CONTENT } from '../../connection/request.js';
// import { cache } from '../../connection/cache.js';

// Biarkan impor lainnya seperti ini:
import { video } from './video.js';
import { image } from './image.js';
import { audio } from './audio.js';
import { progress } from './progress.js';
import { util } from '../../common/util.js';
import { bs } from '../../libs/bootstrap.js';
import { loader } from '../../libs/loader.js';
import { theme } from '../../common/theme.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { offline } from '../../common/offline.js';
import { comment } from '../components/comment.js';
import * as confetti from '../../libs/confetti.js';

export const guest = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let information = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let config = null;

    // Variabel untuk menyimpan instance modul yang sudah diinisialisasi
    let audioModule = null; // Akan menyimpan hasil audio.init()
    let videoModule = null; // Akan menyimpan hasil video.init()

    /**
     * Fungsi ini mengatur hitung mundur.
     * Sekarang, 'data-time' akan diisi dari Firestore, bukan dari HTML secara statis.
     * @returns {void}
     */
    const countDownDate = () => {
        // Mengambil waktu target dari atribut data-time di body. Atribut ini akan diisi oleh data dari Firestore.
        const count = (new Date(document.body.getAttribute('data-time').replace(' ', 'T'))).getTime();

        /**
         * @param {number} num
         * @returns {string}
         */
        const pad = (num) => num < 10 ? `0${num}` : `${num}`;

        const day = document.getElementById('day');
        const hour = document.getElementById('hour');
        const minute = document.getElementById('minute');
        const second = document.getElementById('second');

        const updateCountdown = () => {
            const distance = Math.abs(count - Date.now());

            day.textContent = pad(Math.floor(distance / (1000 * 60 * 60 * 24)));
            hour.textContent = pad(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
            minute.textContent = pad(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)));
            second.textContent = pad(Math.floor((distance % (1000 * 60)) / 1000));

            // Mengatur timeout untuk memperbarui hitung mundur setiap detik
            util.timeOut(updateCountdown, 1000 - (Date.now() % 1000));
        };

        // Memulai hitung mundur
        util.timeOut(updateCountdown);
    };

    /**
     * Fungsi ini menampilkan nama tamu dari URL (jika ada).
     * Pesan "Kepada Yth" akan diambil dari Firestore.
     * @returns {void}
     */
    const showGuestName = () => {
        const raw = window.location.search.split('to=');
        let name = null;

        if (raw.length > 1 && raw[1].length >= 1) {
            name = window.decodeURIComponent(raw[1]);
        }

        if (name) {
            const guestName = document.getElementById('guest-name');
            const div = document.createElement('div');
            div.classList.add('m-2');

            // Menggunakan 'data-message' yang sudah diisi dari Firestore
            const template = `<small class="mt-0 mb-1 mx-0 p-0">${util.escapeHtml(guestName?.getAttribute('data-message'))}</small><p class="m-0 p-0" style="font-size: 1.25rem">${util.escapeHtml(name)}</p>`;
            util.safeInnerHTML(div, template);

            guestName?.appendChild(div);
        }

        const form = document.getElementById('form-name');
        if (form) {
            form.value = information.get('name') ?? name;
        }
    };

    /**
     * Fungsi untuk efek slide desktop (gambar latar).
     * @returns {Promise<void>}
     */
    const slide = async () => {
        const interval = 6000;
        const slides = document.querySelectorAll('.slide-desktop');

        if (!slides || slides.length === 0) {
            return Promise.resolve();
        }

        const desktopEl = document.getElementById('root')?.querySelector('.d-sm-block');
        if (!desktopEl) {
            return Promise.resolve();
        }

        desktopEl.dispatchEvent(new Event('undangan.slide.stop'));

        if (window.getComputedStyle(desktopEl).display === 'none') {
            return Promise.resolve();
        }

        if (slides.length === 1) {
            util.changeOpacity(slides[0], true);
            return Promise.resolve();
        }

        let index = 0;
        for (const [i, s] of slides.entries()) {
            if (i === index) {
                s.classList.add('slide-desktop-active');
                await util.changeOpacity(s, true);
                break;
            }
        }

        let run = true;
        const nextSlide = async () => {
            await util.changeOpacity(slides[index], false);
            slides[index].classList.remove('slide-desktop-active');

            index = (index + 1) % slides.length;

            if (run) {
                slides[index].classList.add('slide-desktop-active');
                await util.changeOpacity(slides[index], true);
            }

            return run;
        };

        desktopEl.addEventListener('undangan.slide.stop', () => {
            run = false;
        });

        const loop = async () => {
            if (await nextSlide()) {
                util.timeOut(loop, interval);
            }
        };

        util.timeOut(loop, interval);
    };

    /**
     * Membuka halaman undangan setelah tombol "Open Invitation" diklik.
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const open = (button) => {
        button.disabled = true;
        document.body.scrollIntoView({ behavior: 'instant' });

        if (theme.isAutoMode()) {
            document.getElementById('button-theme').classList.remove('d-none');
        }

        slide();
        theme.spyTop();

        document.dispatchEvent(new Event('undangan.open'));
        util.changeOpacity(document.getElementById('welcome'), false).then((el) => el.remove());
    };

    /**
     * Menampilkan gambar di modal (pop-up) saat diklik.
     * @param {HTMLImageElement} img
     * @returns {void}
     */
    const modal = (img) => {
        document.getElementById('button-modal-click').setAttribute('href', img.src);
        document.getElementById('button-modal-download').setAttribute('data-src', img.src);

        const i = document.getElementById('show-modal-image');
        i.src = img.src;
        i.width = img.width;
        i.height = img.height;
        bs.modal('modal-image').show();
    };

    /**
     * Mengatur perilaku klik pada gambar di modal.
     * @returns {void}
     */
    const modalImageClick = () => {
        document.getElementById('show-modal-image').addEventListener('click', (e) => {
            const abs = e.currentTarget.parentNode.querySelector('.position-absolute');

            abs.classList.contains('d-none')
                ? abs.classList.replace('d-none', 'd-flex')
                : abs.classList.replace('d-flex', 'd-none');
        });
    };

    /**
     * Menampilkan animasi confetti saat story dilihat.
     * @param {HTMLDivElement} div
     * @returns {void}
     */
    const showStory = (div) => {
        if (navigator.vibrate) {
            navigator.vibrate(500);
        }

        confetti.tapTapAnimation(div, 100);
        util.changeOpacity(div, false).then((e) => e.remove());
    };

    /**
     * Menyimpan status bahwa informasi awal sudah dibaca.
     * @returns {void}
     */
    const closeInformation = () => information.set('info', true);

    /**
     * Menormalisasi font Arab.
     * @returns {void}
     */
    const normalizeArabicFont = () => {
        document.querySelectorAll('.font-arabic').forEach((el) => {
            el.innerHTML = String(el.innerHTML).normalize('NFC');
        });
    };

    /**
     * Mengaktifkan animasi SVG (ikon hati, dll.).
     * @returns {void}
     */
    const animateSvg = () => {
        document.querySelectorAll('svg').forEach((el) => {
            if (el.hasAttribute('data-class')) {
                util.timeOut(() => el.classList.add(el.getAttribute('data-class')), parseInt(el.getAttribute('data-time')));
            }
        });
    };

    /**
     * Membangun tautan Google Calendar.
     * Data tanggal/waktu akan diambil dari data yang dimuat Firestore.
     * @returns {void}
     */
    const buildGoogleCalendar = () => {
    /**
     * @param {Date} d
     * @returns {string}
     */
    const formatDate = (d) => {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) {
            console.error("buildGoogleCalendar: Tanggal dari Firestore tidak valid:", d);
            return '';
        }
        return dateObj.toISOString().split('T')[0].replace(/-/g, '');
    };

    const weddingTimeRaw = document.body.getAttribute('data-time');

    let formattedDate = '';
    try {
        const timeParsed = JSON.parse(weddingTimeRaw);
        if (typeof timeParsed === 'object' && timeParsed.seconds) {
            formattedDate = formatDate(new Date(timeParsed.seconds * 1000));
        } else {
            throw new Error('Invalid timestamp structure');
        }
    } catch (e) {
        console.warn("Fallback ke string format:", weddingTimeRaw);
        formattedDate = formatDate(weddingTimeRaw);
    }

    if (!formattedDate) {
        console.warn("buildGoogleCalendar: Tanggal pernikahan tidak valid, Google Calendar tidak akan dibuat.");
        document.querySelector('#home button')?.classList.add('d-none');
        return;
    }

    const url = new URL('https://calendar.google.com/calendar/render');
    const data = new URLSearchParams({
        action: 'TEMPLATE',
        text: 'The Wedding of Najah and Fina',
        dates: `${formattedDate}/${formattedDate}`,
        details: 'Tanpa mengurangi rasa hormat, kami mengundang Anda untuk berkenan menghadiri acara pernikahan kami.',
        location: 'Ds. Prampelan Rt.02 Rw.05 Kec. Sayung Kab. Demak.',
    });

    url.search = data.toString();
    document.querySelector('#home button')?.addEventListener('click', () => window.open(url, '_blank'));
};

    /**
     * Memuat library tambahan seperti AOS (Animate On Scroll).
     * @returns {object}
     */
    const loaderLibs = () => {
        progress.add('libs'); // Menambahkan progress untuk libs
        /**
         * @param {{aos: boolean, confetti: boolean}} opt
         * @returns {void}
         */
        const load = (opt) => {
            loader(opt)
                .then(() => progress.complete('libs'))
                .catch(() => progress.invalid('libs'));
        };

        return {
            load,
        };
    };

    /**
     * Mengatur urutan booting (animasi awal, hitung mundur, dll.) setelah semua data dan aset dimuat.
     * @returns {Promise<void>}
     */
    const booting = async () => {
        animateSvg();
        document.body.scrollIntoView({ behavior: 'instant' });
        document.getElementById('root').classList.remove('opacity-0');

        if (information.has('presence')) {
            document.getElementById('form-presence').value = information.get('presence') ? '1' : '2';
        }

        if (information.get('info')) {
            document.getElementById('information')?.remove();
        }

        await util.changeOpacity(document.getElementById('welcome'), true);

        await util.changeOpacity(document.getElementById('loading'), false).then((el) => el.remove());

        countDownDate();
        showGuestName();
        buildGoogleCalendar();
        modalImageClick();
        normalizeArabicFont();
    };

    /**
     * Fungsi yang dijalankan saat DOM (struktur HTML) sudah dimuat.
     * Ini adalah titik awal utama untuk sebagian besar inisialisasi aplikasi.
     * @returns {void}
     */
    const domLoaded = () => {
        lang.init();
        offline.init();
        comment.init(); // comment.init() memanggil comment.show(true)
        progress.init();

        config = storage('config');
        information = storage('information');

        videoModule = video.init(); // Inisialisasi video dan simpan referensinya
        const img = image.init();
        audioModule = audio.init(); // Inisialisasi audio dan simpan referensinya
        const lib = loaderLibs(); // loaderLibs sekarang yang memanggil progress.add('libs')

        window.addEventListener('resize', util.debounce(slide));
        document.addEventListener('undangan.progress.done', () => booting());
        document.addEventListener('hide.bs.modal', () => document.activeElement?.blur());
        document.getElementById('button-modal-download').addEventListener('click', (e) => {
            img.download(e.currentTarget.getAttribute('data-src'));
        });

        progress.add('config'); // Menambah satu item progress untuk loading data konfigurasi undangan dari Firestore.

        const loadInvitationDataFromFirestore = async () => {
            try {
                const docRef = db.collection('invitations').doc('main_invite');
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                    const data = docSnap.data();
                    console.log("Data Undangan dari Firestore:", data);

                    document.body.setAttribute('data-audio', data.audioUrl || '');
                    document.body.setAttribute('data-confetti', data.confettiEnabled ? 'true' : 'false');
                    document.body.setAttribute('data-time', JSON.stringify(data.weddingDate));

                    const guestNameEl = document.getElementById('guest-name');
                    if (guestNameEl) {
                        guestNameEl.setAttribute('data-message', data.guestMessage || 'Kepada Yth Bapak/Ibu/Saudara/i');
                    }

                    if (data.tenorKey) {
                        config.set('tenor_key', data.tenorKey);
                    } else {
                        config.unset('tenor_key');
                    }

                    document.dispatchEvent(new Event('undangan.session'));
                    progress.complete('config'); // Selesaikan progress 'config'

                    // Panggil fungsi load dari modul audio/video/image yang sudah diinisialisasi
                    try {
                        await img.load(); // img.load() sekarang mengembalikan Promise
                        progress.complete('image_group'); // Selesaikan progress 'image_group' setelah load selesai
                    } catch (err) {
                        console.error("Error loading images:", err);
                        progress.invalid('image_group'); // Tandai invalid jika ada error
                    }
                    
                    videoModule.load(); // Ini akan memanggil progress.add('video') dan complete('video') di dalamnya
                    audioModule.load(); // Ini akan memanggil progress.add('audio') dan complete('audio') di dalamnya

                    // lib.load sudah dipanggil di loaderLibs(), kita hanya perlu menunggu promise-nya selesai
                    // progress.complete('libs') sudah ditangani di loader.js setelah lib.load selesai
                    lib.load({ confetti: data.confettiEnabled }); // Cukup panggil saja, progress ditangani di loader.js

                } else {
                    console.error("Dokumen konfigurasi undangan utama (main_invite) di koleksi 'invitations' tidak ditemukan di Firestore!");
                    util.notify('Failed to load invitation data. Please check Firestore configuration or document ID.').error();
                    progress.invalid('config');
                }
            } catch (error) {
                console.error("Error loading invitation data from Firestore:", error);
                util.notify('An error occurred while loading invitation data.').error();
                progress.invalid('config');
            }
        };

        window.addEventListener('load', loadInvitationDataFromFirestore);
    };

    /**
     * Inisialisasi utama modul guest.
     * @returns {object}
     */
    const init = () => {
        theme.init();
        document.addEventListener('DOMContentLoaded', domLoaded);

        return {
            util,
            theme,
            comment,
            // ***** EKSPOS MODUL AUDIO DAN VIDEO DI SINI *****
            audio: audioModule, // Objek yang di-return oleh audio.init()
            video: videoModule, // Objek yang di-return oleh video.init()
            guest: { // Ini adalah objek guest lama yang berisi fungsi-fungsi langsung
                open,
                modal,
                showStory,
                closeInformation,
            },
        };
    };

    return {
        init,
    };
})();