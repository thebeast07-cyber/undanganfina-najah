// undangan\js\app\guest\guest.js

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
    let information = null;
    let config = null;
    let audioModule = null;
    let videoModule = null;

   const countDownDate = () => {
    const raw = document.body.getAttribute('data-time');

    let count = NaN;
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.seconds) {
            count = new Date(parsed.seconds * 1000).getTime();
        } else {
            count = new Date(raw).getTime();
        }
    } catch {
        count = new Date(raw).getTime();
    }

    const pad = (num) => num < 10 ? `0${num}` : `${num}`;
    const day = document.getElementById('day');
    const hour = document.getElementById('hour');
    const minute = document.getElementById('minute');
    const second = document.getElementById('second');

    const updateCountdown = () => {
        const distance = count - Date.now();

        if (distance < 0) {
            day.textContent = hour.textContent = minute.textContent = second.textContent = '00';
            return;
        }

        day.textContent = pad(Math.floor(distance / (1000 * 60 * 60 * 24)));
        hour.textContent = pad(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
        minute.textContent = pad(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)));
        second.textContent = pad(Math.floor((distance % (1000 * 60)) / 1000));

        util.timeOut(updateCountdown, 1000 - (Date.now() % 1000));
    };

    util.timeOut(updateCountdown);
};

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

            const template = `<small class="mt-0 mb-1 mx-0 p-0">${util.escapeHtml(guestName?.getAttribute('data-message'))}</small><p class="m-0 p-0" style="font-size: 1.25rem">${util.escapeHtml(name)}</p>`;
            util.safeInnerHTML(div, template);

            guestName?.appendChild(div);
        }

        const form = document.getElementById('form-name');
        if (form) {
            form.value = information.get('name') ?? name;
        }
    };

    const slide = async () => {
        const interval = 6000;
        const slides = document.querySelectorAll('.slide-desktop');

        if (!slides || slides.length === 0) return;

        const desktopEl = document.getElementById('root')?.querySelector('.d-sm-block');
        if (!desktopEl || window.getComputedStyle(desktopEl).display === 'none') return;

        desktopEl.dispatchEvent(new Event('undangan.slide.stop'));

        if (slides.length === 1) {
            util.changeOpacity(slides[0], true);
            return;
        }

        let index = 0;
        slides[index].classList.add('slide-desktop-active');
        await util.changeOpacity(slides[index], true);

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

        desktopEl.addEventListener('undangan.slide.stop', () => run = false);

        const loop = async () => {
            if (await nextSlide()) util.timeOut(loop, interval);
        };

        util.timeOut(loop, interval);
    };

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

    const modal = (img) => {
        document.getElementById('button-modal-click').setAttribute('href', img.src);
        document.getElementById('button-modal-download').setAttribute('data-src', img.src);
        const i = document.getElementById('show-modal-image');
        i.src = img.src;
        i.width = img.width;
        i.height = img.height;
        bs.modal('modal-image').show();
    };

    const modalImageClick = () => {
        document.getElementById('show-modal-image').addEventListener('click', (e) => {
            const abs = e.currentTarget.parentNode.querySelector('.position-absolute');
            abs.classList.toggle('d-none');
            abs.classList.toggle('d-flex');
        });
    };

    const showStory = (div) => {
        if (navigator.vibrate) navigator.vibrate(500);
        confetti.tapTapAnimation(div, 100);
        util.changeOpacity(div, false).then((e) => e.remove());
    };

    const closeInformation = () => information.set('info', true);

    const normalizeArabicFont = () => {
        document.querySelectorAll('.font-arabic').forEach((el) => {
            el.innerHTML = String(el.innerHTML).normalize('NFC');
        });
    };

    const animateSvg = () => {
        document.querySelectorAll('svg').forEach((el) => {
            if (el.hasAttribute('data-class')) {
                util.timeOut(() => el.classList.add(el.getAttribute('data-class')), parseInt(el.getAttribute('data-time')));
            }
        });
    };

    const buildGoogleCalendar = () => {
        const formatDate = (input) => {
            let dateObj;
            if (typeof input === 'object' && input?.seconds) {
                dateObj = new Date(input.seconds * 1000);
            } else if (typeof input === 'string') {
                try {
                    const parsed = JSON.parse(input);
                    if (parsed?.seconds) {
                        dateObj = new Date(parsed.seconds * 1000);
                    } else {
                        dateObj = new Date(input);
                    }
                } catch {
                    dateObj = new Date(input);
                }
            } else {
                dateObj = new Date(input);
            }

            if (isNaN(dateObj.getTime())) {
                console.error("buildGoogleCalendar: Tanggal dari Firestore tidak valid:", input);
                return '';
            }

            return dateObj.toISOString().split('T')[0].replace(/-/g, '');
        };

        const weddingTimeRaw = document.body.getAttribute('data-time');
        const formattedDate = formatDate(weddingTimeRaw);

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

    const loaderLibs = () => {
        progress.add('libs');
        const load = (opt) => {
            loader(opt)
                .then(() => progress.complete('libs'))
                .catch(() => progress.invalid('libs'));
        };
        return { load };
    };

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

    const domLoaded = () => {
        lang.init();
        offline.init();
        comment.init();
        progress.init();

        config = storage('config');
        information = storage('information');

        videoModule = video.init();
        const img = image.init();
        audioModule = audio.init();
        const lib = loaderLibs();

        window.addEventListener('resize', util.debounce(slide));
        document.addEventListener('undangan.progress.done', () => booting());
        document.addEventListener('hide.bs.modal', () => document.activeElement?.blur());
        document.getElementById('button-modal-download').addEventListener('click', (e) => {
            img.download(e.currentTarget.getAttribute('data-src'));
        });

        progress.add('config');

        const loadInvitationDataFromFirestore = async () => {
            try {
                const docRef = db.collection('invitations').doc('main_invite');
                const docSnap = await docRef.get();

                if (docSnap.exists) {
                    const data = docSnap.data();
                    console.log("Data Undangan dari Firestore:", data);

                    document.body.setAttribute('data-audio', data.audioUrl || '');
                    document.body.setAttribute('data-confetti', data.confettiEnabled ? 'true' : 'false');
                    document.body.setAttribute('data-time', data.weddingDate.toDate().toISOString());


                    const guestNameEl = document.getElementById('guest-name');
                    if (guestNameEl) {
                        guestNameEl.setAttribute('data-message', data.guestMessage || 'Kepada Yth Bapak/Ibu/Saudara/i');
                    }

                    if (data.tenorKey) config.set('tenor_key', data.tenorKey);
                    else config.unset('tenor_key');

                    document.dispatchEvent(new Event('undangan.session'));
                    progress.complete('config');

                    try {
                        await img.load();
                        progress.complete('image_group');
                    } catch (err) {
                        console.error("Error loading images:", err);
                        progress.invalid('image_group');
                    }

                    videoModule.load();
                    audioModule.load();
                    lib.load({ confetti: data.confettiEnabled });
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

    const init = () => {
        theme.init();
        document.addEventListener('DOMContentLoaded', domLoaded);
        return {
            util,
            theme,
            comment,
            audio: audioModule,
            video: videoModule,
            guest: {
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
