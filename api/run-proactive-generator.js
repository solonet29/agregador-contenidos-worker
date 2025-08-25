// api/cron/run-proactive-generator.js

// Importamos la lógica que acabamos de exportar
const { generateMissingPlans } = require('../../proactive-generator.js');

export default async function handler(req, res) {
    // Medida de seguridad para que solo Vercel pueda ejecutarlo
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).end('Unauthorized');
    }

    try {
        console.log('Cron Job invocado: Ejecutando el generador proactivo...');
        await generateMissingPlans();
        res.status(200).end('Proactive generator executed successfully.');
    } catch (error) {
        console.error('Error durante la ejecución del Cron Job del generador:', error);
        res.status(500).end('Error executing proactive generator.');
    }
}