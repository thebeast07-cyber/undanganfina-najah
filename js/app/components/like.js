// undangan\js\app\components\like.js

// Hapus atau komentari impor yang tidak lagi dibutuhkan dari sistem lama
// import { dto } from '../../connection/dto.js'; // DTO masih dipakai untuk memformat data yang diambil dari Firestore, tetapi tidak lagi untuk request/response spesifik like
// import { session } from '../../common/session.js'; // Tidak dipakai lagi, akan diganti oleh Firebase Auth
// import { request, HTTP_PATCH, HTTP_POST, HTTP_STATUS_CREATED } from '../../connection/request.js'; // Tidak dipakai lagi, diganti Firestore SDK

// Impor yang masih relevan:
import { storage } from '../../common/storage.js';
import { tapTapAnimation } from '../../libs/confetti.js'; // Untuk animasi confetti saat tap-tap
import { util } from '../../common/util.js'; // Untuk utilitas umum (disable button, notify, dll.)

export const like = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let likes = null; // Menyimpan UUID komentar yang sudah di-like oleh user di local storage

    /**
     * @type {Map<string, AbortController>|null}
     */
    let listeners = null; // Untuk mengelola event listener tap-tap

    // Referensi Koleksi Firestore (akan diinisialisasi di init())
    let commentsCollectionRef; // Untuk mengakses koleksi 'comments' di Firestore
    // usersLikedCommentsRef; // Opsional, jika Anda punya koleksi terpisah untuk menyimpan daftar user yang melakukan like

    /**
     * Fungsi inti untuk memberikan atau membatalkan like pada komentar.
     * Menggunakan Transaksi Firestore untuk integritas data.
     * @param {HTMLButtonElement} button - Tombol like yang diklik.
     * @returns {Promise<void>}
     */
    const love = async (button) => {

        const info = button.firstElementChild;
        const heart = button.lastElementChild;

        const commentId = button.getAttribute('data-uuid');
        let currentLikesCount = parseInt(info.getAttribute('data-count-like'));

        button.disabled = true;

        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        // Untuk pengguna tamu, kita perlu ID unik untuk melacak like mereka.
        // Ini adalah UUID yang digenerate di sisi klien dan disimpan di local storage.
        // Di aplikasi nyata dengan Firebase Auth, ini akan diganti dengan firebase.auth().currentUser.uid
        let userId = storage('guest_uuid').get('id');
        if (!userId) {
            userId = util.generateUUID();
            storage('guest_uuid').set('id', userId);
        }

        // Mulai transaksi Firestore
        try {
            await db.runTransaction(async (transaction) => {
                const commentRef = commentsCollectionRef.doc(commentId);
                const commentDoc = await transaction.get(commentRef);

                if (!commentDoc.exists) {
                    throw new Error("Comment does not exist!");
                }

                const data = commentDoc.data();
                let newLikesCount = data.like || 0; // Ambil jumlah like dari Firestore (default 0)

                const userLikedRef = commentRef.collection('likedBy').doc(userId);
                const userLikedDoc = await transaction.get(userLikedRef);

                if (userLikedDoc.exists) {
                    // Unlike
                    transaction.delete(userLikedRef);
                    newLikesCount = Math.max(0, newLikesCount - 1);
                    likes.unset(commentId);
                    heart.classList.remove('fa-solid', 'text-danger');
                    heart.classList.add('fa-regular');
                } else {
                    // Like
                    transaction.set(userLikedRef, { userId: userId, likedAt: firebase.firestore.FieldValue.serverTimestamp() });
                    newLikesCount++;
                    likes.set(commentId, userId);
                    heart.classList.remove('fa-regular');
                    heart.classList.add('fa-solid', 'text-danger');
                    tapTapAnimation(document.getElementById(`body-content-${commentId}`));
                }

                // Perbarui jumlah like di dokumen komentar utama
                transaction.update(commentRef, { like: newLikesCount });
                currentLikesCount = newLikesCount; // Perbarui variabel lokal untuk UI
            });

            // Setelah transaksi berhasil, perbarui tampilan jumlah like
            info.setAttribute('data-count-like', String(currentLikesCount));

        } catch (error) {
            console.error("Transaction failed: ", error);
            util.notify('Failed to process like. Please try again.').error();
        } finally {
            info.innerText = info.getAttribute('data-count-like');
            button.disabled = false;
        }
    };

    /**
     * @param {string} uuid
     * @returns {HTMLElement|null}
     */
    const getButtonLike = (uuid) => {
        return document.querySelector(`button[onclick="undangan.comment.like.love(this)"][data-uuid="${uuid}"]`);
    };

    /**
     * @param {HTMLElement} div
     * @returns {Promise<void>}
     */
    const tapTap = async (div) => {
        if (!navigator.onLine) {
            util.notify('You are offline.').warning();
            return;
        }

        const currentTime = Date.now();
        const tapLength = currentTime - parseInt(div.getAttribute('data-tapTime') || '0');

        const commentId = div.id.replace('body-content-', '');

        const isDoubleTap = tapLength < 300 && tapLength > 0;
        const notLikedYet = !likes.has(commentId) && div.getAttribute('data-liked') !== 'true';

        if (isDoubleTap && notLikedYet) {
            await love(getButtonLike(commentId));
            div.setAttribute('data-liked', 'false'); // Set kembali ke false setelah proses
        }

        div.setAttribute('data-tapTime', String(currentTime));
    };

    /**
     * @param {string} uuid
     * @returns {void}
     */
    const addListener = (uuid) => {
        const ac = new AbortController();

        const bodyLike = document.getElementById(`body-content-${uuid}`);
        if (bodyLike) {
            bodyLike.addEventListener('touchend', () => tapTap(bodyLike), { signal: ac.signal });
            listeners.set(uuid, ac);
        }
    };

    /**
     * @param {string} uuid
     * @returns {void}
     */
    const removeListener = (uuid) => {
        const ac = listeners.get(uuid);
        if (ac) {
            ac.abort();
            listeners.delete(uuid);
        }
    };

    /**
     * @returns {void}
     */
    const init = () => {
        listeners = new Map();
        likes = storage('likes');
        if (typeof db !== 'undefined') {
            commentsCollectionRef = db.collection('comments');
        } else {
            console.error("Firestore 'db' object is not defined in like.js. Ensure Firebase is initialized in index.html.");
        }
    };

    return {
        init,
        love,
        getButtonLike,
        addListener,
        removeListener,
    };
})();