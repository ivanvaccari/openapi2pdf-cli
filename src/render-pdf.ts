import { ConfigFile, RenderedHtmlContent } from "./types";
import puppeteer from "puppeteer";

/**
 * Renders the given HTML content to PDF using puppeteer
 *
 * @param content the rendered html content
 * @param configFile
 * @returns
 */
export async function renderPdf(content: RenderedHtmlContent, configFile: ConfigFile): Promise<Buffer> {
    console.log("Launching puppeteer to render PDF");
    console.log("This might take a while depending on the size of the document");
    let elapsedSeconds = 0;

    // 33.6 MB html -> 1500 seconds on my crappy laptop (for 50mb pdf )
    const interval = setInterval(() => {
        process.stdout.write(".");
        elapsedSeconds++;
        if (elapsedSeconds % 20 === 0) {
            console.log(`Elapsed time: ${elapsedSeconds} seconds`);
        }
    }, 1000);

    const browser = await puppeteer.launch({
        protocolTimeout: configFile.pdfOptions?.timeout ?? 3600 * 1000, // default to 1 hour if not specified
    });
    const page = await browser.newPage();

     // Set viewport to prevent auto-scaling
    /*await page.setViewport({
        width: 794,   // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        deviceScaleFactor: 1,
    });*/


    await page.setContent(content.body);

    // Replace comments in header and footer. If empty, no header/footer will be rendered.
    const stripHtmlTagsRegex = /<!--[\s\S]*?(?:-->)/g;
    const headerHtml = (content.header || "").replace(stripHtmlTagsRegex, "").trim();
    const footerHtml = (content.footer || "").replace(stripHtmlTagsRegex, "").trim();

    // Render the PDF
    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        headerTemplate: headerHtml,
        footerTemplate: footerHtml,
        displayHeaderFooter: !!(headerHtml || footerHtml),
        timeout: 3600 * 1000, // 1 hour timeout, basically ignore any timeout

        margin: {
            top: "15mm",
            right: "15mm",
            bottom: "15mm",
            left: "15mm",
        },
        ...configFile.pdfOptions,
    });

    await browser.close();

    const buffer = Buffer.from(pdfBuffer);
    clearInterval(interval);
    console.log("");
    console.log("PDF render completed ");
    return buffer;
}
