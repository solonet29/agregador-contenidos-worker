// scripts-utility/test-social-media.js
const { publishToSocialMedia } = require('../social-media-publisher');

async function testSocialMedia() {
    const postContent = '¡Hola, mundo! Este es un tweet de prueba desde mi aplicación.';
    const platform = 'x'; // Cambia a 'reddit' o 'pinterest' para probar otras plataformas

    console.log(`🚀 Probando la publicación en ${platform}...`);
    await publishToSocialMedia(postContent, platform);
}

testSocialMedia();
