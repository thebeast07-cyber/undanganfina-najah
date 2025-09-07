// undangan\js\app\guest\audio.js

import { progress } from './progress.js';
import { util } from '../../common/util.js';

export const audio = (() => {

    const statePlay = '<i class="fa-solid fa-circle-pause spin-button"></i>';
    const statePause = '<i class="fa-solid fa-circle-play"></i>';

    /**
     * @type {HTMLAudioElement|null}
     */
    let audioEl = null;

    let isPlaying = false; // Status apakah audio sedang diputar oleh sistem
    let isUserPaused = false; // Flag: apakah pengguna yang secara manual mem-pause musik

    /**
     * Fungsi internal untuk memperbarui UI tombol musik
     * @param {string} stateHtml
     */
    const updateMusicButtonUI = (stateHtml) => {
        const musicButton = document.getElementById('button-music');
        if (musicButton) {
            musicButton.innerHTML = stateHtml;
        }
    };

    /**
     * Fungsi untuk memutar audio.
     * @returns {Promise<void>}
     */
    const play = async () => {
        const musicButton = document.getElementById('button-music'); // Ambil referensi di sini
        if (!navigator.onLine || !musicButton || isUserPaused) {
            console.log("Audio: Play() tidak dijalankan. isUserPaused:", isUserPaused); // Debugging
            return;
        }
        musicButton.disabled = true;
        try {
            await audioEl.play();
            musicButton.disabled = false;
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn('Audio: Play() diinterupsi (AbortError). Ini normal jika tanpa interaksi atau diinterupsi cepat.');
            } else {
                console.error('Audio: Error saat memutar audio:', err);
                util.notify(`Failed to play music: ${err.message}`).error();
            }
            musicButton.disabled = false;
        }
    };

    /**
     * Fungsi untuk menghentikan audio.
     * @returns {void}
     */
    const pause = () => {
        const musicButton = document.getElementById('button-music'); // Ambil referensi di sini
        console.log("Audio: Fungsi pause() dipanggil.");
        if (!navigator.onLine || !musicButton) {
            console.log("Audio: Pause() tidak dijalankan karena offline atau musicButton tidak ada.");
            return;
        }
        if (audioEl) {
            audioEl.pause();
            console.log("Audio: audioEl.pause() dipanggil.");
        } else {
            console.log("Audio: audioEl tidak ditemukan, tidak bisa pause.");
        }
    };

    // ***** FUNGSI BARU YANG DIEKSPOS *****
    // Fungsi yang akan dipanggil oleh modul lain (misal video) untuk PAUSE secara otomatis
    const setAutomaticPause = () => {
        console.log("Audio: setAutomaticPause dipanggil. isPlaying:", isPlaying, "isUserPaused:", isUserPaused);
        if (isPlaying && !isUserPaused) {
            pause();
            console.log("Audio: Musik di-pause secara otomatis oleh video.");
        } else {
            console.log("Audio: setAutomaticPause: Tidak mem-pause karena kondisi tidak terpenuhi.");
        }
    };

    // Fungsi yang akan dipanggil oleh modul lain (misal video) untuk PLAY secara otomatis
    const setAutomaticPlay = () => {
        console.log("Audio: setAutomaticPlay dipanggil. isPlaying:", isPlaying, "isUserPaused:", isUserPaused);
        if (!isPlaying && !isUserPaused) {
            play();
            console.log("Audio: Musik di-play secara otomatis oleh video.");
        } else {
            console.log("Audio: setAutomaticPlay: Tidak mem-play karena kondisi tidak terpenuhi.");
        }
    };
    // ***** AKHIR FUNGSI BARU YANG DIEKSPOS *****


    /**
     * @param {boolean} [playOnOpen=true]
     * @returns {Promise<void>}
     */
    const load = async (playOnOpen = true) => {

        const url = document.body.getAttribute('data-audio');
        if (!url) {
            progress.complete('audio', true);
            return;
        }

        try {
            audioEl = new Audio(url);
            audioEl.loop = true;
            audioEl.muted = false;
            audioEl.autoplay = false;
            audioEl.controls = false;

            audioEl.addEventListener('error', (e) => {
                console.error("Audio: Error pada elemen audio:", e);
                util.notify('Failed to load background music.').error();
            });
            audioEl.addEventListener('play', () => {
                isPlaying = true;
                updateMusicButtonUI(statePlay);
            });
            audioEl.addEventListener('pause', () => {
                isPlaying = false;
                updateMusicButtonUI(statePause);
            });

            progress.complete('audio');
        } catch (err) {
            console.error("Audio: Error saat memuat audio (di luar play()):", err);
            progress.invalid('audio');
            return;
        }

        const musicButton = document.getElementById('button-music');

        // Event listener yang memicu play saat undangan dibuka
        document.addEventListener('undangan.open', () => {
            if (musicButton) {
                musicButton.classList.remove('d-none');
                if (playOnOpen) {
                    play();
                }
            }
        });

        // Listener untuk status offline (jika offline, pause musik)
        if (musicButton) {
            musicButton.addEventListener('offline', pause);
            // Listener untuk klik tombol musik (toggle play/pause)
            musicButton.addEventListener('click', () => {
                if (isPlaying) {
                    pause();
                    isUserPaused = true; // Set flag bahwa user yang mem-pause
                    console.log("Audio: Musik di-pause manual oleh user.");
                } else {
                    isUserPaused = false; // Reset flag
                    play();
                    console.log("Audio: Musik di-play manual oleh user.");
                }
            });
        }
    };

    /**
     * Inisialisasi modul audio.
     * @returns {object}
     */
    const init = () => {
        progress.add();
        return {
            load,
            setAutomaticPause, // <--- EKSPOS FUNGSI INI
            setAutomaticPlay,  // <--- EKSPOS FUNGSI INI
        };
    };

    return {
        init,
    };
})();