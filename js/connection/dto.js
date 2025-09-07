// undangan\js\connection\dto.js

export const dto = (() => {

    /**
     * @param {{ uuid: string, own: string, name: string, presence: '1'|'2'|boolean, commentText: string|null, created_at: import('@firebase/firestore').Timestamp|Date|null, is_admin?: boolean, is_parent?: boolean, gif?: string|null, ip?: string|null, user_agent?: string|null, like?: number, parentId?: string|null }} data // <-- Parameter input dari Firestore, menambahkan 'commentText' dan 'parentId'
     * @returns {{ uuid: string, own: string, name: string, presence: boolean, comment: string|null, created_at: string, is_admin: boolean, is_parent: boolean, gif_url: string|null, ip: string|null, user_agent: string|null, comments: ReturnType<getCommentResponse>[], like_count: number, parentId: string|null }} // <-- Objek output untuk aplikasi
     */
    const getCommentResponse = (data) => {
        // Asumsi 'commentText' adalah field di Firestore untuk teks komentar
        // Asumsi 'gif' adalah field di Firestore untuk URL GIF
        // Asumsi 'like' adalah field di Firestore untuk jumlah like
        const uuid = data.uuid;
        const own = data.own ?? 'false'; // Default 'false' jika tidak ada info kepemilikan
        const name = data.name;
        // Konversi nilai presence dari Firestore: bisa string '1'/'2' atau boolean langsung
        const presence = typeof data.presence === 'boolean' ? data.presence : (data.presence === '1');
        const commentContent = data.commentText; // <--- UBAH DI SINI: membaca 'commentText' dari Firestore
        const createdAt = data.created_at;
        const is_admin = data.is_admin ?? false;
        const is_parent = data.is_parent ?? true; // Default true jika tidak ada info is_parent
        const gif_url = data.gif || null; // Ambil 'gif' dari data Firestore
        const ip = data.ip || null;
        const user_agent = data.user_agent || null;
        const like = data.like ?? 0; // Ambil 'like' dari data Firestore
        const parentId = data.parentId ?? null; // Ambil parentId jika ada

        return {
            uuid,
            own,
            name,
            presence,
            comment: commentContent, // <-- MAPPING: commentText dari Firestore menjadi comment untuk aplikasi
            created_at: createdAt ? new Date(createdAt.toDate ? createdAt.toDate() : createdAt).toLocaleString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Baru saja', // Pastikan Timestamp Firebase dikonversi dengan benar
            is_admin,
            is_parent,
            gif_url,
            ip,
            user_agent,
            comments: [], // Komentar balasan akan diisi saat membangun tree di comment.js
            like_count: like,
            parentId: parentId, // Tambahkan parentId ke objek output
        };
    };

    /**
     * @param {{ uuid: string, own: string, name: string, presence: '1'|'2'|boolean, commentText: string|null, created_at: import('@firebase/firestore').Timestamp|Date|null, is_admin?: boolean, is_parent?: boolean, gif?: string|null, ip?: string|null, user_agent?: string|null, like?: number, parentId?: string|null }[]} data
     * @returns {ReturnType<getCommentResponse>[]}
     */
    const getCommentsResponse = (data) => data.map(getCommentResponse);

    /**
     * @param {{ count: number, lists: { uuid: string, own: string, name: string, presence: boolean, comment: string|null, created_at: string, is_admin: boolean, is_parent: boolean, gif_url: string|null, ip: string|null, user_agent: string|null, comments: ReturnType<getCommentResponse>[], like_count: number }[] }} data
     * @returns {{ count: number, lists: ReturnType<getCommentResponse>[] }}
     */
    const getCommentsResponseV2 = (data) => {
        return {
            count: data.count,
            lists: getCommentsResponse(data.lists),
        };
    };

    /**
     * @param {{status: boolean}} status
     * @returns {{status: boolean}}
     */
    const statusResponse = ({ status }) => {
        return {
            status,
        };
    };

    /**
     * @param {{token: string}} token
     * @returns {{token: string}}
     */
    const tokenResponse = ({ token }) => {
        return {
            token,
        };
    };

    /**
     * @param {{uuid: string}} uuid
     * @returns {{uuid: string}}
     */
    const uuidResponse = ({ uuid }) => {
        return {
            uuid,
        };
    };

    /**
     * @param {string} uuid
     * @param {boolean} show
     * @returns {{uuid: string, show: boolean}}
     */
    const commentShowMore = (uuid, show = false) => {
        return {
            uuid,
            show,
        };
    };

    /**
     * @param {string|null} parentId // Ini bisa menjadi parentId jika ini adalah balasan
     * @param {string} name
     * @param {string} presence // String '1' atau '2'
     * @param {string|null} commentTextContent // PARAMETER UNTUK KONTEN KOMENTAR
     * @param {string|null} gif_url_from_client // URL GIF dari client
     * @returns {{name: string, presence: string, commentText?: string, gif?: string, created_at: import('@firebase/firestore').FieldValue, like: number, is_admin: boolean, is_parent: boolean, parentId?: string}}
     */
    const postCommentRequest = (parentId, name, presence, commentTextContent, gif_url_from_client) => {
        const data = {
            name,
            presence, // Kirim '1' atau '2'
            created_at: firebase.firestore.FieldValue.serverTimestamp(), // Gunakan serverTimestamp
            like: 0,
            is_admin: false,
            is_parent: !parentId, // True jika tidak ada parentId (komentar utama)
        };
        if (commentTextContent) {
            data.commentText = commentTextContent; // <--- UBAH DI SINI: menulis ke 'commentText'
        }
        if (gif_url_from_client) {
            data.gif = gif_url_from_client; // <--- menulis ke 'gif'
        }
        if (parentId) { // Hanya tambahkan parentId jika ini adalah balasan
            data.parentId = parentId;
        } else {
             data.parentId = null; // Pastikan parentId null untuk komentar utama
        }
        return data;
    };

    /**
     * @param {string} email
     * @param {string} password
     * @returns {{email: string, password: string}}
     */
    const postSessionRequest = (email, password) => {
        return {
            email: email,
            password: password,
        };
    };

    /**
     * @param {string|null} presence // String '1' atau '2' atau null
     * @param {string|null} commentTextContent // PARAMETER UNTUK KONTEN KOMENTAR
     * @param {string|null} gif_url_from_client
     * @returns {{presence?: string, commentText?: string, gif?: string}}
     */
    const updateCommentRequest = (presence, commentTextContent, gif_url_from_client) => {
        const data = {};
        if (presence !== null) {
            data.presence = presence; // Kirim '1' atau '2'
        }
        if (commentTextContent !== null) {
            data.commentText = commentTextContent; // <--- UBAH DI SINI: menulis ke 'commentText'
        }
        if (gif_url_from_client !== null) {
            data.gif = gif_url_from_client; // <--- menulis ke 'gif'
        }
        // Jika gif_url_from_client adalah string kosong, mungkin artinya ingin menghapus GIF
        if (gif_url_from_client === '') {
            data.gif = firebase.firestore.FieldValue.delete(); // Hapus field 'gif'
        }
        return data;
    };

    return {
        uuidResponse,
        tokenResponse,
        statusResponse,
        getCommentResponse,
        getCommentsResponse,
        getCommentsResponseV2,
        commentShowMore,
        postCommentRequest,
        postSessionRequest,
        updateCommentRequest,
    };
})();