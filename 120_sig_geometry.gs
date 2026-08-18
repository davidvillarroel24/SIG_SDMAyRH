function SIG_Geometrias_list(){

    const rows = SIG_getRows(

        "SIG_GEOMETRIAS"

    );


    Logger.log(rows);

    Logger.log(rows[0]);

    Logger.log(rows[0].GEOJSON);
    

    return rows.map(item=>({

        id:item.ID,

        capa_id:item.CAPA_ID,

        estilo_id:item.ESTILO_ID,

        tipo:item.TIPO_ID,

        feature:JSON.parse(

            item.GEOJSON

        ),

        nombre:item.NOMBRE,

        descripcion:item.DESCRIPCION,

        estado:item.ESTADO,

        eliminado:item.ELIMINADO

    }));

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