// test-image.js

const { createFinderImage } = require('./lib/imageGenerator.js');

// Creamos un evento de prueba para ver el resultado
const mockEvent = {
    date: '2025-10-15', // Formato AAAA-MM-DD
    city: 'Jerez de la Frontera'
};

async function runTest() {
    console.log("🚀 Iniciando prueba de generación de imagen...");
    try {
        await createFinderImage(mockEvent);
        console.log("✨ Prueba finalizada. Revisa la imagen generada en la carpeta raíz del proyecto.");
    } catch (error) {
        console.error("🔥 La prueba ha fallado:", error);
    }
}

runTest();