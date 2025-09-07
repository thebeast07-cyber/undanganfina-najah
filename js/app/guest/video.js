// undangan\js\app\guest\video.js

import { progress } from './progress.js';
import { util } from '../../common/util.js';
import { cache } from '../../connection/cache.js';
import { HTTP_GET, request, HTTP_STATUS_OK, HTTP_STATUS_PARTIAL_CONTENT } from '../../connection/request.js';

export const video = (() => {

    /**
     * @type {ReturnType<typeof cache>|null}
     */
    let c = null;

    /**
     * @type {HTMLVideoElement|null}
     */
    let videoElement = null; // Menyimpan referensi elemen video

    const videoLoadingOverlayId = 'video-love-stroy-loading'; // Definisikan di sini agar bisa diakses

    /**
     * @returns {Promise<void>}
     */
    const load = () => {
        const wrap = document.getElementById('video-love-stroy');
        if (!wrap) {
            progress.complete('video', true);
            console.log("Video Load: Elemen video-love-stroy tidak ditemukan.");
            return Promise.resolve();
        }

        videoElement = wrap.querySelector('video');
        if (!videoElement) {
            wrap.remove();
            progress.complete('video', true);
            console.log("Video Load: Tidak ada tag video di dalam video-love-stroy.");
            return Promise.resolve();
        }

        const src = wrap.getAttribute('data-src') || videoElement.getAttribute('src');
        if (!src) {
            wrap.remove();
            progress.complete('video', true);
            console.log("Video Load: URL video tidak ditemukan di data-src atau atribut src.");
            return Promise.resolve();
        }

        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.controls = true;
        videoElement.autoplay = false;
        videoElement.playsInline = true;
        videoElement.preload = 'metadata';
        videoElement.disableRemotePlayback = true;
        videoElement.disablePictureInPicture = true;
        videoElement.controlsList = 'noremoteplayback nodownload noplaybackrate';

        const observer = new IntersectionObserver((es) => es.forEach((e) => {
            if (e.isIntersecting) {
                console.log("Video Observer: Video terlihat, mencoba play.");
                videoElement.play().catch(error => {
                    console.warn("Video Play Error (muted autoplay often fails without user interaction):", error);
                });
            } else {
                console.log("Video Observer: Video tidak terlihat, pause.");
                videoElement.pause();
            }
        }));

        videoElement.addEventListener('play', () => {
            console.log("Video Event: Video mulai play. Meminta audio latar pause.");
            if (typeof undangan !== 'undefined' && undangan.guest && undangan.guest.audio && undangan.guest.audio.setAutomaticPause) {
                undangan.guest.audio.setAutomaticPause();
            }
        });

        videoElement.addEventListener('pause', () => {
            console.log("Video Event: Video pause. Meminta audio latar play.");
            if (typeof undangan !== 'undefined' && undangan.guest && undangan.guest.audio && undangan.guest.audio.setAutomaticPlay) {
                undangan.guest.audio.setAutomaticPlay();
            }
        });

        videoElement.addEventListener('ended', () => {
            console.log("Video Event: Video ended. Meminta audio latar play.");
            if (typeof undangan !== 'undefined' && undangan.guest && undangan.guest.audio && undangan.guest.audio.setAutomaticPlay) {
                undangan.guest.audio.setAutomaticPlay();
            }
        });

        videoElement.addEventListener('volumechange', () => {
            if (videoElement.muted === false && videoElement.volume > 0) {
                console.log("Video Event: Video di-unmute. Meminta audio latar pause.");
                if (typeof undangan !== 'undefined' && undangan.guest && undangan.guest.audio && undangan.guest.audio.setAutomaticPause) {
                    undangan.guest.audio.setAutomaticPause();
                }
            } else if (videoElement.muted === true || videoElement.volume === 0) {
                console.log("Video Event: Video di-mute atau volume 0. Meminta audio latar play.");
                if (typeof undangan !== 'undefined' && undangan.guest && undangan.guest.audio && undangan.guest.audio.setAutomaticPlay) {
                    undangan.guest.audio.setAutomaticPlay();
                }
            }
        });

        // Tambahkan loading overlay spesifik video di sini
        if (!document.getElementById(videoLoadingOverlayId)) {
            wrap.insertAdjacentHTML('beforeend', `<div id="${videoLoadingOverlayId}" class="position-absolute d-flex flex-column justify-content-center align-items-center top-0 start-0 w-100 h-100 bg-overlay-auto rounded-4 z-2">
                <div class="progress w-25" role="progressbar" style="height: 0.5rem;" aria-label="progress bar">
                    <div class="progress-bar" id="progress-bar-${videoLoadingOverlayId}" style="width: 0%"></div>
                </div>
                <small class="mt-1 text-theme-auto bg-theme-auto py-0 px-2 rounded-4" id="progress-info-${videoLoadingOverlayId}" style="font-size: 0.7rem;"></small>
            </div>`);
        }


        /**
         * @param {Response} res 
         * @returns {Promise<Response>}
         */
        const resToVideo = (res) => {
            // Pastikan listener loadedmetadata hanya terdaftar sekali
            const loadedMetadataPromise = new Promise(resolve => {
                videoElement.addEventListener('loadedmetadata', () => {
                    videoElement.style.removeProperty('height');
                    console.log("Video Load: loadedmetadata terpicu.");
                    // PENTING: Panggil observer di sini setelah metadata dimuat
                    observer.observe(videoElement);
                    resolve();
                }, { once: true });
            });

            return res.clone().blob().then((b) => {
                if (videoElement.src !== URL.createObjectURL(b)) {
                    videoElement.src = URL.createObjectURL(b);
                }
                return loadedMetadataPromise.then(() => res); // Pastikan promise ini menunggu loadedmetadata
            });
        };

        /**
         * @returns {Promise<Response|void>}
         */
        const fetchBasic = () => {
            const progressBarId = `progress-bar-${videoLoadingOverlayId}`;
            const progressInfoId = `progress-info-${videoLoadingOverlayId}`;

            return request(HTTP_GET, src)
                .withCancel(new Promise((re) => videoElement.addEventListener('undangan.video.prefetch', re, { once: true })))
                .default({ 'Range': 'bytes=0-1' }) // Cek ketersediaan
                .then((res) => {
                    videoElement.dispatchEvent(new Event('undangan.video.prefetch'));

                    if (res.status === HTTP_STATUS_OK) {
                        videoElement.preload = 'metadata';
                        videoElement.src = util.escapeHtml(src);
                        console.log("Video Load: HTTP_STATUS_OK, video seharusnya tampil.");
                        // Untuk jalur ini, kita juga perlu menunggu loadedmetadata sebelum observer
                        return new Promise(resolve => {
                            videoElement.addEventListener('loadedmetadata', () => {
                                const height = videoElement.getBoundingClientRect().width * (videoElement.videoHeight / videoElement.videoWidth);
                                videoElement.style.height = `${height}px`;
                                observer.observe(videoElement); // Panggil observer di sini
                                resolve();
                            }, { once: true });
                        });
                    }

                    if (res.status !== HTTP_STATUS_PARTIAL_CONTENT) {
                        throw new Error('failed to fetch video (not 200 or 206)');
                    }
                    
                    videoElement.addEventListener('error', () => progress.invalid('video'), { once: true });
                    
                    // Untuk jalur partial content, kita juga perlu menunggu loadedmetadata sebelum observer
                    return new Promise(resolve => {
                        videoElement.addEventListener('loadedmetadata', () => {
                            const height = videoElement.getBoundingClientRect().width * (videoElement.videoHeight / videoElement.videoWidth);
                            videoElement.style.height = `${height}px`;
                            observer.observe(videoElement); // Panggil observer di sini
                            resolve();
                        }, { once: true });
                        videoElement.src = util.escapeHtml(src); // Set src untuk memicu loadedmetadata
                    });
                })
                .then(() => {
                    // Lanjutkan proses download penuh atau streaming
                    return request(HTTP_GET, videoElement.src)
                        .withProgressFunc((a, b) => {
                            const result = Number((a / b) * 100).toFixed(0) + '%';
                            document.getElementById(progressBarId).style.width = result;
                            document.getElementById(progressInfoId).innerText = result;
                        })
                        .withRetry()
                        .default()
                        .then(resToVideo)
                        .catch((err) => {
                            document.getElementById(progressBarId).style.backgroundColor = 'red';
                            document.getElementById(progressInfoId).innerText = `Error loading video`;
                            console.error("Video Load: Error selama fetching progres:", err);
                            progress.invalid('video');
                        });
                });
        };

        let loadPromise;
        if (!window.isSecureContext) {
            console.log("Video Load: Konteks tidak aman, langsung fetchBasic.");
            loadPromise = fetchBasic();
        } else {
            console.log("Video Load: Konteks aman, mencoba cache.has(src).");
            loadPromise = c.has(src).then((res) => {
                if (!res) {
                    console.log("Video Load: Video tidak di cache, mencoba fetchBasic dan set cache.");
                    return c.del(src).then(fetchBasic).then((r) => c.set(src, r));
                }

                console.log("Video Load: Video ditemukan di cache.");
                return resToVideo(res); // Pastikan ini mengembalikan promise yang menunggu loadedmetadata
            });
        }

        // Blok finally ini akan dieksekusi setelah seluruh promise loadPromise selesai
        return loadPromise.finally(() => {
            progress.complete('video'); // Selesaikan progres video di sini
            document.getElementById(videoLoadingOverlayId)?.remove(); // Hapus overlay loading video
            console.log("Video Load: Proses loading video selesai, overlay dihapus.");
        });
    };

    /**
     * @returns {object}
     */
    const init = () => {
        progress.add();
        c = cache('video').withForceCache();

        return {
            load,
        };
    };

    return {
        init,
    };
})();