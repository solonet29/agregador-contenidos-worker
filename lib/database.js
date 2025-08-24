// lib/database.js
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Define la variable de entorno MONGODB_URI en tu archivo .env');
}

/**
 * Caché global para la promesa del cliente de MongoDB.
 * Esto evita crear una nueva conexión en cada invocación de la función serverless.
 */
let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        // Si ya tenemos una conexión cacheada, la devolvemos.
        return cachedDb;
    }

    // Si no, creamos una nueva conexión.
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(); // Puedes especificar el nombre de tu DB aquí si es necesario

    // Cacheamos la conexión para futuras ejecuciones.
    cachedClient = client;
    cachedDb = db;

    return db;
}