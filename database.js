
require('dotenv').config();
const { MongoClient } = require('mongodb');

if (!process.env.MONGODB_URI) {
    throw new Error('La variable de entorno MONGODB_URI no está definida.');
}

const client = new MongoClient(process.env.MONGODB_URI);
let dbInstance = null;

/**
 * Se conecta a la base de datos MongoDB y devuelve la instancia de la base de datos.
 * Implementa un patrón singleton para reutilizar la conexión existente.
 * @returns {Promise<Db>} Instancia de la base de datos (db).
 */
async function connectToDatabase() {
    if (dbInstance) {
        return dbInstance;
    }
    try {
        await client.connect();
        console.log("Conectado a la base de datos MongoDB.");
        dbInstance = client.db(); // Asume que el nombre de la DB está en la URI
        return dbInstance;
    } catch (error) {
        console.error("No se pudo conectar a la base de datos:", error);
        process.exit(1);
    }
}

module.exports = { connectToDatabase };
