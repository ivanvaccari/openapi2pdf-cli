import { ConfigFile, RenderedHtmlContent } from "./types";
import puppeteer from "puppeteer";

/**
 * Renders the given HTML content to PDF using puppeteer
 *
 * @param content the rendered html content
 * @param configFile
 * @returns
 */
export async function renderPdf(
    content: RenderedHtmlContent,
    configFile: ConfigFile,
): Promise<Buffer> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(content.body);

    // Replace comments in header and footer. If empty, no header/footer will be rendered.
    const stripHtmlTagsRegex = /<!--[\s\S]*?(?:-->)/g;
    const headerHtml = (content.header || "")
        .replace(stripHtmlTagsRegex, "")
        .trim();
    const footerHtml = (content.footer || "")
        .replace(stripHtmlTagsRegex, "")
        .trim();

    // Render the PDF
    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        headerTemplate: headerHtml,
        footerTemplate: footerHtml,
        displayHeaderFooter: !!(headerHtml || footerHtml),
        timeout: 180000,
        margin: {
            top: "15mm",
            right: "15mm",
            bottom: "15mm",
            left: "15mm",
        },
        ...configFile.pdfOptions,
    });

    await browser.close();

    return Buffer.from(pdfBuffer);
}
