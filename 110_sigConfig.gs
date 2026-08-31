

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
// Config de capa base (REGIONES/PROVINCIAS/MUNICIPIOS). Antes
// leía por POSICIÓN (row[0], row[1]...) — al agregarle a
// PROVINCIAS/MUNICIPIOS las columnas region_id/Provincia_id
// (para el filtro en cascada) todo lo que venía después se
// corrió de lugar, y `file_id` terminaba leyendo el valor de
// `region_id` (un número chico, ej. "5") en vez del ID real de
// Drive — de ahí el "ID de archivo o carpeta no válido: 5".
// Ahora lee por nombre de columna (como SIG_getRows), así que
// agregar columnas nuevas en cualquier posición no rompe esto.
//--------------------------------------------------

function SIG_Config_getLayerConfig(sheetName){

    return SIG_getRows(sheetName).map(row=>({

        id       : row.ID,

        nombre   : row.nombre,

        file_id  : row.file_id,

        estilo   : row.estilo,

        visible  : row.visible

    }));

}

function SIG_Config_getMunicipios(){

    return SIG_Config_read(

        SIG_SHEETS.MUNICIPIOS

    );

}

//--------------------------------------------------
// Insertar o actualizar una fila en cualquier hoja, por nombre
// de columna (no por posición) — motor genérico de escritura,
// contraparte de SIG_getRows. Si `datos.ID` viene con valor,
// actualiza esa fila (solo pisa las columnas presentes en
// `datos`, deja el resto tal cual); si no, calcula el próximo
// ID (max existente + 1) e inserta una fila nueva. Todo dentro
// de un lock para que dos guardados a la vez no pisen el mismo
// ID.
//--------------------------------------------------

function SIG_saveRow(sheetName, datos){

    const lock = LockService.getScriptLock();

    lock.waitLock(30000);

    try{

        const sh = SIG_getSpreadsheet().getSheetByName(sheetName);

        if(!sh){

            throw new Error("No existe la hoja: " + sheetName);

        }

        const encabezados = sh

            .getRange(1, 1, 1, sh.getLastColumn())

            .getValues()[0];

        const idxID = encabezados.indexOf("ID");

        if(idxID === -1){

            throw new Error(

                "La hoja " + sheetName + " no tiene columna ID."

            );

        }

        const cantidadFilas = sh.getLastRow() - 1;

        const filas = cantidadFilas > 0

            ? sh.getRange(2, 1, cantidadFilas, encabezados.length).getValues()

            : [];

        //--------------------------------------------------
        // Actualizar fila existente
        //--------------------------------------------------

        if(datos.ID){

            const indice = filas.findIndex(

                fila => String(fila[idxID]) === String(datos.ID)

            );

            if(indice === -1){

                throw new Error(

                    "No se encontró la fila con ID " +
                    datos.ID +
                    " en " +
                    sheetName

                );

            }

            const filaActual = filas[indice];

            encabezados.forEach((encabezado, col)=>{

                if(encabezado !== "ID" && encabezado in datos){

                    filaActual[col] = datos[encabezado];

                }

            });

            sh.getRange(

                indice + 2, 1, 1, encabezados.length

            ).setValues([filaActual]);

            return{ ID: datos.ID };

        }

        //--------------------------------------------------
        // Insertar fila nueva
        //--------------------------------------------------

        const idsExistentes = filas

            .map(fila => Number(fila[idxID]))

            .filter(valor => !isNaN(valor));

        const nuevoID = idsExistentes.length

            ? Math.max(...idsExistentes) + 1

            : 1;

        const nuevaFila = encabezados.map(encabezado=>

            encabezado === "ID"

                ? nuevoID

                : (datos[encabezado] ?? "")

        );

        sh.appendRow(nuevaFila);

        return{ ID: nuevoID };

    }
    finally{

        lock.releaseLock();

    }

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