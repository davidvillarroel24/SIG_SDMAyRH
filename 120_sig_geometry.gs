function SIG_Geometrias_list(){

    const rows = SIG_getRows(

        "SIG_GEOMETRIAS"

    );

    return rows

        // Las eliminadas (baja lógica, ver SIG_Geometrias_delete)
        // no se muestran más en el mapa.

        .filter(item => !item.ELIMINADO)

        .map(item=>{

            // Una sola celda GEOJSON vacía/corrupta no debería
            // tirar abajo la carga de las otras 173 — se salta esa
            // fila (con Logger.log) en vez de que el mapa completo
            // quede en blanco por un solo dato malo.

            let feature;

            try{

                feature = JSON.parse(item.GEOJSON);

            }
            catch(error){

                Logger.log(

                    "SIG_GEOMETRIAS id=" + item.ID +
                    ": GEOJSON inválido, se omite. " + error

                );

                return null;

            }

            return{

                id:item.ID,

                capa_id:item.CAPA_ID,

                estilo_id:item.ESTILO_ID,

                tipo:item.TIPO_ID,

                feature:feature,

                nombre:item.NOMBRE,

                descripcion:item.DESCRIPCION,

                estado:item.ESTADO,

                eliminado:item.ELIMINADO

            };

        })

        .filter(item => item !== null);

}

//--------------------------------------------------
// Mapear el tipo de geometría GeoJSON (Point/LineString/Polygon,
// lo que da layer.toGeoJSON()) al ID real de SIG_TIPO (FK
// numérico, ej. 1=POINT). En los 174 registros reales nunca se
// usaron RECTANGLE/CIRCLE/MARKER — todo fue POINT — así que este
// mapeo simple por nombre alcanza; si algún día se dibuja algo
// que no matchea (MultiPolygon, etc.), devuelve null en vez de
// adivinar un número.
//--------------------------------------------------

function SIG_Tipo_getIdPorNombre(nombreGeoJSON){

    const nombre = String(nombreGeoJSON || "").toUpperCase();

    const fila = SIG_getRows("SIG_TIPO").find(

        item => String(item.TIPO).toUpperCase() === nombre

    );

    return fila ? fila.ID : null;

}

//--------------------------------------------------
// Insertar/actualizar una geometría. `geo.id` presente
// (truthy) → actualiza esa fila; ausente → inserta una nueva
// (SIG_saveRow calcula el próximo ID). Devuelve { ID } con el
// id final, para que el frontend pueda vincularlo a un
// registro UD_ (SIG_GEOMETRIAS_ID) recién guardado.
//
// ESTADO ya no se escribe acá: no es un dato que el usuario
// tipee, es "¿esta geometría está vinculada a un registro?" —
// se deriva en el momento (ver SIG_Geometrias_listConRegistros/
// SIG_UD_indiceGeometrias), no se guarda una copia separada que
// se pueda desincronizar del vínculo real (SIG_GEOMETRIAS_ID en
// la hoja UD_).
//--------------------------------------------------

function SIG_Geometrias_save(geo){

    const datos = {

        CAPA_ID     : geo.capa_id,
        ESTILO_ID   : geo.estilo_id,
        TIPO_ID     : SIG_Tipo_getIdPorNombre(geo.tipo),
        GEOJSON     : JSON.stringify(geo.feature),
        NOMBRE      : geo.nombre,
        DESCRIPCION : geo.descripcion,
        ELIMINADO   : geo.eliminado || false

    };

    if(geo.id){

        datos.ID = geo.id;

    }

    return SIG_saveRow("SIG_GEOMETRIAS", datos);

}

//--------------------------------------------------
// Baja lógica de una geometría (no se borra la fila).
//--------------------------------------------------

function SIG_Geometrias_delete(id){

    return SIG_saveRow("SIG_GEOMETRIAS", {

        ID        : id,
        ELIMINADO : true

    });

}

//--------------------------------------------------
// Geometrías + a qué registro de qué unidad pertenece cada una
// (cruce SIG_GEOMETRIAS_ID de las hojas UD_* contra SIG_GEOMETRIAS).
// `registro` queda null si la geometría no está referenciada por
// ninguna fila UD_ (p.ej. una geometría suelta).
//--------------------------------------------------

function SIG_Geometrias_listConRegistros(){

    const indice = SIG_UD_indiceGeometrias();

    return SIG_Geometrias_list().map(item => ({

        ...item,

        registro: indice[item.id] || null

    }));

}