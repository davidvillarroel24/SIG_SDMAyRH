function SIG_Capas_list(){

    const rows = SIG_getRows(

        SIG_SHEETS.CAPAS

    );

    return rows.map(item=>({

        id          : Number(item.ID),

        nombre      : item.NOMBRE,

        descripcion : item.DESCRIPCION,

        visible     : Number(item.VISIBLE) !== 0,

        editable    : Number(item.EDITABLE) !== 0,

        estilo_id   : Number(item.ESTILO_ID),

        orden       : Number(item.ORDEN),

        eliminado   : item.ELIMINADO

    }));

}
