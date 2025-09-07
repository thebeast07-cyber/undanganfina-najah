// undangan\js\app\components\card.js

import { gif } from './gif.js';
import { util } from '../../common/util.js';
import { storage } from '../../common/storage.js';

export const card = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let owns = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let likes = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let config = null; // Ini akan mengambil pengaturan dari `storage('config')`

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let showHide = null;

    const maxCommentLength = 300;

    /**
     * @returns {string}
     */
    const renderLoading = () => {
        return `
        <div class="bg-theme-auto shadow p-3 mx-0 mt-0 mb-3 rounded-4">
            <div class="d-flex justify-content-between align-items-center placeholder-wave">
                <span class="placeholder bg-secondary col-5 rounded-3 my-1"></span>
                <span class="placeholder bg-secondary col-3 rounded-3 my-1"></span>
            </div>
            <hr class="my-1">
            <p class="placeholder-wave m-0">
                <span class="placeholder bg-secondary col-6 rounded-3"></span>
                <span class="placeholder bg-secondary col-5 rounded-3"></span>
                <span class="placeholder bg-secondary col-12 rounded-3 my-1"></span>
            </p>
        </div>`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {string}
     */
    const renderLike = (c) => {
        // PASTIKAN c.like_count selalu berupa angka, gunakan nullish coalescing operator
        const displayLikeCount = c.like_count ?? 0;

        return `
        <button style="font-size: 0.8rem;" onclick="undangan.comment.like.love(this)" data-uuid="${c.uuid}" class="btn btn-sm btn-outline-auto ms-auto rounded-3 p-0 shadow-sm d-flex justify-content-start align-items-center" data-offline-disabled="false">
            <span class="my-0 mx-1" data-count-like="${displayLikeCount}">${displayLikeCount}</span>
            <i class="me-1 ${likes.has(c.uuid) ? 'fa-solid fa-heart text-danger' : 'fa-regular fa-heart'}"></i>
        </button>`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {string}
     */
    const renderAction = (c) => {
        let action = `<div class="d-flex justify-content-start align-items-center" data-button-action="${c.uuid}">`;

        // Logika Tombol Reply: Hanya muncul jika diizinkan oleh admin melalui pengaturan 'can_reply'
        // `config.get('can_reply')` akan mengambil nilai dari local storage,
        // yang diperbarui secara real-time oleh listener di `comment.js`.
        if (config.get('can_reply')) {
            action += `<button style="font-size: 0.8rem;" onclick="undangan.comment.reply('${c.uuid}')" class="btn btn-sm btn-outline-auto rounded-4 py-0 me-1 shadow-sm" data-offline-disabled="false">Reply</button>`;
        }

        // Logika Tombol Edit: TIDAK AKAN PERNAH DIRENDER UNTUK GUEST
        // Karena keputusan adalah hanya admin yang bisa edit.
        // Baris-baris kode sebelumnya untuk edit (yang melibatkan `isAdmin` atau `isOwner` dan `config.get('can_edit')`)
        // telah dihapus dari sini.

        // Logika Tombol Delete: TIDAK AKAN PERNAH DIRENDER UNTUK GUEST
        // Karena keputusan adalah hanya admin yang bisa delete.
        // Baris-baris kode sebelumnya untuk delete (yang melibatkan `isAdmin` atau `isOwner` dan `config.get('can_delete')`)
        // telah dihapus dari sini.

        action += '</div>';
        return action;
    };

    /**
     * @param {string} uuid
     * @param {string[]} uuids
     * @returns {string}
     */
    const renderReadMore = (uuid, uuids) => {
        uuid = util.escapeHtml(uuid);

        const hasId = showHide.get('show').includes(uuid);
        return `<a class="text-theme-auto" style="font-size: 0.8rem;" onclick="undangan.comment.showOrHide(this)" data-uuid="${uuid}" data-uuids="${util.escapeHtml(uuids.join(','))}" data-show="${hasId ? 'true' : 'false'}" role="button" class="me-auto ms-1 py-0">${hasId ? 'Hide replies' : `Show replies (${uuids.length})`}</a>`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {string}
     */
    const renderButton = (c) => {
        return `
        <div class="d-flex justify-content-between align-items-center" id="button-${c.uuid}">
            ${renderAction(c)}
            ${c.comments && c.comments.length > 0 ? renderReadMore(c.uuid, c.comments.map((i) => i.uuid)) : ''}
            ${renderLike(c)}
        </div>`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {string}
     */
    const renderTracker = (c) => {
        // Asumsi: c.is_admin selalu false untuk halaman tamu, IP dan user_agent tidak selalu tersedia
        if (!c.ip || !c.user_agent) {
            return '';
        }

        return `
        <div class="mb-1 mt-3">
            <p class="text-theme-auto mb-1 mx-0 mt-0 p-0" style="font-size: 0.7rem;" id="ip-${c.uuid}"><i class="fa-solid fa-location-dot me-1"></i>${util.escapeHtml(c.ip)} <span class="mb-1 placeholder col-2 rounded-3"></span></p>
            <p class="text-theme-auto m-0 p-0" style="font-size: 0.7rem;"><i class="fa-solid fa-mobile-screen-button me-1"></i>${util.parseUserAgent(util.escapeHtml(c.user_agent))}</p>
        </div>`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {string}
     */
    const renderHeader = (c) => {
        if (c.is_parent) {
            return `class="bg-theme-auto shadow p-3 mx-0 mt-0 mb-3 rounded-4"`;
        }
        // Pastikan 'show' properti ada sebelum mengaksesnya
        const isHidden = !showHide.get('hidden').find((i) => i.uuid === c.uuid)?.['show'];
        return `class="${isHidden ? 'd-none' : ''} overflow-x-scroll mw-100 border-start bg-theme-auto py-2 ps-2 pe-0 my-2 ms-2 me-0"`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {string}
     */
    const renderTitle = (c) => {
        // Asumsi: Admin badge hanya untuk tampilan di dashboard admin, bukan di guest
        // Cek `c.is_admin` pada data komentar jika Anda ingin menampilkan badge khusus admin di guest
        // Contoh: if (c.is_admin) return `<strong class="me-1">${util.escapeHtml(c.name)}</strong><i class="fa-solid fa-certificate text-primary"></i>`;

        if (c.is_parent) {
            return `<strong class="me-1">${util.escapeHtml(c.name)}</strong><i id="badge-${c.uuid}" data-is-presence="${c.presence ? 'true' : 'false'}" class="fa-solid ${c.presence ? 'fa-circle-check text-success' : 'fa-circle-xmark text-danger'}"></i>`;
        }

        return `<strong>${util.escapeHtml(c.name)}</strong>`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {Promise<string>}
     */
    const renderBody = async (c) => {
        const head = `
        <div class="d-flex justify-content-between align-items-center">
            <p class="text-theme-auto text-truncate m-0 p-0" style="font-size: 0.95rem;">${renderTitle(c)}</p>
            <small class="text-theme-auto m-0 p-0" style="font-size: 0.75rem;">${c.created_at}</small>
        </div>
        <hr class="my-1">`;

        if (c.gif_url) {
            return head + `
            <div class="d-flex justify-content-center align-items-center my-2">
                <img src="${await gif.get(c.gif_url)}" id="img-gif-${c.uuid}" class="img-fluid mx-auto gif-image rounded-4" alt="selected-gif">
            </div>`;
        }

        // Pastikan c.comment adalah string sebelum mencoba .length
        const commentContent = c.comment || '';
        const moreMaxLength = commentContent.length > maxCommentLength;
        const data = util.convertMarkdownToHTML(util.escapeHtml(moreMaxLength ? (commentContent.slice(0, maxCommentLength) + '...') : commentContent));

        return head + `
        <p class="text-theme-auto my-1 mx-0 p-0" style="white-space: pre-wrap !important; font-size: 0.95rem;" data-comment="${util.base64Encode(commentContent)}" id="content-${c.uuid}">${data}</p>
        ${moreMaxLength ? `<p class="d-block mb-2 mt-0 mx-0 p-0"><a class="text-theme-auto" role="button" style="font-size: 0.85rem;" data-show="false" onclick="undangan.comment.showMore(this, '${c.uuid}')">Selengkapnya</a></p>` : ''}`;
    };

    /**
     * @param {object} c - Objek komentar yang sudah diproses oleh DTO
     * @returns {Promise<string>}
     */
    const renderContent = async (c) => {
        const body = await renderBody(c);
        // Pastikan c.comments ada dan merupakan array sebelum memanggil map
        const resData = await Promise.all((c.comments || []).map((cmt) => renderContent(cmt)));

        return `
        <div ${renderHeader(c)} id="${c.uuid}" style="overflow-wrap: break-word !important;">
            <div id="body-content-${c.uuid}" data-tapTime="0" data-liked="false" tabindex="0">${body}</div>
            ${renderTracker(c)}
            ${renderButton(c)}
            <div id="reply-content-${c.uuid}">${resData.join('')}</div>
        </div>`;
    };

    /**
     * @param {object[]} cs - Array komentar yang sudah diproses oleh DTO
     * @returns {Promise<string>}
     */
    const renderContentMany = (cs) => {
        return gif.prepareCache()
            .then(() => Promise.all(cs.map((i) => renderContent(i))))
            .then((r) => r.join(''));
    };

    /**
     * @param {object} cs - Objek komentar tunggal yang sudah diproses oleh DTO
     * @returns {Promise<string>}
     */
    const renderContentSingle = (cs) => {
        return gif.prepareCache().then(() => renderContent(cs));
    };

    /**
     * @param {string} id
     * @returns {HTMLDivElement}
     */
     /**
     * @param {string} id
     * @returns {HTMLDivElement} // Pastikan ini mengembalikan elemen DIV
     */
    const renderReply = (id) => {
        id = util.escapeHtml(id);

        console.log(`card.js: renderReply for ID ${id} is called.`); // Log ini sudah ada, bagus.
        console.log(`card.js: Inside renderReply - gif.isActive() is:`, gif.isActive()); // Log ini sudah ada, bagus.
        console.log(`card.js: Inside renderReply - storage('config').get('tenor_key') is:`, storage('config').get('tenor_key')); // Log ini sudah ada, bagus.

        const isGifFeatureActiveInitial = gif.isActive();

        const gifButtonHtml = `
            <button class="btn btn-secondary btn-sm rounded-4 shadow-sm me-1 my-1 position-absolute bottom-0 end-0"
                    onclick="undangan.comment.gif.open('${id}')" aria-label="button gif"
                    data-offline-disabled="${!isGifFeatureActiveInitial}" ${!isGifFeatureActiveInitial ? 'disabled' : ''}>
                <i class="fa-solid fa-photo-film"></i>
            </button>`;

        // Ini adalah DIV utama yang akan memegang seluruh formulir balasan.
        // ID ini harus UNIK dan inilah yang akan dicari oleh getElementById.
        const innerDiv = document.createElement('div');
        innerDiv.classList.add('my-2');
        innerDiv.id = `inner-${id}`; 
        
        const template = `
        <p class="my-1 mx-0 p-0" style="font-size: 0.95rem;"><i class="fa-solid fa-reply me-2"></i>Reply</p>
        <div class="d-block mb-2" id="comment-form-${id}">
            <div class="position-relative">
                ${gifButtonHtml}
                <textarea class="form-control shadow-sm rounded-4 mb-2" id="form-inner-${id}" minlength="1" maxlength="1000" placeholder="Type reply comment" rows="3" data-offline-disabled="false"></textarea>
            </div>
        </div>
        <div class="d-none mb-2" id="gif-form-${id}"></div>
        <div class="d-flex justify-content-end align-items-center mb-0">
            <button style="font-size: 0.8rem;" onclick="undangan.comment.cancel(this, '${id}')" class="btn btn-sm btn-outline-auto rounded-4 py-0 me-1" data-offline-disabled="false">Cancel</button>
            <button style="font-size: 0.8rem;" onclick="undangan.comment.send(this)" data-uuid="${id}" class="btn btn-sm btn-outline-auto rounded-4 py-0" data-offline-disabled="false">Send</button>
        </div>`;

        util.safeInnerHTML(innerDiv, template); // Isi innerDiv dengan template
        return innerDiv; // Kembalikan elemen DIV itu sendiri
    };
    /**
     * @param {string} id
     * @param {boolean} presence
     * @param {boolean} is_parent
     * @param {boolean} is_gif
     * @returns {HTMLDivElement}
     */
    const renderEdit = (id, presence, is_parent, is_gif) => {
        id = util.escapeHtml(id);

        const inner = document.createElement('div');
        inner.classList.add('my-2');
        inner.id = `inner-${id}`;
        const template = `
        <p class="my-1 mx-0 p-0" style="font-size: 0.95rem;"><i class="fa-solid fa-pen me-2"></i>Edit</p>
        ${!is_parent ? '' : `
        <select class="form-select shadow-sm mb-2 rounded-4" id="form-inner-presence-${id}" data-offline-disabled="false">
            <option value="1" ${presence ? 'selected' : ''}>&#9989; Datang</option>
            <option value="2" ${presence ? '' : 'selected'}>&#10060; Berhalangan</option>
        </select>`}
        ${!is_gif ? `<textarea class="form-control shadow-sm rounded-4 mb-2" id="form-inner-${id}" minlength="1" maxlength="1000" placeholder="Type update comment" rows="3" data-offline-disabled="false"></textarea>
        ` : `${!gif.isActive() ? '' : `<div class="d-none mb-2" id="gif-form-${id}"></div>`}`}
        <div class="d-flex justify-content-end align-items-center mb-0">
            <button style="font-size: 0.8rem;" onclick="undangan.comment.cancel(this, '${id}')" class="btn btn-sm btn-outline-auto rounded-4 py-0 me-1" data-offline-disabled="false">Cancel</button>
            <button style="font-size: 0.8rem;" onclick="undangan.comment.update(this)" data-uuid="${id}" class="btn btn-sm btn-outline-auto rounded-4 py-0" data-offline-disabled="false">Update</button>
        </div>`;

        return util.safeInnerHTML(inner, template);
    };

    /**
     * @returns {void}
     */
    const init = () => {
        owns = storage('owns');
        likes = storage('likes');
        config = storage('config'); // Mengambil objek 'config' dari local storage
        showHide = storage('comment');
    };

   return {
        init,
        renderEdit,
        renderReply,
        renderLoading,
        renderReadMore,
        // --- TAMBAH renderContent DI SINI ---
        renderContent, 
        renderContentMany,
        renderContentSingle,
        maxCommentLength,
    };
})();