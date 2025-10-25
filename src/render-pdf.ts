import { ConfigFile, GenericObject, TemplateFiles } from "./types";

/**
 * Importing old style because jsreport does not have proper typescript support yet.
 * TODO: FInd another package.
 */
const jsreport = require("@jsreport/jsreport-core")();

/**
 * Converts the given HTML to PDF using jsreport
 *
 * @param html
 * @param configFile
 * @param templatefiles
 */
export async function renderPdf(
    html: string,
    configFile: ConfigFile,
    templatefiles: TemplateFiles,
): Promise<Buffer> {
    jsreport.use(require("@jsreport/jsreport-chrome-pdf")());
    jsreport.use(require("@jsreport/jsreport-handlebars")());
    // jsreport.use(require("@jsreport/jsreport-pdf-utils")());
    
    await jsreport.init();

    // Note: genericObject because typing is incomplete.
    // see https://jsreport.net/learn/pdf-utils
    const pdfOperations: GenericObject[] = [];

    if (templatefiles.header) {
        pdfOperations.push({
            type: "merge",
            mergeWholeDocument: true,
            renderForEveryPage: false,
            enabled: true,
            template: {
                content: templatefiles.header,
                engine: "handlebars",
                recipe: "chrome-pdf",
            },
        });
    }

    if (templatefiles.footer) {
        pdfOperations.push({
            type: "merge",
            mergeWholeDocument: true,
            renderForEveryPage: false,
            enabled: true,
            template: {
                content: templatefiles.footer,
                engine: "handlebars",
                recipe: "chrome-pdf",
            },
        });
    }

    const renderConfig = {
        template: {
            content: html,
            // Note: html is already rendered outside with handlebars because we wanted to also have the html on file.
            // rendering it here would not have returned the html.
            // This is why we use the "none" engine.
            engine: "none",
            recipe: "chrome-pdf",
            pdfMeta: {
                title:
                    configFile.metadata?.pdf?.title || "REST API Documentation",
                author: configFile.metadata?.pdf?.author || "",
            },
            pdfOperations: pdfOperations,

            /**
             * Chrome specific pdf options.
             * See
             * - https://jsreport.net/learn/chrome-pdf#options
             * - https://github.com/puppeteer/puppeteer/blob/v1.11.0/docs/api.md#pagepdfoptions
             */
            chrome: configFile.pdfOptions || {},
        }
    };



    console.log("Rendering PDF document, it may take a while...");

    const result = await jsreport.render(renderConfig, {
        metadata: configFile.metadata,
        openApiUrl: configFile.openApiUrl,
    });

    return result.content;
}
