require('dotenv').config();

// Solo importamos el cliente de X
const { XClient } = require('../lib/xClient');

const testPost = {
    title: 'Prueba Final: Noche de Duende en el Tablao',
    url: 'https://afland.es/',
    description: 'Una prueba final para nuestra integración con X. ¡El duende llega a las redes!',
};

async function runXTest() {
    console.log('--- INICIANDO PRUEBA DE PUBLICACIÓN EN X ---');

    try {
        console.log('🚀 Publicando en X...');
        const xClient = new XClient();
        const tweetText = `${testPost.title}\n\nDescubre más aquí: ${testPost.url}`;

        const tweet = await xClient.post({ text: tweetText });

        console.log('✅ ¡Publicado en X con éxito!');
        console.log(`   - ID del Tweet: ${tweet.id}`);
        console.log(`   - Enlace al Tweet: https://x.com/DuendeFinder/status/${tweet.id}`);
    } catch (error) {
        console.error('❌ Error al publicar en X:', error.message);
    }

    console.log('--- PRUEBA FINALIZADA ---');
}

runXTest();