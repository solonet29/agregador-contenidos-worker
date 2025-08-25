// RUTA: api/manual/publish-daily-batch.js

// Importamos la lógica principal de nuestro publicador
const { runPublishingBatch } = require('../../publish-content.js');

export default async function handler(req, res) {
    // 1. SEGURIDAD: Protegemos el endpoint con una clave secreta
    // Usamos la misma que en la otra API para mantener la consistencia
    if (req.query.secret !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        console.log('Disparador manual activado: Ejecutando el lote de publicación diario...');

        // 2. EJECUCIÓN: Llamamos a la lógica principal de publicación
        // No usamos 'await' para que envíe una respuesta inmediata al navegador
        runPublishingBatch();

        // 3. RESPUESTA: Enviamos una respuesta inmediata para que no esperes
        res.status(202).json({
            message: 'Aceptado. Se ha iniciado el proceso de publicación para un lote de 12 posts. Revisa los logs para ver el progreso.'
        });

    } catch (error) {
        console.error('Error al disparar el lote de publicación:', error);
        res.status(500).json({ error: 'El disparador ha fallado.' });
    }
}