// undangan\js\app\admin\admin.js
import { auth } from './auth.js';
import { navbar } from './navbar.js';
import { util } from '../../common/util.js';
import { dto } from '../../connection/dto.js'; // Assuming this import path is correct
import { theme } from '../../common/theme.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { offline } from '../../common/offline.js';

export const admin = (() => {

    // Referensi Firestore untuk koleksi komentar dan pengaturan admin
    let commentsCollectionRef;
    let adminSettingsDocRef = db.collection('adminSettings').doc('main_app_settings'); // <--- PASTIKAN ID DOKUMEN INI KONSISTEN

    // Variabel untuk pagination komentar admin
    let lastVisibleCommentAdmin = null;
    let firstVisibleCommentAdmin = null;
    const commentsPerPageAdmin = 10; // Jumlah komentar per halaman di admin

    // Container dan tombol
    let adminCommentsListEl;
    let loadMoreAdminButtonEl;
    let loadMoreAdminSpinnerEl;

    // --- DEFINISI FUNGSI LOGOUT DIPINDAH LEBIH AWAL ---
    /**
     * Logout admin.
     * @returns {void}
     */
    const logout = () => {
        if (!util.ask('Apakah Anda yakin ingin logout?')) {
            return;
        }
        auth.clearSession(); // auth.js sekarang yang menangani logout dari Firebase Auth
    };
    // --- AKHIR DEFINISI LOGOUT YANG DIPINDAH ---


    // ----------- Fungsi baru untuk merender komentar di admin dashboard -----------
    /**
     * Merender satu objek komentar ke dalam DOM untuk admin dashboard.
     /**
     * Merender satu objek komentar ke dalam DOM untuk admin dashboard.
     * @param {object} c - Objek komentar dari Firestore (setelah di-DTO).
     * @returns {string} HTML string dari kartu komentar.
     */
    const renderAdminCommentCard = (c) => {
        // *** CHANGE START HERE ***
        // c.created_at is already a formatted string from dto.js
        const timestamp = c.created_at || ''; // Directly use the formatted string
        // *** CHANGE END HERE ***

        const presenceIcon = c.presence === '1' ? '<i class="fa-solid fa-circle-check text-success ms-1"></i> Datang' :
                             c.presence === '2' ? '<i class="fa-solid fa-circle-xmark text-danger ms-1"></i> Berhalangan' : '';
        const gifHtml = c.gif_url ? `<img src="${util.escapeHtml(c.gif_url)}" alt="GIF" class="img-fluid rounded-3 mb-2" loading="lazy">` : '';

        // Teks komentar yang sudah bersih dari HTML dan diformat
        const commentContent = util.nl2br(util.escapeHtml(c.comment || '')); // Pastikan c.comment membaca commentText dari DTO
        const formattedComment = util.formatText(commentContent);

        return `
            <div class="bg-theme-auto rounded-4 shadow-sm p-3 mb-3" data-uuid="${util.escapeHtml(c.uuid)}">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <p class="fw-bold m-0 p-0 text-truncate" style="font-size: 0.95rem;">
                        ${util.escapeHtml(c.name || 'Anonim')} ${presenceIcon}
                    </p>
                    <small class="text-secondary">${timestamp}</small>
                </div>
                ${gifHtml}
                <p class="m-0 p-0" style="font-size: 0.9rem;">${formattedComment}</p>
                <div class="d-flex justify-content-end align-items-center mt-2">
                    <button style="font-size: 0.8rem;" onclick="undangan.admin.deleteComment('${util.escapeHtml(c.uuid)}')"
                            data-uuid="${util.escapeHtml(c.uuid)}" class="btn btn-sm btn-danger rounded-4 py-0 me-1 shadow-sm">
                        Delete
                    </button>
                    </div>
            </div>
        `;
    };

    /**
     * Memuat dan menampilkan komentar untuk admin dashboard.
     * @param {boolean} [reset=false] - Jika true, reset pagination dan muat dari awal.
     * @returns {Promise<void>}
     */
    const loadAdminComments = async (reset = false) => {
        if (adminCommentsListEl.dataset.loading === 'true') {
            console.log("Admin: Sedang memuat komentar, abaikan permintaan.");
            return;
        }

        adminCommentsListEl.dataset.loading = 'true';
        loadMoreAdminButtonEl.disabled = true;
        loadMoreAdminSpinnerEl.classList.remove('d-none');

        try {
            if (reset) {
                adminCommentsListEl.replaceChildren(); // Bersihkan daftar komentar
                lastVisibleCommentAdmin = null;
                firstVisibleCommentAdmin = null;
                console.log("Admin: Mereset daftar komentar.");
            }

            let query = commentsCollectionRef.orderBy('created_at', 'desc').limit(commentsPerPageAdmin);

            if (lastVisibleCommentAdmin) {
                query = query.startAfter(lastVisibleCommentAdmin);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                loadMoreAdminButtonEl.classList.add('d-none');
                if (reset) { // Hanya tampilkan pesan jika tidak ada komentar sama sekali saat reset
                    adminCommentsListEl.innerHTML = '<p class="text-center text-secondary">Belum ada komentar.</p>';
                }
                console.log("Admin: Tidak ada komentar lagi untuk dimuat.");
                return;
            }

            let newCommentsHtml = '';
            snapshot.docs.forEach(doc => {
                const commentData = doc.data();
                const processedComment = dto.getCommentResponse({ ...commentData, uuid: doc.id });
                newCommentsHtml += renderAdminCommentCard(processedComment);
            });

            adminCommentsListEl.insertAdjacentHTML('beforeend', newCommentsHtml);

            lastVisibleCommentAdmin = snapshot.docs[snapshot.docs.length - 1];
            firstVisibleCommentAdmin = snapshot.docs[0];

            loadMoreAdminButtonEl.classList.remove('d-none');
            if (snapshot.docs.length < commentsPerPageAdmin) {
                loadMoreAdminButtonEl.classList.add('d-none');
            }
            console.log(`Admin: Berhasil memuat ${snapshot.docs.length} komentar.`);

        } catch (error) {
            console.error("Admin: Gagal memuat komentar:", error);
            util.notify(`Gagal memuat komentar admin: ${error.message}`).error();
            loadMoreAdminButtonEl.classList.remove('d-none');
        } finally {
            adminCommentsListEl.dataset.loading = 'false';
            loadMoreAdminButtonEl.disabled = false;
            loadMoreAdminSpinnerEl.classList.add('d-none');
        }
    };
    // ----------- Akhir fungsi baru untuk merender komentar di admin dashboard -----------


    /**
     * Mengambil dan menampilkan statistik serta pengaturan admin.
     * @returns {Promise<void>}
     */
    const getUserStats = async () => {
        try {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) {
                console.warn("Admin: Tidak ada user yang sedang login saat getUserStats dipanggil.");
                auth.clearSession();
                return;
            }

            const userDetail = await auth.getDetailUser();
            if (userDetail.code !== 200) {
                throw new Error(userDetail.error || 'Failed to get user details.');
            }
            const userData = userDetail.data;

            util.safeInnerHTML(document.getElementById('dashboard-name'), `${util.escapeHtml(userData.name || currentUser.email)}<i class="fa-solid fa-hands text-warning ms-2"></i>`);
            document.getElementById('dashboard-email').textContent = userData.email;
            document.getElementById('dashboard-accesskey').value = userData.access_key || 'Generate New Key';
            document.getElementById('button-copy-accesskey').setAttribute('data-copy', userData.access_key || '');

            document.getElementById('form-name').value = util.escapeHtml(userData.name || '');
            document.getElementById('form-timezone').value = userData.tz || 'Asia/Jakarta';
            document.getElementById('filterBadWord').checked = Boolean(userData.is_filter);
            document.getElementById('confettiAnimation').checked = Boolean(userData.is_confetti_animation);
            document.getElementById('replyComment').checked = Boolean(userData.can_reply);
            document.getElementById('editComment').checked = Boolean(userData.can_edit);
            document.getElementById('deleteComment').checked = Boolean(userData.can_delete);
            document.getElementById('dashboard-tenorkey').value = userData.tenor_key || '';

            storage('config').set('tenor_key', userData.tenor_key || '');
            storage('config').set('is_filter', userData.is_filter || false);
            storage('config').set('is_confetti_animation', userData.is_confetti_animation || false);
            storage('config').set('can_reply', userData.can_reply || false);
            storage('config').set('can_edit', userData.can_edit || false);
            storage('config').set('can_delete', userData.can_delete || false);

            document.dispatchEvent(new Event('undangan.session'));

            const commentsSnapshot = await commentsCollectionRef.get();
            let totalComments = 0;
            let totalLikes = 0;
            let totalPresent = 0;
            let totalAbsent = 0;

            commentsSnapshot.forEach(doc => {
                const data = doc.data();
                totalComments++;
                totalLikes += (data.like || 0);
                if (data.presence === '1') {
                    totalPresent++;
                } else if (data.presence === '2') {
                    totalAbsent++;
                }
            });

            document.getElementById('count-comment').textContent = String(totalComments).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-like').textContent = String(totalLikes).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-present').textContent = String(totalPresent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-absent').textContent = String(totalAbsent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

            loadAdminComments(true);

        } catch (error) {
            console.error("Admin: Error di getUserStats:", error);
            util.notify(`Error memuat data dashboard: ${error.message}`).error();
            auth.clearSession();
        }
    };

    /**
     * Memperbarui nilai checkbox di Firestore.
     * @param {HTMLInputElement} checkbox
     * @param {string} type - Nama field di Firestore (misal: 'is_filter')
     * @returns {void}
     */
    const changeCheckboxValue = (checkbox, type) => {
        const label = util.disableCheckbox(checkbox);
        const updateData = { [type]: checkbox.checked };

        adminSettingsDocRef.set(updateData, { merge: true }) // UBAH INI
            .then(() => {
                util.notify(`Pengaturan ${type} berhasil diubah.`).success();
                storage('config').set(type, checkbox.checked);
            })
            .catch((error) => {
                console.error(`Admin: Gagal mengubah ${type}:`, error);
                util.notify(`Gagal mengubah pengaturan: ${error.message}`).error();
                checkbox.checked = !checkbox.checked;
            })
            .finally(() => label.restore());
    };

    /**
     * Memperbarui Tenor API Key di Firestore.
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const tenor = (button) => {
        const btn = util.disableButton(button);
        const form = document.getElementById('dashboard-tenorkey');
        form.disabled = true;

        const tenorKey = form.value.length ? form.value : null;
        const updateData = { tenor_key: tenorKey };

        adminSettingsDocRef.set(updateData, { merge: true }) // UBAH INI
            .then(() => {
                util.notify(`Berhasil ${tenorKey ? 'menambah' : 'menghapus'} Tenor Key`).success();
                storage('config').set('tenor_key', tenorKey);
                document.dispatchEvent(new Event('undangan.session'));
            })
            .catch((error) => {
                console.error("Admin: Gagal mengubah Tenor Key:", error);
                util.notify(`Gagal mengubah Tenor Key: ${error.message}`).error();
            })
            .finally(() => {
                form.disabled = false;
                btn.restore();
            });
    };

    /**
     * Menggenerate Access Key baru dan menyimpannya di Firestore.
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const regenerate = (button) => {
        if (!util.ask('Apakah Anda yakin ingin meregenerasi Access Key? Key lama akan tidak berlaku.')) {
            return;
        }

        const btn = util.disableButton(button);
        const newAccessKey = util.generateUUID();
        const updateData = { access_key: newAccessKey };

       adminSettingsDocRef.set(updateData, { merge: true }) // UBAH INI
            .then(() => {
                document.getElementById('dashboard-accesskey').value = newAccessKey;
                document.getElementById('button-copy-accesskey').setAttribute('data-copy', newAccessKey);
                util.notify('Access Key baru berhasil digenerasi!').success();
            })
            .catch((error) => {
                console.error("Admin: Gagal meregenerasi Access Key:", error);
                util.notify(`Gagal meregenerasi Access Key: ${error.message}`).error();
            })
            .finally(() => btn.restore());
    };

    /**
     * Mengubah password admin melalui Firebase Authentication.
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const changePassword = async (button) => {
        const oldPasswordInput = document.getElementById('old_password');
        const newPasswordInput = document.getElementById('new_password');

        if (oldPasswordInput.value.length === 0 || newPasswordInput.value.length === 0) {
            util.notify('Password tidak boleh kosong.').warning();
            return;
        }

        oldPasswordInput.disabled = true;
        newPasswordInput.disabled = true;

        const btn = util.disableButton(button);

        try {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) {
                throw new Error('Tidak ada user yang sedang login.');
            }

            const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, oldPasswordInput.value);
            await currentUser.reauthenticateWithCredential(credential);

            await currentUser.updatePassword(newPasswordInput.value);

            oldPasswordInput.value = '';
            newPasswordInput.value = '';
            util.notify('Password berhasil diubah!').success();

        } catch (error) {
            console.error("Admin: Gagal mengubah password:", error);
            let errorMessage = "Gagal mengubah password.";
            if (error.code === 'auth/wrong-password') {
                errorMessage = 'Password lama salah.';
            } else if (error.code === 'auth/requires-recent-login') {
                errorMessage = 'Sesi Anda sudah terlalu lama, harap logout dan login kembali untuk mengubah password.';
            }
            util.notify(`${errorMessage} ${error.message}`).error();
        } finally {
            btn.restore(true);
            oldPasswordInput.disabled = false;
            newPasswordInput.disabled = false;
        }
    };

    /**
     * Mengubah nama admin di Firebase Auth profile dan Firestore.
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeName = (button) => {
        const nameInput = document.getElementById('form-name');

        if (nameInput.value.length === 0) {
            util.notify('Nama tidak boleh kosong.').warning();
            return;
        }

        nameInput.disabled = true;
        const btn = util.disableButton(button);

        const newName = nameInput.value;
        const currentUser = firebase.auth().currentUser;

        if (!currentUser) {
            util.notify('Tidak ada user yang sedang login.').error();
            btn.restore();
            nameInput.disabled = false;
            return;
        }

        Promise.all([
            currentUser.updateProfile({ displayName: newName }),
             adminSettingsDocRef.set({ name: newName }, { merge: true }) 
        ])
        .then(() => {
            util.safeInnerHTML(document.getElementById('dashboard-name'), `${util.escapeHtml(newName)}<i class="fa-solid fa-hands text-warning ms-2"></i>`);
            util.notify('Nama berhasil diubah!').success();
            const userStorage = auth.getUserStorage();
            if (userStorage) userStorage.set('name', newName);
        })
        .catch((error) => {
            console.error("Admin: Gagal mengubah nama:", error);
            util.notify(`Gagal mengubah nama: ${error.message}`).error();
        })
        .finally(() => {
            nameInput.disabled = false;
            btn.restore(true);
        });
    };

    /**
     * Mengunduh semua data komentar dari Firestore sebagai CSV.
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const download = async (button) => {
        const btn = util.disableButton(button);
        try {
            const snapshot = await commentsCollectionRef.orderBy('created_at', 'asc').get();
            if (snapshot.empty) {
                util.notify('Tidak ada komentar untuk diunduh.').info();
                return;
            }

            let csvContent = "Nama,Presensi,Komentar,GIF URL,IP,User Agent,Waktu,Like\n"; // Header CSV
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = `"${(data.name || '').replace(/"/g, '""')}"`;
                const presence = data.presence === '1' ? 'Datang' : (data.presence === '2' ? 'Berhalangan' : 'Tidak Diketahui');
                const commentText = `"${(data.commentText || '').replace(/"/g, '""')}"`;
                const gifUrl = data.gif || '';
                const ip = data.ip || '';
                const userAgent = data.user_agent || '';
                const createdAt = data.created_at?.toDate().toLocaleString('id-ID') || '';
                const likeCount = data.like || 0;

                csvContent += `${name},${presence},${commentText},${gifUrl},${ip},${userAgent},${createdAt},${likeCount}\n`;
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "comments.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                util.notify('Data komentar berhasil diunduh.').success();
            } else {
                util.notify('Browser Anda tidak mendukung pengunduhan file.').error();
            }

        } catch (error) {
            console.error("Admin: Gagal mengunduh komentar:", error);
            util.notify(`Gagal mengunduh komentar: ${error.message}`).error();
        } finally {
            btn.restore();
        }
    };

    /**
     * Memperbarui `dashboard.html` untuk memunculkan tombol `button-change-name`
     * @returns {void}
     */
    const enableButtonName = () => {
        const btn = document.getElementById('button-change-name');
        const nameInput = document.getElementById('form-name');
        if (btn) {
            btn.disabled = nameInput.value.length === 0;
        }
    };

    /**
     * Memperbarui `dashboard.html` untuk memunculkan tombol `button-change-password`
     * @returns {void}
     */
    const enableButtonPassword = () => {
        const btn = document.getElementById('button-change-password');
        const oldPasswordInput = document.getElementById('old_password');
        if (btn) {
            btn.disabled = oldPasswordInput.value.length === 0;
        }
    };

    /**
     * Membuka dan memfilter daftar Time Zone.
     * @param {HTMLFormElement} form
     * @param {string|null} [query=null]
     * @returns {void}
     */
    const openLists = (form, query = null) => {
        let timezones = Intl.supportedValuesOf('timeZone');
        const dropdown = document.getElementById('dropdown-tz-list');

        if (form.value && form.value.trim().length > 0) {
            timezones = timezones.filter((tz) => tz.toLowerCase().includes(form.value.trim().toLowerCase()));
        }

        if (query === null) {
            document.addEventListener('click', (e) => {
                if (!form.contains(e.target) && !dropdown.contains(e.target)) {
                    if (form.value.trim().length <= 0) {
                        form.setCustomValidity('Timezone cannot be empty.');
                        form.reportValidity();
                        return;
                    }
                    form.setCustomValidity('');
                    dropdown.classList.add('d-none');
                }
            }, { once: true, capture: true });
        }

        dropdown.replaceChildren();
        dropdown.classList.remove('d-none');

        timezones.slice(0, 20).forEach((tz) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action py-1 small';
            item.textContent = `${tz} (${util.getGMTOffset(tz)})`;
            item.onclick = () => {
                form.value = tz;
                dropdown.classList.add('d-none');
                document.getElementById('button-timezone').disabled = false;
            };
            dropdown.appendChild(item);
        });
    };

    /**
     * Mengubah Time Zone admin di Firestore.
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeTz = (button) => {
        const tzInput = document.getElementById('form-timezone');

        if (tzInput.value.length === 0) {
            util.notify('Zona waktu tidak boleh kosong.').warning();
            return;
        }

        if (!Intl.supportedValuesOf('timeZone').includes(tzInput.value)) {
            util.notify('Zona waktu tidak didukung.').warning();
            return;
        }

        tzInput.disabled = true;
        const btn = util.disableButton(button);

        const newTz = tzInput.value;
        const updateData = { tz: newTz };

        adminSettingsDocRef.update(updateData)
            .then(() => {
                util.notify('Zona waktu berhasil diubah!').success();
            })
            .catch((error) => {
                console.error("Admin: Gagal mengubah zona waktu:", error);
                util.notify(`Gagal mengubah zona waktu: ${error.message}`).error();
            })
            .finally(() => {
                tzInput.disabled = false;
                btn.restore(true);
            });
    };

    /**
     * Menghapus komentar dari Firestore (hanya untuk admin).
     * @param {string} commentIdToDelete - ID dokumen komentar yang akan dihapus.
     * @returns {Promise<void>}
     */
    const deleteComment = async (commentIdToDelete) => {
        if (!util.ask('Apakah Anda yakin ingin menghapus komentar ini dan semua balasannya?')) {
            return;
        }

        const deleteButton = document.querySelector(`button[onclick*="deleteComment('${commentIdToDelete}')"]`);
        const originalButtonHtml = deleteButton ? deleteButton.innerHTML : '';
        if (deleteButton) {
            deleteButton.disabled = true;
            deleteButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hapus...';
        }

        try {
            const getRepliesToDelete = async (parentId) => {
                const repliesSnapshot = await commentsCollectionRef.where('parentId', '==', parentId).get();
                let idsToDelete = [];
                for (const doc of repliesSnapshot.docs) {
                    idsToDelete.push(doc.id);
                    const nestedReplies = await getRepliesToDelete(doc.id);
                    idsToDelete = idsToDelete.concat(nestedReplies);
                }
                return idsToDelete;
            };

            const allIdsToDelete = [commentIdToDelete];
            const nestedIds = await getRepliesToDelete(commentIdToDelete);
            allIdsToDelete.push(...nestedIds);

            const batch = db.batch();
            allIdsToDelete.forEach(id => {
                const docRef = commentsCollectionRef.doc(id);
                batch.delete(docRef);
            });
            await batch.commit();

            util.notify('Komentar dan semua balasannya berhasil dihapus!').success();

            allIdsToDelete.forEach(id => {
                const commentEl = document.querySelector(`#admin-comments-list [data-uuid="${id}"]`);
                if (commentEl) {
                    commentEl.remove();
                }
            });

            await getUserStats();

        } catch (error) {
            console.error("Admin: Gagal menghapus komentar:", error);
            util.notify(`Gagal menghapus komentar: ${error.message}`).error();
        } finally {
            if (deleteButton) {
                deleteButton.disabled = false;
                deleteButton.innerHTML = originalButtonHtml;
            }
        }
    };


    /**
     * Dipanggil saat DOM siap. Menangani logika inisialisasi awal dashboard.
     * @returns {void}
     */
    const domLoaded = () => {
        lang.init();
        lang.setDefault('en');

        offline.init();
        theme.spyTop();

        adminCommentsListEl = document.getElementById('admin-comments-list');
        loadMoreAdminButtonEl = document.getElementById('load-more-admin-button');
        loadMoreAdminSpinnerEl = loadMoreAdminButtonEl.querySelector('.fa-spinner');

        loadMoreAdminButtonEl.addEventListener('click', () => loadAdminComments(false));

        document.addEventListener('hidden.bs.modal', getUserStats, { once: true });


        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                console.log("Admin: User sudah login Firebase Auth, UID:", user.uid);
                getUserStats();
                setTimeout(() => {
                    if (typeof window.bootstrap !== 'undefined' && typeof window.bootstrap.Modal !== 'undefined') {
                        window.bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal')).hide();
                    } else {
                        console.error("DEBUG: window.bootstrap.Modal tidak tersedia saat mencoba hide modal setelah login.");
                    }
                }, 100);
            } else {
                console.log("Admin: User belum login Firebase Auth. Menampilkan modal login.");
                setTimeout(() => {
                    if (typeof window.bootstrap !== 'undefined' && typeof window.bootstrap.Modal !== 'undefined') {
                        console.log("Admin: Memanggil window.bootstrap.Modal().show() setelah penundaan.");
                        window.bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal')).show();
                    } else {
                        console.error("ERROR: window.bootstrap.Modal masih tidak didefinisikan setelah penundaan. Ada masalah fundamental.");
                    }
                }, 100);
            }
        });
    };

    /**
     * Inisialisasi utama modul admin.
     * @returns {object}
     */
    const init = () => {
        auth.init();
        theme.init();
        session.init();

        commentsCollectionRef = db.collection('comments');

        document.addEventListener('DOMContentLoaded', domLoaded);

        return {
            util,
            theme,
            admin: {
                auth,
                navbar,
                logout, // <--- Baris ini
                tenor,
                download,
                regenerate,
                changeName,
                changePassword,
                changeCheckboxValue,
                enableButtonName,
                enableButtonPassword,
                openLists,
                changeTz,
                deleteComment,
                loadAdminComments,
            },
        };
    };

    return {
        init,
    };
})();