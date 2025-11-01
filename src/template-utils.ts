import fs from "fs/promises";
import path from "path";
import { ConfigFile, TemplateFiles } from "./types";
import Handlebars from "handlebars";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import _ from "lodash";
import { OpenApiV3Render } from "./lib/open-api-v3-render";
import { compile } from "sass";

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
};

/**
 * Find the path where the template is located.
 * If not provided, use the default built-in template "postman"
 *
 * @param templatePath
 * @returns
 */
export async function findTemplatePath(templatePath?: string): Promise<string> {
    if (!templatePath) {
        return path.join(__dirname, "../templates/postman");
    }

    // try to find template in current working directory
    let _tmp = path.join(process.cwd(), templatePath);
    try {
        await fs.stat(_tmp);
        return _tmp;
    } catch (err) {}

    // try to find template in built-in templates directory
    _tmp = path.join(__dirname, "../templates/", templatePath);
    try {
        await fs.stat(_tmp);
        return _tmp;
    } catch (err) {}

    throw new Error(`Template ${templatePath} not found in cwd() or built-in templates`);
}

/**
 * Load the template files content from the given template path
 * @param templatePath
 * @returns
 */
export async function loadTemplateFiles(templatePath: string): Promise<TemplateFiles> {
    const templates: TemplateFiles = { ...templateFilenames };

    const _loadFile = async (filename: string): Promise<string> => {
        return fs.readFile(path.join(templatePath, filename)).then((data) => data.toString());
    };

    // load the templates
    for (const _key in templates) {
        const key = _key as keyof TemplateFiles;

        // Ignore style here, it will be processed later
        if (key === "style") continue;
        templates[key] = await _loadFile(templates[key]);
    }

    // Use sass to compile style.scss to css
    templates.style = compile(path.join(templatePath, templates.style)).css;

    templatePath = templatePath.replace(/\//g, "\\");

    // resolves "url(...)" in css to base64 data urls
    const regex = /url\(['"]([^'")]+)['"]\)/gm;
    const matcher = templates.style.matchAll(regex);
    for (const match of matcher) {
        const originalUrl = match[1];
        if (originalUrl) {
            const fileBufer = await fs.readFile(path.join(templatePath, originalUrl));
            const base64Data = fileBufer.toString("base64");
            const ext = path.extname(originalUrl).substring(1);
            const dataUrl = `data:image/${ext};base64,${base64Data}`;
            templates.style = templates.style.replace(originalUrl, dataUrl);
        }
    }

    // resolves "<img src="...">" in tempates to base64 imgs
    const imgRegex = /<img\s+[^>]*src=['"]([^'"]+)['"][^>]*>/gm;
    for (const key of Object.keys(templates) as (keyof TemplateFiles)[]) {
        const templateContent = templates[key];
        const imgMatcher = templateContent.matchAll(imgRegex);
        for (const match of imgMatcher) {
            const originalSrc = match[1];
            if (originalSrc) {
                const fileBufer = await fs.readFile(path.join(templatePath, originalSrc));
                const base64Data = fileBufer.toString("base64");
                const ext = path.extname(originalSrc).substring(1);
                const dataUrl = `data:image/${ext};base64,${base64Data}`;
                templates[key] = templates[key].replace(originalSrc, dataUrl);
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
            const r = new OpenApiV3Render(configFile, templates, openApiSpecJson as OpenAPIV3.Document);
            openApiSpectHtml = await r.render();
            tocHtml = await r.renderToc();
            schemasHtml = await r.renderSchemas();
            break;
        }
        default:
            throw new Error(`OpenAPI version ${openApiSpecJson.openapi} not supported`);
    }

    // append all together
    const finalTemplate = [
        "<html>",
        "<head>",
        "<style>",
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
