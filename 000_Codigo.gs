function doGet() {

  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Motor SIG")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

}