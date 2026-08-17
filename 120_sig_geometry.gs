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