// undangan\js\app\guest\progress.js

export const progress = (() => {

    /**
     * @type {HTMLElement|null}
     */
    let info = null;

    /**
     * @type {HTMLElement|null}
     */
    let bar = null;

    let total = 0;
    let loaded = 0;
    let valid = true;
    let isDone = false;

    /**
     * @type {Promise<void>|null}
     */
    let cancelProgress = null;

    /**
     * @param {string} [type='unknown'] - Tipe item progress (misal: 'config', 'image', 'video')
     * @returns {void}
     */
    const add = (type = 'unknown') => { // <-- TAMBAHKAN PARAMETER 'type'
        total += 1;
        console.log(`[Progress] Item added: ${type}. Total: ${total}`); // LOG BARU
    };

    /**
     * @returns {string}
     */
    const showInformation = () => {
        return `(${loaded}/${total}) [${parseInt((loaded / total) * 100).toFixed(0)}%]`;
    };

    /**
     * @param {string} type
     * @param {boolean} [skip=false]
     * @returns {void}
     */
    const complete = (type, skip = false) => {
        if (!valid) {
            console.log(`[Progress] Complete skipped for ${type} because not valid.`); // LOG BARU
            return;
        }

        loaded += 1;
        console.log(`[Progress] Item complete: ${type}. Loaded: ${loaded}/${total}`); // LOG BARU
        info.innerText = `Loading ${type} ${skip ? 'skipped' : 'complete'} ${showInformation()}`;
        bar.style.width = Math.min((loaded / total) * 100, 100).toString() + '%';

        if (loaded === total) {
            isDone = true;
            console.log(`[Progress] All items completed. Dispatching 'undangan.progress.done'. Final Loaded: ${loaded}/${total}`); // LOG BARU
            document.dispatchEvent(new Event('undangan.progress.done'));
        }
    };

    /**
     * @param {string} type
     * @returns {void}
     */
    const invalid = (type) => {
        if (valid && !isDone) {
            valid = false;
            console.error(`[Progress] Invalid state for ${type}. Stopping progress. Loaded: ${loaded}/${total}`); // LOG BARU
            bar.style.backgroundColor = 'red';
            info.innerText = `Error loading ${type} ${showInformation()}`;
            document.dispatchEvent(new Event('undangan.progress.invalid'));
        }
    };

    /**
     * @returns {Promise<void>|null}
     */
    const getAbort = () => cancelProgress;

    /**
     * @returns {void}
     */
    const init = () => {
        info = document.getElementById('progress-info');
        bar = document.getElementById('progress-bar');
        if (info) info.classList.remove('d-none');
        cancelProgress = new Promise((res) => document.addEventListener('undangan.progress.invalid', res));
        console.log("[Progress] Progress module initialized."); // LOG BARU
    };

    return {
        init,
        add,
        invalid,
        complete,
        getAbort,
    };
})();