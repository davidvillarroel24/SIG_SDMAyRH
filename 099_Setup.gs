//--------------------------------------------------
// Configuración de columnas por hoja (esquema dinámico)
// Crea/reinicia CONFIGURACION_COLUMNAS con la configuración de
// las unidades ya definidas (UD_RIEGOS, UD_RESIDUOS_SOLIDOS).
// Es un script de configuración: ejecutar manualmente desde el
// editor de Apps Script (seleccionar la función y "Ejecutar"),
// no se llama desde el frontend. Es idempotente: se puede volver
// a correr después de ajustar los valores de abajo — pero OJO,
// hace `sh.clear()` y reescribe toda la hoja, así que cualquier
// edición manual hecha directo en CONFIGURACION_COLUMNAS desde la
// última vez que se corrió esto se pierde.
//--------------------------------------------------

function SIG_Setup_ConfiguracionColumnas(){

    const ss = SIG_getSpreadsheet();

    const nombreHoja = "CONFIGURACION_COLUMNAS";

    let sh = ss.getSheetByName(nombreHoja);

    if(sh){

        sh.clear();

    }
    else{

        sh = ss.insertSheet(nombreHoja);

    }

    const encabezados = [

        "HOJA","COLUMNA","ETIQUETA","TIPO","ROL","REFERENCIA",
        "ESTADISTICA","GRAFICO","UI","ORDEN",
        "VISIBLE_TABLA","VISIBLE_MAPA","VISIBLE_REPORTE"

    ];

    //--------------------------------------------------
    // Piloto: las 32 columnas reales de UD_RIEGOS
    //--------------------------------------------------

    const filas = [

        ["UD_RIEGOS","ID","ID","NUM","PK","","","","HID",0,false,false,false],
        ["UD_RIEGOS","CATEGORIA_ID","Categoría","NUM","FK","CATEGORIAS","","","SEL",10,true,false,false],
        ["UD_RIEGOS","CATEGORIA PROGRAMATICA","Categoría programática","TEXTO","dato","","","","texto",11,false,false,false],
        ["UD_RIEGOS","TRANSFERENCIA","Transferencia","TEXTO","dato","","","","texto",12,false,false,false],
        ["UD_RIEGOS","FASES","Fases","TEXTO","dato","","","","texto",13,false,false,false],
        ["UD_RIEGOS","SISIN","SISIN","TEXTO","dato","","","","texto",20,true,false,true],
        ["UD_RIEGOS","NOMBRE_DEL_PROYECTO","Proyecto","TEXTO","dato","","","","texto",1,true,true,true],
        ["UD_RIEGOS","PROGRAMA","Programa","TEXTO","dato","","","","SEL",21,true,false,true],
        ["UD_RIEGOS","ENTIDAD_EJECUTORA","Entidad ejecutora","TEXTO","dato","","","","SEL",22,true,false,true],
        ["UD_RIEGOS","DEPARTAMENTOS","Departamento","TEXTO","dato","","","","HID",23,false,false,false],
        ["UD_RIEGOS","REGIONES_ID","Región","TEXTO","FK","REGIONES","","","SEL",2,true,true,true],
        ["UD_RIEGOS","PROVINCIAS_ID","Provincia","TEXTO","FK","PROVINCIAS","","","SEL",3,true,true,true],
        ["UD_RIEGOS","MINICIPIOS_ID","Municipio","TEXTO","FK","MUNICIPIOS","","","SEL",4,true,true,true],
        ["UD_RIEGOS","FAMILIAS_BENEIFICIADA","Familias beneficiadas","NUM","dato","","SUM","BAR","texto",30,true,false,true],
        ["UD_RIEGOS","AREA_DE_RIEGO","Área de riego (ha)","DEC","dato","","SUM","BAR","texto",31,true,false,true],
        ["UD_RIEGOS","TIPO_DE_PROYECTO","Tipo de proyecto","TEXTO","dato","","","PIE","SEL",5,true,false,true],
        ["UD_RIEGOS","COSTO_TOTAL","Costo total","DEC","dato","","SUM","BAR","texto",32,true,false,true],
        ["UD_RIEGOS","CONTRAPARTE_GADC","Contraparte GADC","DEC","dato","","SUM","","texto",33,false,false,true],
        ["UD_RIEGOS","COTRAPARTE_GAM","Contraparte GAM","DEC","dato","","SUM","","texto",34,false,false,true],
        ["UD_RIEGOS","EJECUCION_FISICA (%)","Ejecución física (%)","DEC","dato","","AVG","BAR","texto",40,true,false,true],
        ["UD_RIEGOS","EJECUCION_FINANCIERA(%)","Ejecución financiera (%)","DEC","dato","","AVG","BAR","texto",41,true,false,true],
        ["UD_RIEGOS","ORDEN_DE_PROCEDER","Orden de proceder","FECHA","dato","","","","texto",50,false,false,true],
        ["UD_RIEGOS","FECHA_DE_CONCLUCION","Fecha de conclusión","FECHA","dato","","","","texto",51,false,false,true],
        ["UD_RIEGOS","PLAZO","Plazo (días)","NUM","dato","","AVG","","texto",52,false,false,true],
        ["UD_RIEGOS","ESTADO_DEL_PROYECTO","Estado","TEXTO","dato","","","PIE","SEL",6,true,true,true],
        ["UD_RIEGOS","GESTION","Gestión","NUM","dato","","","BAR","SEL",7,true,false,true],
        ["UD_RIEGOS","CIERRE_CONTABLE","Cierre contable","TEXTO","dato","","","","texto",53,false,false,true],
        ["UD_RIEGOS","SIG_GEOMETRIAS_ID","Geometría","NUM","FK","SIG_GEOMETRIAS","","","HID",998,false,false,false],
        ["UD_RIEGOS","LONGITUD","Longitud","DEC","dato","","","","HID",997,false,false,false],
        ["UD_RIEGOS","LATITUD","Latitud","DEC","dato","","","","HID",996,false,false,false],
        ["UD_RIEGOS","DOCUMENTOS_ID","Documentos","NUM","FK","DOCUMENTOS","","","HID",999,false,false,false],
        ["UD_RIEGOS","OBSERVACIONES","Observaciones","TEXTO","dato","","","","texto",60,false,false,true],

        //--------------------------------------------------
        // Las 15 columnas reales de UD_RESIDUOS_SOLIDOS. A
        // diferencia de UD_RIEGOS, acá REGIONES/PROVINCIAS/
        // MUNICIPIOS no llevan sufijo "_ID" (son los nombres
        // reales de columna en la hoja). "URBANO_TONALEDAS" no
        // es un error de tipeo nuestro: así está escrito el
        // encabezado real en la hoja, hay que respetarlo tal
        // cual para que SIG_getRows encuentre la columna.
        //--------------------------------------------------

        ["UD_RESIDUOS_SOLIDOS","ID","ID","NUM","PK","","","","HID",0,false,false,false],
        ["UD_RESIDUOS_SOLIDOS","BOTADERO","Botadero","TEXTO","dato","","","","texto",1,true,true,true],
        ["UD_RESIDUOS_SOLIDOS","REGIONES","Región","TEXTO","FK","REGIONES","","","SEL",2,true,true,true],
        ["UD_RESIDUOS_SOLIDOS","PROVINCIAS","Provincia","TEXTO","FK","PROVINCIAS","","","SEL",3,true,true,true],
        ["UD_RESIDUOS_SOLIDOS","MUNICIPIOS","Municipio","TEXTO","FK","MUNICIPIOS","","","SEL",4,true,true,true],
        ["UD_RESIDUOS_SOLIDOS","LICENCIA","Licencia","TEXTO","dato","","","PIE","SEL",5,true,false,true],
        ["UD_RESIDUOS_SOLIDOS","RIESGO","Riesgo","TEXTO","dato","","","PIE","SEL",6,true,true,true],
        ["UD_RESIDUOS_SOLIDOS","AREA_HA","Área (ha)","DEC","dato","","SUM","BAR","texto",10,true,false,true],
        ["UD_RESIDUOS_SOLIDOS","URBANO_TONALEDAS","Toneladas urbanas","DEC","dato","","SUM","BAR","texto",11,true,false,true],
        ["UD_RESIDUOS_SOLIDOS","RURAL_TONELADAS","Toneladas rurales","DEC","dato","","SUM","BAR","texto",12,true,false,true],
        ["UD_RESIDUOS_SOLIDOS","TOTAL_TONELADAS","Toneladas totales","DEC","dato","","SUM","BAR","texto",13,true,false,true],
        ["UD_RESIDUOS_SOLIDOS","SITUACION_ACTUAL","Situación actual","TEXTO","dato","","","","texto",20,false,false,true],
        ["UD_RESIDUOS_SOLIDOS","PROYECTO","Proyecto (detalle)","TEXTO","dato","","","","texto",21,false,false,true],
        ["UD_RESIDUOS_SOLIDOS","SIG_GEOMETRIAS_ID","Geometría","NUM","FK","SIG_GEOMETRIAS","","","HID",998,false,false,false],
        ["UD_RESIDUOS_SOLIDOS","DOCUMENTOS_ID","Documentos","NUM","FK","DOCUMENTOS","","","HID",999,false,false,false]

    ];

    sh.getRange(1,1,1,encabezados.length).setValues([encabezados]);

    sh.getRange(2,1,filas.length,encabezados.length).setValues(filas);

    sh.setFrozenRows(1);

    // Sin esto, correr el setup de nuevo (para agregar/ajustar una
    // columna) no se nota hasta 6h después: SIG_UD_getSchema cachea
    // el esquema viejo y sigue sirviéndolo. Se invalida acá, no
    // adentro de SIG_UD_getSchema, porque el que sabe cuándo cambió
    // CONFIGURACION_COLUMNAS es este setup, no cada lectura.

    const hojasTocadas = [...new Set(filas.map(fila => fila[0]))];

    hojasTocadas.forEach(hoja=>{

        SIG_Cache_remove("ud_schema_" + hoja);

    });

    Logger.log(

        "CONFIGURACION_COLUMNAS creada con " +
        filas.length +
        " filas (UD_RIEGOS + UD_RESIDUOS_SOLIDOS). Cache de esquema invalidada para: " +
        hojasTocadas.join(", ")

    );

}

//--------------------------------------------------
// Prueba manual de SIG_UD_get.
// El botón "Ejecutar" del editor no permite pasar argumentos,
// siempre llama a la función seleccionada sin parámetros — por
// eso esta función envoltorio no recibe nada, deja el nombre de
// la hoja fijo adentro. Seleccionar SIG_Test_UD_RIEGOS en el
// desplegable y Ejecutar, después revisar Ver > Registros.
//--------------------------------------------------

function SIG_Test_UD_RIEGOS(){

    const resultado = SIG_UD_get("UD_RIEGOS");

    Logger.log(

        "Columnas en el esquema: " + resultado.schema.length

    );

    Logger.log(

        "Filas leídas: " + resultado.rows.length

    );

    Logger.log(resultado.schema);

    Logger.log(resultado.rows[0]);

}

//--------------------------------------------------
// Diagnóstico: lee CONFIGURACION_COLUMNAS tal cual está
// en la hoja, sin pasar por SIG_UD_getSchema ni por cache,
// para ver exactamente qué valores tiene la columna HOJA.
//--------------------------------------------------

function SIG_Test_ConfiguracionColumnas(){

    const rows = SIG_getRows("CONFIGURACION_COLUMNAS");

    Logger.log(

        "Filas totales en CONFIGURACION_COLUMNAS: " + rows.length

    );

    if(!rows.length){

        return;

    }

    Logger.log(

        "Encabezados detectados: " +
        Object.keys(rows[0]).join(", ")

    );

    Logger.log(

        "Valores de HOJA (uno por fila): " +
        JSON.stringify(rows.map(r => r.HOJA))

    );

}

//--------------------------------------------------
// Limpia la cache de UD_RIEGOS (esquema y filas).
// Correr esto después de corregir CONFIGURACION_COLUMNAS,
// antes de volver a probar SIG_Test_UD_RIEGOS — si no, el
// resultado viejo (aunque esté vacío) puede seguir cacheado.
//--------------------------------------------------

function SIG_Cache_resetUD_RIEGOS(){

    SIG_Cache_remove("ud_schema_UD_RIEGOS");

    SIG_Cache_remove("ud_rows_UD_RIEGOS");

    Logger.log("Cache de UD_RIEGOS limpiada.");

}
