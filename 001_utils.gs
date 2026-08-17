/**
 * Incluye un archivo HTML dentro de otro.
 */
function include(nombre) {
  return HtmlService
    .createHtmlOutputFromFile(nombre)
    .getContent();
}