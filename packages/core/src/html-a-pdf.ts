import { chromium } from "playwright";

/**
 * Convierte HTML a PDF vía Chromium headless (Playwright) — ver
 * domain/generacion-documentos.md. Lanza y cierra el navegador por cada
 * llamada (simplicidad ante todo; si el volumen de generaciones lo justifica
 * en el futuro, se puede pasar a un browser compartido de vida más larga).
 */
export async function htmlAPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return pdf;
  } finally {
    await browser.close();
  }
}
