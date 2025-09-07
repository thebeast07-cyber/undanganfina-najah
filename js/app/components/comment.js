// undangan\js\app\components\comment.js

// Biarkan impor lainnya seperti ini:
import { gif } from './gif.js';
import { card } from './card.js';
import { like } from './like.js';
import { util } from '../../common/util.js';
import { pagination } from './pagination.js';
import { dto } from '../../connection/dto.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { offline } from '../../common/offline.js';


export const comment = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let owns = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let showHide = null;

    /**
     * @type {HTMLElement|null}
     */
    let commentsContainer = null;

    /**
     * @type {string[]}
     */
    const lastRenderedCommentIds = [];

    // Firestore Reference
    let commentsCollectionRef;
    let adminSettingsDocRef;
    
    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let appConfig = null;

    let unsubscribeComments = null;

    /**
     * @type {Map<string, { el: HTMLElement, parentUuid: string, isReplyForm: boolean }>}
     */
    const activeReplyForms = new Map();


    /**
     * @returns {string}
     */
    const onNullComment = () => {
        const desc = lang
            .on('id', 'Yuk, share undangan ini biar makin rame komentarnya! 🎉')
            .on('en', 'Let\'s share this invitation to get more comments! 🎉')
            .get();

        return `<div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow"><p class="fw-bold p-0 m-0" style="font-size: 0.95rem;">${desc}</p></div>`;
    };

    /**
     * @param {string} id
     * @param {boolean} disabled
     * @returns {void}
     */
    const changeActionButton = (id, disabled) => {
        const buttons = document.querySelectorAll(`[data-button-action="${id}"] button`);
        buttons.forEach((e) => {
            e.disabled = disabled;
        });
    };

    /**
     * @param {string} id
     * @returns {void}
     */
    const removeInnerForm = (id) => {
        console.log(`comment.js: Attempting to remove form with ID: inner-${id}`); // Ini log dari `removeInnerForm`
        changeActionButton(id, false);
        const formElement = document.getElementById(`inner-${id}`); // Mencari elemen dengan ID tersebut
        if (formElement) {
            formElement.remove();
            console.log(`comment.js: Form inner-${id} successfully removed from DOM.`);
        } else {
            console.warn(`comment.js: Form inner-${id} not found in DOM for removal. This might be expected if the form was already removed by another action, but ensure state is consistent.`);
        }
        activeReplyForms.delete(id); // Pastikan selalu dihapus dari Map, agar tidak ada entri basi
    };


    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const showOrHide = (button) => {
        const ids = button.getAttribute('data-uuids').split(',');
        const isShowing = button.getAttribute('data-show') === 'true';
        const uuid = button.getAttribute('data-uuid');
        const currentShown = showHide.get('show');

        button.setAttribute('data-show', isShowing ? 'false' : 'true');
        button.innerText = isShowing ? `Show replies (${ids.length})` : 'Hide replies';
        showHide.set('show', isShowing ? currentShown.filter((i) => i !== uuid) : [...currentShown, uuid]);

        for (const id of ids) {
            const isCurrentlyHidden = showHide.get('hidden').find(h => h.uuid === id && h.show === false);
            if (isShowing) {
                if (!isCurrentlyHidden) {
                    showHide.set('hidden', [...showHide.get('hidden'), dto.commentShowMore(id, false)]);
                }
            } else {
                showHide.set('hidden', showHide.get('hidden').filter(h => h.uuid !== id));
            }
            document.getElementById(id)?.classList.toggle('d-none', isShowing);
        }
    };

    /**
     * @param {HTMLAnchorElement} anchor
     * @param {string} uuid
     * @returns {void}
     */
    const showMore = (anchor, uuid) => {
        const content = document.getElementById(`content-${uuid}`);
        const original = util.base64Decode(content.getAttribute('data-comment'));
        const isCollapsed = anchor.getAttribute('data-show') === 'false';

        util.safeInnerHTML(content, util.convertMarkdownToHTML(util.escapeHtml(isCollapsed ? original : original.slice(0, card.maxCommentLength) + '...')));
        anchor.innerText = isCollapsed ? 'Sebagian' : 'Selengkapnya';
        anchor.setAttribute('data-show', isCollapsed ? 'true' : 'false');
    };

    /**
     * @param {ReturnType<typeof dto.getCommentsResponse>} items
     * @param {ReturnType<typeof dto.commentShowMore>[]} hide
     * @returns {ReturnType<typeof dto.commentShowMore>[]}
     */
    const traverse = (items, hide = []) => {
        const dataShow = showHide.get('show');

        const buildHide = (lists) => lists.forEach((item) => {
            if (hide.find((i) => i.uuid === item.uuid)) {
                buildHide(item.comments);
                return;
            }

            hide.push(dto.commentShowMore(item.uuid));
            buildHide(item.comments);
        });

        const setVisible = (lists) => lists.forEach((item) => {
            if (!dataShow.includes(item.uuid)) {
                setVisible(item.comments);
                return;
            }

            item.comments.forEach((c) => {
                const i = hide.findIndex((h) => h.uuid === c.uuid);
                if (i !== -1) {
                    hide[i].show = true;
                }
            });

            setVisible(item.comments);
        });

        buildHide(items);
        setVisible(items);

        return hide;
    };

    /**
     * Mengambil dan menampilkan komentar dari Firestore secara real-time.
     * @returns {void}
     */
    const setupRealtimeCommentsListener = () => {
        if (unsubscribeComments) {
            unsubscribeComments();
            unsubscribeComments = null;
        }

        commentsContainer.setAttribute('data-loading', 'true');
        commentsContainer.innerHTML = card.renderLoading().repeat(pagination.getPer());

        unsubscribeComments = commentsCollectionRef.orderBy('created_at', 'desc')
            .onSnapshot(async (snapshot) => {
                commentsContainer.setAttribute('data-loading', 'false');
                pagination.hideLoadingLoadMoreButton();

                if (snapshot.empty) {
                    util.safeInnerHTML(commentsContainer, onNullComment());
                    pagination.hideLoadMoreButton();
                    return;
                }

                lastRenderedCommentIds.forEach((u) => {
                    like.removeListener(u);
                });
                lastRenderedCommentIds.length = 0;

                let fetchedRawComments = snapshot.docs.map(doc => {
                    return { uuid: doc.id, ...doc.data() };
                });

                const processedComments = fetchedRawComments.map(dto.getCommentResponse);
                
                const parentComments = processedComments.filter(c => c.parentId === null || c.parentId === undefined);
                const replies = processedComments.filter(c => c.parentId !== null && c.parentId !== undefined);

                const buildCommentTree = (commentsList, currentParentId = null) => {
                    const filteredList = commentsList.filter(c => c.parentId === currentParentId);
                    return filteredList.map(c => {
                        const children = buildCommentTree(replies, c.uuid);
                        return { ...c, comments: children };
                    });
                };

                const structuredComments = buildCommentTree(parentComments);

                const renderedCommentsPromises = structuredComments.map(async (c) => {
                    try {
                        return await card.renderContent(c);
                    } catch (error) {
                        console.error(`Error rendering comment ${c.uuid} (GIF issue?):`, error);
                        return `<div class="bg-theme-auto rounded-4 shadow-sm p-3 mb-3">
                                    <p class="text-danger">Error loading comment ${util.escapeHtml(c.name)}: GIF or content failed to load.</p>
                                    <p>${util.nl2br(util.escapeHtml(c.comment || ''))}</p>
                                </div>`;
                    }
                });

                const results = await Promise.allSettled(renderedCommentsPromises);
                let dataHtml = '';
                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        dataHtml += result.value;
                    } else {
                        console.error("Promise.allSettled: Comment rendering promise rejected:", result.reason);
                    }
                });

                util.safeInnerHTML(commentsContainer, dataHtml);

                structuredComments.forEach(c => {
                    lastRenderedCommentIds.push(c.uuid);
                    like.addListener(c.uuid);
                    const addReplyListeners = (replyComments) => {
                        replyComments.forEach(reply => {
                            lastRenderedCommentIds.push(reply.uuid);
                            like.addListener(reply.uuid);
                            if (reply.comments && reply.comments.length > 0) {
                                addReplyListeners(reply.comments);
                            }
                        });
                    };
                    addReplyListeners(c.comments);
                });

                pagination.hideLoadMoreButton();

                commentsContainer.dispatchEvent(new Event('undangan.comment.done'));
                commentsContainer.dispatchEvent(new Event('undangan.comment.result'));

            }, (error) => {
                console.error("Error listening to comments in real-time:", error);
                commentsContainer.setAttribute('data-loading', 'false');
                util.safeInnerHTML(commentsContainer, `<div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow"><p class="fw-bold p-0 m-0" style="font-size: 0.95rem;">Failed to load comments in real-time. Please check your internet connection or Firestore rules.</p></div>`);
                pagination.hideLoadMoreButton();
            });
    };

    /**
     * Mengirim komentar baru atau balasan ke Firestore.
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const send = async (button) => {
        const id = button.getAttribute('data-uuid');

        const nameInput = document.getElementById('form-name');
        const nameValue = nameInput ? nameInput.value?.trim() : '';

        if (nameValue.length === 0) {
            util.notify('Name cannot be empty.').warning();
            nameInput?.scrollIntoView({ block: 'center' });
            return;
        }

        const presenceSelect = document.getElementById('form-presence');
        const isPresenceValue = presenceSelect ? presenceSelect.value : null;

        if (!id && isPresenceValue === '0') {
            util.notify('Please select your attendance status.').warning();
            return;
        }

        const gifIsOpenFlag = gif.isOpen(id ? id : gif.default);
        // const gifId = gif.getResultId(id ? id : gif.default); // Ini hanya ID GIF, tidak lagi perlu disimpan
        const gifUrlToSave = gif.getResultUrl(id ? id : gif.default); // PENTING: Ambil URL LENGKAP

        const gifCancelButton = gif.buttonCancel(id);

        // Jika GIF picker terbuka dan belum ada GIF yang dipilih (url kosong)
        if (gifIsOpenFlag && !gifUrlToSave) {
            util.notify('Gif cannot be empty.').warning();
            return;
        }

        if (gifIsOpenFlag && gifUrlToSave) {
            gifCancelButton.hide();
        }

        const commentForm = document.getElementById(`form-${id ? `inner-${id}` : 'comment'}`);
        const commentTextContent = gifIsOpenFlag ? null : commentForm?.value?.trim();

        if (!gifIsOpenFlag && (commentTextContent === null || commentTextContent.length === 0)) {
            util.notify('Comments cannot be empty.').warning();
            return;
        }

        let filteredCommentTextContent = commentTextContent;
        if (appConfig.get('is_filter') && filteredCommentTextContent) {
            filteredCommentTextContent = util.filterWords ? util.filterWords(filteredCommentTextContent) : filteredCommentTextContent;
        }

        // Disable UI elements
        if (nameInput) nameInput.disabled = true;
        if (presenceSelect) presenceSelect.disabled = true;
        if (commentForm) commentForm.disabled = true;
        const cancelButton = document.querySelector(`[onclick="undangan.comment.cancel(this, '${id}')"]`);
        if (cancelButton) cancelButton.disabled = true;
        const sendButton = util.disableButton(button);

        try {
            let userId = storage('guest_uuid').get('id');
            if (!userId) {
                userId = util.generateUUID();
                storage('guest_uuid').set('id', userId);
            }
            
            const commentData = dto.postCommentRequest(
                id,
                nameValue,
                id ? '1' : isPresenceValue,
                filteredCommentTextContent,
                gifUrlToSave // PASTIKAN INI ADALAH gifUrlToSave (URL LENGKAP), BUKAN gifId
            );

            commentData.ip = '127.0.0.1'; // Placeholder
            commentData.user_agent = navigator.userAgent; // Placeholder
            commentData.own = userId;

            const docRef = await commentsCollectionRef.add(commentData);
            const newCommentId = docRef.id;

            console.log("comment.js -> send: Komentar berhasil dikirim dengan ID Firestore:", newCommentId);

            owns.set(newCommentId, newCommentId);

            if (!id && nameInput) {
                storage('information').set('name', nameValue);
                storage('information').set('presence', isPresenceValue === '1');
            }

            // Reset form dan UI
            if (commentForm) commentForm.value = '';
            if (gifIsOpenFlag && gifUrlToSave) gifCancelButton.click();
            removeInnerForm(id);

        } catch (error) {
            console.error("Error sending comment to Firestore:", error);
            util.notify('Failed to send comment.').error();
        } finally {
            if (nameInput) nameInput.disabled = false;
            if (presenceSelect) presenceSelect.disabled = false;
            if (commentForm) commentForm.disabled = false;
            if (cancelButton) cancelButton.disabled = false;
            sendButton.restore();
            if (gifIsOpenFlag && gifUrlToSave) gifCancelButton.show();
        }
    };

    /**
     * Menghapus komentar dari Firestore (Hanya untuk Admin).
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const remove = async (button) => {
        util.notify('Fitur penghapusan komentar hanya tersedia untuk Admin.').warning();
        return;
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const update = async (button) => {
        util.notify('Fitur pengeditan komentar hanya tersedia untuk Admin.').warning();
        return;
    };

    /**
     * @param {HTMLButtonElement} button
     * @param {string} id
     * @returns {Promise<void>}
     */
    const cancel = async (button, id) => {
        console.log(`comment.js: Cancel button clicked for ID: ${id}`);
        
        const presenceSelect = document.getElementById(`form-inner-presence-${id}`);
        const initialPresence = presenceSelect ? (document.getElementById(`badge-${id}`)?.getAttribute('data-is-presence') === 'true' ? '1' : '2') : null;
        const currentPresence = presenceSelect?.value;

        const gifOpened = gif.isOpen(id);
        const gifSelected = gif.getResultId(id);
        const gifStateChanged = gifOpened && (!gifSelected || gifSelected !== document.getElementById(`img-gif-${id}`)?.src);

        const commentForm = document.getElementById(`form-inner-${id}`);
        const originalCommentContentEncoded = commentForm?.getAttribute('data-original') || '';
        const originalCommentContent = util.base64Decode(originalCommentContentEncoded);
        const currentCommentContent = commentForm?.value?.trim() || '';

        const commentContentChanged = commentForm && currentCommentContent !== originalCommentContent;

        const presenceChanged = presenceSelect && initialPresence !== currentPresence;

        const hasChanges = commentContentChanged || gifStateChanged || presenceChanged;

        console.log(`comment.js: Cancel - hasChanges: ${hasChanges}`);

        if (!hasChanges) {
             console.log(`comment.js: Cancel - No changes detected, removing form.`);
             removeInnerForm(id); // Call removeInnerForm to clean up DOM and map
             return;
        }

        if (util.ask('Are you sure you want to cancel changes?')) {
            console.log(`comment.js: Cancel - User confirmed cancellation.`);
            if (gifOpened) {
                await gif.remove(id);
            }
            removeInnerForm(id); // Call removeInnerForm after user confirmation
            console.log(`comment.js: Cancel - Form removal process initiated.`);
        } else {
            console.log(`comment.js: Cancel - User declined cancellation.`);
        }
    };

    /**
     * @param {string} uuid
     * @returns {void}
     */
    const reply = (uuid) => {
        if (!appConfig.get('can_reply')) {
            util.notify('Fitur balasan komentar dinonaktifkan oleh Admin.').warning();
            return;
        }

        changeActionButton(uuid, true);

        // Always remove any existing form for this parentUuid before displaying a new one.
        // This implicitly handles the 'existingElement' case by ensuring both DOM and activeReplyForms map are clean.
        removeInnerForm(uuid); 

        // displayReplyForm now directly inserts the element returned by card.renderReply.
        displayReplyForm(uuid);
    };

    /**
     * Fungsi untuk me-render (atau re-render) form balasan.
     * Ini akan dipanggil saat pertama kali membuka, dan saat pengaturan admin diperbarui.
     * @param {string} parentUuid - UUID komentar induk yang akan dibalas
     * @param {HTMLElement|null} [existingElement=null] - (No longer directly used as `existingElement` for replacement)
     * @returns {void}
     */
    /**
     * Fungsi untuk me-render (atau re-render) form balasan.
     * Ini akan dipanggil saat pertama kali membuka, dan saat pengaturan admin diperbarui.
     * @param {string} parentUuid - UUID komentar induk yang akan dibalas
     * @returns {void}
     */
    const displayReplyForm = (parentUuid) => {
        // Hapus formulir yang sudah ada untuk parentUuid ini sebelum menambahkan yang baru.
        // Ini memastikan hanya ada satu formulir balasan aktif per komentar induk.
        removeInnerForm(parentUuid); // Ini akan membersihkan DOM dan Map activeReplyForms

        // card.renderReply sekarang mengembalikan elemen DIV HTML yang sudah lengkap dengan ID.
        const newReplyFormElement = card.renderReply(parentUuid); 

        // Sisipkan elemen formulir balasan baru ke DOM.
        document.getElementById(`button-${parentUuid}`)?.insertAdjacentElement('afterend', newReplyFormElement);
        
        // Simpan referensi ke elemen yang baru disisipkan ini di Map activeReplyForms.
        activeReplyForms.set(parentUuid, { el: newReplyFormElement, parentUuid: parentUuid, isReplyForm: true });

        // Setelah penyisipan, pastikan status formulir GIF (sembunyi/tampilkan) sudah benar.
        // PENTING: Jangan panggil gif.open() di sini, karena itu hanya akan menampilkan UI GIF.
        // gif.open() dipanggil saat pengguna mengklik tombol GIF.
        const gifForm = newReplyFormElement.querySelector(`#gif-form-${parentUuid}`);
        const commentForm = newReplyFormElement.querySelector(`#comment-form-${parentUuid}`);
        if (gifForm && commentForm) {
            if (gif.isOpen(parentUuid)) { // Cek apakah GIF picker seharusnya terbuka untuk ID ini
                gifForm.classList.remove('d-none');
                commentForm.classList.add('d-none');
            } else {
                gifForm.classList.add('d-none');
                commentForm.classList.remove('d-none');
            }
        }
    };

   /**
     * Update the state of all active reply forms based on current admin settings.
     * This is called when admin settings (specifically `can_reply`) change.
     * @returns {void}
     */
    const updateReplyFormsState = () => {
        const canReply = appConfig.get('can_reply');
        console.log(`comment.js: updateReplyFormsState called. can_reply is ${canReply}.`);

        // Iterasi salinan kunci untuk menghindari masalah jika map dimodifikasi selama iterasi
        Array.from(activeReplyForms.keys()).forEach((parentUuid) => {
            // Memanggil displayReplyForm akan otomatis menghapus yang lama dan menyisipkan yang baru
            // dengan status tombol GIF yang diperbarui.
            displayReplyForm(parentUuid); 
        });

        // Juga perbarui tombol GIF utama di formulir komentar utama
        const mainCommentGifButton = document.querySelector('[onclick="undangan.comment.gif.open(undangan.comment.gif.default)"]');
        if (mainCommentGifButton) {
            mainCommentGifButton.disabled = !gif.isActive();
            mainCommentGifButton.setAttribute('data-offline-disabled', String(!gif.isActive()));
        }
    };


    /**
     * @param {HTMLButtonElement} button
     * @param {boolean} is_parent
     * @returns {Promise<void>}
     */
    const edit = async (button, is_parent) => {
        util.notify('Fitur pengeditan komentar hanya tersedia untuk Admin.').warning();
        return;
    };

    /**
     * @returns {void}
     */
    const init = () => {
        gif.init();
        like.init();
        card.init();
        pagination.init();

        commentsContainer = document.getElementById('comments');

        owns = storage('owns');
        showHide = storage('comment');
        appConfig = storage('config');

        if (!showHide.has('hidden')) {
            showHide.set('hidden', []);
        }
        if (!showHide.has('show')) {
            showHide.set('show', []);
        }

        if (typeof db !== 'undefined') {
            commentsCollectionRef = db.collection('comments');

            adminSettingsDocRef = db.collection('adminSettings').doc('main_app_settings');

            adminSettingsDocRef.onSnapshot((doc) => {
                if (doc.exists) {
                    const settingsData = doc.data();
                    console.log("Guest: Admin settings updated (RAW from Firestore):", settingsData);
                    console.log("Guest: Value of settingsData.tenor_key:", settingsData.tenor_key);
                    console.log("Guest: Value of settingsData.can_reply:", settingsData.can_reply);

                    appConfig.set('tenor_key', settingsData.tenor_key || '');
                    appConfig.set('is_filter', settingsData.is_filter || false);
                    appConfig.set('is_confetti_animation', settingsData.is_confetti_animation || false);
                    appConfig.set('can_reply', settingsData.can_reply || false);

                    console.log("Guest: appConfig (storage('config')) after update:", appConfig.get());

                    document.dispatchEvent(new CustomEvent('adminSettingsUpdated', { detail: settingsData }));

                    // RE-RENDER FORM BALASAN YANG AKTIF
                    updateReplyFormsState(); // Panggil ini untuk mengupdate tombol GIF

                } else {
                    console.warn("Guest: Admin settings document not found.");
                    appConfig.set('tenor_key', '');
                    appConfig.set('is_filter', false);
                    appConfig.set('is_confetti_animation', false);
                    appConfig.set('can_reply', false);
                    console.log("Guest: appConfig reset to default because document not found:", appConfig.get());

                    updateReplyFormsState(); // Panggil ini untuk menonaktifkan tombol GIF
                }
            }, (error) => {
                console.error("Guest: Error listening to admin settings:", error);
                appConfig.set('tenor_key', '');
                appConfig.set('is_filter', false);
                appConfig.set('is_confetti_animation', false);
                appConfig.set('can_reply', false);
                console.log("Guest: appConfig reset to default due to listener error:", appConfig.get());

                updateReplyFormsState(); // Panggil ini untuk menonaktifkan tombol GIF
            });

            setupRealtimeCommentsListener();

        } else {
            console.error("Firestore 'db' object is not defined in comment.js. Ensure Firebase is initialized in index.html before guest.js.");
        }
    };

    return {
        gif,
        like,
        pagination,
        init,
        send,
        edit,
        reply,
        remove,
        update,
        cancel,
        showMore,
        showOrHide,
    };
})();