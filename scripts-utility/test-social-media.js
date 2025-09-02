require('regenerator-runtime/runtime');
require('dotenv').config();

// Solo importamos el cliente de Pinterest
const { PinterestClient } = require('../lib/pinterestClient');

const testPost = {
    title: 'Evento de Prueba: Tablao Flamenco en Sevilla',
    url: 'https://afland.es/programacion-tablaos-flamencos/sevilla/el-patio-sevillano',
    description: 'Una noche mágica con el mejor cante y baile flamenco. Un evento de prueba para Duende Finder.',
    imageUrl: 'https://images.pexels.com/photos/4300346/pexels-photo-4300346.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
};

async function runSocialMediaTests() {
    console.log('--- INICIANDO PRUEBAS DE PUBLICACIÓN (SOLO PINTEREST) ---\n');

    /* --- PRUEBA DE X (Twitter) - DESACTIVADA ---
    try {
        console.log('🚀 Probando la publicación en X...');
        const { XClient } = require('../lib/xClient');
        const xClient = new XClient();
        const tweetText = `${testPost.title}\n\nDescubre más aquí: ${testPost.url}`;
        const tweet = await xClient.post({ text: tweetText });
        console.log(`✅ Publicado en X con éxito! -> Tweet ID: ${tweet.id}`);
    } catch (error) {
        console.error('❌ Error al publicar en X:', error.message);
    }
    */

    // --- PRUEBA DE PINTEREST ---
    try {
        console.log('\n📌 Probando la publicación en Pinterest...');
        const pinterestClient = new PinterestClient();
        const boardId = process.env.PINTEREST_BOARD_ID;

        if (!boardId) {
            throw new Error('La variable PINTEREST_BOARD_ID no está definida en el archivo .env. Por favor, añade el ID de tu tablero.');
        }

        const pin = await pinterestClient.createPin({
            board_id: boardId,
            link: testPost.url,
            title: testPost.title,
            alt_text: testPost.description,
            media_source: {
                source_type: 'image_url',
                url: testPost.imageUrl,
            },
        });
        console.log(`✅ Pin creado en Pinterest con éxito! -> Pin ID: ${pin.id}`);
    } catch (error) {
        console.error('❌ Error al publicar en Pinterest:', error.message);
    }

    /* --- PRUEBA DE REDDIT (DESACTIVADA) ---
    // ... bloque de Reddit comentado ...
    */

    console.log('\n--- PRUEBAS FINALIZADAS ---');
}

runSocialMediaTests();
