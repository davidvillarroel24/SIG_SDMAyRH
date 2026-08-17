//--------------------------------------------------
// Leer GeoJSON desde Drive
//--------------------------------------------------

function SIG_Drive_read(fileId){

    return JSON.parse(

        DriveApp
            .getFileById(fileId)
            .getBlob()
            .getDataAsString()

    );

}