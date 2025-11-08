import fs from "fs/promises";
import path from "path";
import { ConfigFile, TemplateFiles } from "./types";
import Handlebars from "handlebars";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { OpenApiV3Render } from "./lib/open-api-v3-render";
import { compile } from "sass";
import { OpenApiV3_1Render } from "./lib/open-api-v3_1-render";
import { paperSizes } from "./lib/paper-sizes";

export const templateFilenames: TemplateFiles = {
    style: "style.scss",
    header: "header.hbs",
    footer: "footer.hbs",
    frontpage: "frontpage.hbs",
    lastpage: "lastpage.hbs",
    revisions: "revisions.hbs",
    summary: "summary.hbs",
    assumptions: "assumptions.hbs",
    authentication: "authentication.hbs",
    operation: "operation.hbs",
    operationParameter: "operation-parameter.hbs",
    operationResponse: "operation-response.hbs",
    operationResponseContentType: "operation-response-content-type.hbs",
    tocLine: "toc-line.hbs",
    toc: "toc.hbs",
    api: "api.hbs",
    schemas: "schemas.hbs",
    tocTag: "toc-tag.hbs",
    operationBody: "operation-body.hbs",
};

/**
 * Load the template files content from the given template path
 * @param templatePath
 * @returns
 */
export async function loadTemplateFiles(configFile: ConfigFile): Promise<TemplateFiles> {

    console.log("Loading template files...");
    // default to "postman" template if not provided
    if (!configFile.template) {
        console.warn(`No template specified, falling back to "postman"`);
        configFile.template = "postman";
    }

    const testPaths: string[] = [];

    try {
        const _tmp = path.join(process.cwd(), configFile.template);
        await fs.stat(_tmp);
        testPaths.push(_tmp);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
        // eslint says "empty block statement". Well, this comment makes it not empty anymore ...eheheh
    }

    try {
        const _tmp = path.join(__dirname, "../templates/", configFile.template);
        await fs.stat(_tmp);
        testPaths.push(_tmp);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
        // eslint says "empty block statement". Well, this comment makes it not empty anymore ...eheheh
    }

    const _findFilePath = async (templateName: string): Promise<string> => {
        for (const testPath of testPaths) {
            const fullPath = path.join(testPath, templateName);
            try {
                await fs.stat(fullPath);
                console.log(`Found template ${templateName} at ${fullPath}`);
                return fullPath;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (err) {
                // eslint says "empty block statement". Well, this comment makes it not empty anymore ...eheheh
            }
        }
        throw new Error(`Template ${templateName} not found in any of the template paths tried`);
    };

    const templates: TemplateFiles = { ...templateFilenames };

    // load the templates
    for (const _key in templates) {
        const key = _key as keyof TemplateFiles;

        // Ignore style here, it will be processed later
        if (key === "style") continue;

        const contentBuffer = await fs.readFile(await _findFilePath(templates[key]));
        templates[key] = contentBuffer.toString();
    }

    // Try to load and process style
    // Use sass to compile style to css
    const cssFilePath = await _findFilePath(templates.style);
    templates.style = compile(cssFilePath).css;

    // templatePath = templatePath.replace(/\//g, "\\");

    // resolves "url(...)" in css to base64 data urls
    // url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...)
    // so there's no problems with paths later
    const regex = /url\(['"]([^'")]+)['"]\)/gm;
    const matcher = templates.style.matchAll(regex);
    for (const match of matcher) {
        const originalUrl = match[1];
        if (originalUrl) {
            try {
                const fileBufer = await fs.readFile(await _findFilePath(originalUrl));
                const base64Data = fileBufer.toString("base64");
                const ext = path.extname(originalUrl).substring(1);
                const dataUrl = `data:image/${ext};base64,${base64Data}`;
                templates.style = templates.style.replace(originalUrl, dataUrl);
            } catch (err: any) {
                console.warn(`Warning: could not resolve url(${originalUrl}): ${err.message}`);
            }
        }
    }

    // resolves "<img src="...">" in tempates to base64 imgs
    // <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...)
    // so there's no problems with paths later
    const imgRegex = /<img\s+[^>]*src=['"]([^'"]+)['"][^>]*>/gm;
    for (const key of Object.keys(templates) as (keyof TemplateFiles)[]) {
        const templateContent = templates[key];
        const imgMatcher = templateContent.matchAll(imgRegex);
        for (const match of imgMatcher) {
            const originalSrc = match[1];
            if (originalSrc) {
                try {
                    const fileBufer = await fs.readFile(await _findFilePath(originalSrc));
                    const base64Data = fileBufer.toString("base64");
                    const ext = path.extname(originalSrc).substring(1);
                    const dataUrl = `data:image/${ext};base64,${base64Data}`;
                    templates[key] = templates[key].replace(originalSrc, dataUrl);
                } catch (err: any) {
                    console.warn(`Warning: could not resolve <img src="${originalSrc}">: ${err.message}`);
                }
            }
        }
    }

    return templates;
}

/**
 * Renders HTML content using Handlebars template engine.
 *
 * @param templateContent
 * @param data
 */
export async function renderHtml(
    configFile: ConfigFile,
    templates: TemplateFiles,
    openApiSpecJson: OpenAPIV3.Document | OpenAPIV3_1.Document,
): Promise<{ body: string; header: string; footer: string }> {
    // preventively resolve all $ref in the OpenAPI spec so we now can assume all schemas contains the direct values
    // instead of having to resolve them during templating
    // openApiSpecJson = resolveRefs(_.cloneDeep(openApiSpecJson) as OpenAPIV3.Document);

    // Generate the handlebars template for the OpenAPI spec
    let openApiSpectHtml = "";
    let tocHtml = "";
    let schemasHtml = "";

    switch (openApiSpecJson.openapi.split(".").slice(0, 2).join(".")) {
        case "3.0": {
            const r = new OpenApiV3Render(configFile, templates, openApiSpecJson as OpenAPIV3.Document);
            openApiSpectHtml = await r.render();
            tocHtml = await r.renderToc();
            schemasHtml = await r.renderSchemas();
            break;
        }
        case "3.1": {
            const r = new OpenApiV3_1Render(configFile, templates, openApiSpecJson as OpenAPIV3_1.Document);
            openApiSpectHtml = await r.render();
            tocHtml = await r.renderToc();
            schemasHtml = await r.renderSchemas();
            break;
        }
        default:
            throw new Error(`OpenAPI version ${openApiSpecJson.openapi} not supported`);
    }

    // Add CSS to prevent auto-scaling
    // format is A4 by default
    const format = (configFile.pdfOptions?.format || "A4") as keyof typeof paperSizes;
    const scale = configFile.pdfOptions?.scale || 1;
    const pageFormat = paperSizes[format]
    if (!pageFormat) {
        throw new Error(`Unsupported paper format: ${format}`);
    }
    if (!pageFormat.mm) {
        throw new Error(`Unsupported paper format: ${format}`);
    }

    const mmWidth = pageFormat.mm![0]! / scale +3;
    const mmHeight = pageFormat.mm![1]! / scale + 3;
    
    const mediaPrintCss = `
            @media print {
                html, body {
                    width: ${mmWidth}mm !important;
                    max-width: ${mmHeight}mm !important;
                    overflow-x: auto !important;
                }
                /** {
                    max-width: 100% !important;
                    word-wrap: break-word !important;
                    overflow-wrap: break-word !important;
                }*/
            }
        `

    // append all together
    const finalTemplate = [
        "<html>",
        "<head>",
        "<style>",
        mediaPrintCss,
        templates.style,
        "</style>",
        "</head>",
        "<body>",
        templates.frontpage,
        templates.revisions,
        templates.summary,
        templates.authentication,
        templates.assumptions,
        tocHtml,
        openApiSpectHtml,
        schemasHtml,
        templates.lastpage,
        "</body>",
        "</html>",
    ].join("\n");

    // effectively render the template
    const template = Handlebars.compile(finalTemplate);

    const body = template({
        metadata: configFile.metadata,
        openApiSpecJson: openApiSpecJson,
        openapiJsonPath: configFile.openapiJsonPath,
    });

    const header = Handlebars.compile(templates.header)({
        metadata: configFile.metadata,
        openapiJsonPath: configFile.openapiJsonPath,
    });

    const footer = Handlebars.compile(templates.footer)({
        metadata: configFile.metadata,
        openapiJsonPath: configFile.openapiJsonPath,
    });

    return {
        body: body,
        header: header,
        footer: footer,
    };
}
