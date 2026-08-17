

//--------------------------------------------------
// Obtener Spreadsheet
//--------------------------------------------------

function SIG_getSpreadsheet(){

    return SpreadsheetApp.openById(

        SIG_DB.SPREADSHEET_ID

    );

}

//--------------------------------------------------
// Leer una tabla
//--------------------------------------------------

//--------------------------------------------------
//SIG_Drive_getGeoJson
//SIG_Config_getLayerConfig
function SIG_Config_getLayerConfig(sheetName){

    const sh = SIG_getSpreadsheet()

        .getSheetByName(sheetName);

    if(!sh){

        throw new Error(

            "No existe la hoja: " + sheetName

        );

    }

    const values = sh.getDataRange().getValues();

    if(values.length <= 1){

        return [];

    }

    values.shift();

    return values.map(row=>({

        id       : row[0],

        nombre   : row[1],

        file_id  : row[2],

        estilo   : row[3],

        visible  : row[4]

    }));

}

function SIG_Config_getMunicipios(){

    return SIG_Config_read(

        SIG_SHEETS.MUNICIPIOS

    );

}

function SIG_getRows(sheetName){

    const sh = SIG_getSpreadsheet()

        .getSheetByName(sheetName);

    if(!sh){

        throw new Error(

            "No existe la hoja: " +

            sheetName

        );

    }

    const values = sh.getDataRange().getValues();

    if(values.length<=1){

        return [];

    }

    //--------------------------------------------------
    // Encabezados
    //--------------------------------------------------

    const headers = values.shift();

    //--------------------------------------------------
    // Filas -> Objetos
    //--------------------------------------------------

    return values.map(row=>{

        const obj = {};

        headers.forEach((header,index)=>{

            obj[header]=row[index];

        });

        return obj;

    });

}