import { util } from '../../common/util.js';
import { bs } from '../../libs/bootstrap.js';
import { storage } from '../../common/storage.js'; // <--- TAMBAHKAN BARIS INI
// import { dto } from '../../connection/dto.js'; // DTO tidak lagi dibutuhkan untuk login
// import { request, HTTP_GET, HTTP_STATUS_OK, removeCache } from '../../connection/request.js'; // Request tidak lagi dibutuhkan untuk login

export const auth = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let user = null; // Ini akan menyimpan data user dari Firebase Auth

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const login = (button) => {
        const btn = util.disableButton(button);

        const formEmail = document.getElementById('loginEmail');
        const formPassword = document.getElementById('loginPassword');

        formEmail.disabled = true;
        formPassword.disabled = true;

        const email = formEmail.value;
        const password = formPassword.value;

        // Menggunakan Firebase Authentication
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Berhasil login
                const user = userCredential.user;
                console.log("Admin Auth: Login berhasil!", user);
                util.notify('Login berhasil!').success();

                // Simpan token atau informasi user jika diperlukan oleh session.js
                // session.js akan perlu diadaptasi untuk menggunakan token Firebase Auth
                // Untuk sementara, kita hanya menutup modal dan memuat data user
                formEmail.value = ''; // Bersihkan field
                formPassword.value = ''; // Bersihkan field
                bs.modal('mainModal').hide();
                // Admin.js akan memanggil getUserStats setelah modal tertutup
            })
            .catch((error) => {
                // Gagal login
                const errorCode = error.code;
                const errorMessage = error.message;
                console.error("Admin Auth: Login gagal!", errorCode, errorMessage);
                util.notify(`Login gagal: ${errorMessage}`).error();
            })
            .finally(() => {
                btn.restore();
                formEmail.disabled = false;
                formPassword.disabled = false;
            });
    };

    /**
     * @returns {Promise<void>}
     */
    const clearSession = async () => {
        // Logout dari Firebase Authentication
        await firebase.auth().signOut().then(() => {
            console.log("Admin Auth: Logout berhasil.");
            // Membersihkan data lokal yang terkait admin
            user?.clear(); // membersihkan user storage
            // session.logout(); // session.js akan perlu diadaptasi, tidak lagi unset token manual
            util.notify('Logout berhasil.').info();
            bs.modal('mainModal').show(); // Kembali ke modal login
        }).catch((error) => {
            console.error("Admin Auth: Error saat logout:", error);
            util.notify(`Logout gagal: ${error.message}`).error();
        });
    };

    /**
     * Mendapatkan detail user yang sedang login dari Firebase Auth
     * dan juga dapatkan data pengaturan admin dari Firestore (jika ada)
     * @returns {Promise<object>}
     */
    const getDetailUser = async () => {
        const currentUser = firebase.auth().currentUser; // Dapatkan user Firebase yang sedang login

        if (!currentUser) {
            console.warn("Admin Auth: Tidak ada user yang sedang login.");
            throw new Error('No user logged in.');
        }

        console.log("Admin Auth: User sedang login:", currentUser.uid, currentUser.email);

        // Dapatkan ID token untuk otorisasi ke Firestore Rules jika perlu custom claims
        const idTokenResult = await currentUser.getIdTokenResult(true); // true = force refresh token
        const isAdminFromClaim = idTokenResult.claims.admin === true; // Cek custom claim 'admin'
        console.log("Admin Auth: isAdmin (from claim):", isAdminFromClaim);

        if (!isAdminFromClaim) {
            console.warn("Admin Auth: User bukan admin. Logout.");
            await clearSession(); // Logout jika bukan admin
            throw new Error('Not authorized as admin.');
        }

        // Dapatkan data admin dari Firestore
        try {
            // Asumsi data admin disimpan di koleksi 'adminSettings' dengan ID dokumen yang sama dengan UID admin
            const adminDocRef = db.collection('adminSettings').doc(currentUser.uid);
            const adminDocSnap = await adminDocRef.get();

            if (adminDocSnap.exists) {
                const data = adminDocSnap.data();
                console.log("Admin Auth: Data admin dari Firestore:", data);

                // Simpan data ini ke local storage 'user' jika admin.js membutuhkannya
                Object.entries(data).forEach(([k, v]) => user.set(k, v));
                user.set('uid', currentUser.uid); // Simpan UID juga
                user.set('email', currentUser.email); // Simpan email juga
                user.set('name', data.name || currentUser.email); // Gunakan nama dari Firestore atau email

                return { code: 200, data: user.get(), error: null }; // Kembalikan data admin
            } else {
                // Jika dokumen setting admin tidak ada (misal admin baru)
                console.warn("Admin Auth: Dokumen setting admin tidak ditemukan di Firestore untuk UID ini.");
                // Mungkin buat dokumen default atau minta admin untuk melengkapi profil
                // Untuk sekarang, kita anggap ini sebagai error
                throw new Error('Admin settings not found. Please setup admin profile.');
            }
        } catch (error) {
            console.error("Admin Auth: Error fetching admin settings from Firestore:", error);
            throw error; // Lempar error lagi agar ditangkap oleh pemanggil
        }
    };

    /**
     * @returns {ReturnType<typeof storage>|null}
     */
    const getUserStorage = () => user;

    /**
     * @returns {void}
     */
    const init = () => {
        user = storage('user'); // Inisialisasi storage 'user'
    };

    return {
        init,
        login,
        clearSession,
        getDetailUser,
        getUserStorage,
    };
})();