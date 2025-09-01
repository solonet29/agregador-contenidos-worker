// content-creator.js
// Orquestador principal del flujo de trabajo de creación y publicación de contenido.

console.log("🚀 Iniciando el Orquestador de Contenido...");

const { connectToDatabase, closeDatabaseConnection } = require('./lib/database.js');

// Importaremos los módulos de cada paso del pipeline aquí
const { enrichEvents } = require('./enrich-events.js');
const { publishPosts } = require('./publish-content.js');
const { distributePosts } = require('./distributor.js');

async function main() {
    try {
        // Conectar a la base de datos al inicio
        await connectToDatabase();
        console.log("✅ Conexión a la base de datos establecida.");

        // --- PASO 1: Enriquecer Eventos ---
        console.log("\n---");
        console.log("PASO 1: Buscando eventos para enriquecer con contenido (texto e imagen)...");
        await enrichEvents();
        console.log("--- FIN PASO 1 ---");

        // --- PASO 2: Publicar Contenido ---
        console.log("\n---");
        console.log("PASO 2: Buscando contenido enriquecido para publicar en WordPress...");
        await publishPosts();
        console.log("--- FIN PASO 2 ---");

        // --- PASO 3: Distribuir en Redes Sociales ---
        console.log("\n---");
        console.log("PASO 3: Buscando posts publicados para distribuir en redes sociales...");
        await distributePosts();
        console.log("--- FIN PASO 3 ---");

    } catch (error) {
        console.error('❌ Ha ocurrido un error fatal en el orquestador:', error);
    } finally {
        // Cerrar la conexión a la base de datos al final
        await closeDatabaseConnection();
        console.log("\n✅ Conexión a la base de datos cerrada. Proceso finalizado.");
    }
}

main();
