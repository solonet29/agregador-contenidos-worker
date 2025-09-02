
const pinterestSdk = require('pinterest-sdk');
const config = require('../config');

let pinterest;

function getPinterestClient() {
    if (!pinterest) {
        const { accessToken } = config.socialMedia.pinterest;
        if (!accessToken) {
            throw new Error('Missing Pinterest access token in config file or .env');
        }
        pinterest = pinterestSdk.init({ accessToken });
    }
    return pinterest;
}

/**
 * Crea un Pin en un tablero de Pinterest.
 * @param {string} boardId - El ID del tablero donde se creará el Pin.
 * @param {string} title - El título del Pin.
 * @param {string} imageUrl - La URL de la imagen para el Pin.
 * @param {string} link - El enlace de destino del Pin (ej. el post del blog).
 * @returns {Promise<any>}
 */
async function createPin(boardId, title, imageUrl, link) {
    try {
        const client = getPinterestClient();
        const pinData = {
            board_id: boardId,
            title: title,
            media_source: {
                source_type: 'image_url',
                url: imageUrl
            },
            link: link
        };

        const pin = await client.pins.create(pinData);
        console.log(`Pin creado con éxito en el tablero ${boardId}: ${pin.id}`);
        return pin;
    } catch (error) {
        console.error(`Error al crear el Pin en Pinterest:`, error);
        throw error;
    }
}

module.exports = {
    createPin
};
