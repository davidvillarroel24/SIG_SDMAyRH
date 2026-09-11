function doGet() {

  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle("SIG SDMAyRH")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

}