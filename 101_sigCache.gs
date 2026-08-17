//--------------------------------------------------
// Cache de datos del SIG (CacheService de Apps Script).
// Evita releer/reparsear la hoja en cada llamada mientras
// los datos no cambien. Duración máxima de CacheService: 6h.
//--------------------------------------------------

const SIG_CACHE_TTL = 21600; // 6 horas, el máximo que permite CacheService

//--------------------------------------------------
// Obtener valor cacheado (o null si no existe)
//--------------------------------------------------

function SIG_Cache_get(key){

    const raw = CacheService

        .getScriptCache()

        .get(key);

    if(!raw){

        return null;

    }

    return JSON.parse(raw);

}

//--------------------------------------------------
// Guardar valor en cache
//--------------------------------------------------

function SIG_Cache_put(key, value){

    try{

        CacheService

            .getScriptCache()

            .put(

                key,

                JSON.stringify(value),

                SIG_CACHE_TTL

            );

    }
    catch(error){

        // Cada clave de CacheService admite hasta 100KB.
        // Si el valor no entra, seguimos sin cachear en vez de fallar.

        Logger.log(

            "No se pudo cachear '" + key + "': " + error

        );

    }

}

//--------------------------------------------------
// Invalidar una clave de cache
//--------------------------------------------------

function SIG_Cache_remove(key){

    CacheService

        .getScriptCache()

        .remove(key);

}

//--------------------------------------------------
// Leer GeoJSON desde Drive (con cache)
//--------------------------------------------------

function SIG_Drive_getGeoJson(fileId){

    const key = "drive_" + fileId;

    const cached = SIG_Cache_get(key);

    if(cached){

        return cached;

    }

    const data = SIG_Drive_read(fileId);

    SIG_Cache_put(key, data);

    return data;

}
