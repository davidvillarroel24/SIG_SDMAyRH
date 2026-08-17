function SIG_Config_getStyles(){

    const rows = SIG_getRows(

        SIG_SHEETS.ESTILOS

    );
    Logger.log(rows)
    return rows.map(item=>({

        id           : Number(item.ID),

        nombre       : item.NOMBRE,

        color        : item.COLOR,

        fillColor    : item.FILLCOLOR,

        weight       : Number(item.WEIGHT),

        opacity      : Number(item.OPACITY),

        fillOpacity  : Number(item.FILLOPACITY),

        simbolo_id   : Number(item.SIMBOLO_ID)     

    }));

}