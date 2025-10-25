import fs from "fs/promises";
import path from "path";
import { ConfigFile, GenericObject, TemplateFiles } from "./types";
import Handlebars from "handlebars";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import _ from "lodash";
import { marked } from "marked";

export const templateFilenames: TemplateFiles = {
    style: "style.css",
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
    operationParametersHeader: "operation-parameters-header.hbs",
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

    throw new Error(
        `Template ${templatePath} not found in cwd() or built-in templates`,
    );
}

/**
 * Load the template files content from the given template path
 * @param templatePath
 * @returns
 */
export async function loadTemplateFiles(
    templatePath: string,
): Promise<TemplateFiles> {
    const templates: TemplateFiles = { ...templateFilenames };

    // load the templates
    for (const _key in templates) {
        const key = _key as keyof TemplateFiles;
        templates[key] = await fs
            .readFile(path.join(templatePath, templates[key]))
            .then((data) => data.toString());
    }

    templatePath = templatePath.replace(/\//g, "\\");

    // resolves "url(...)" in css to base64 data urls
    const regex = /url\(['"]([^'")]+)['"]\)/gm;
    const matcher = templates.style.matchAll(regex);
    for (const match of matcher) {
        const originalUrl = match[1];
        if (originalUrl) {
            const fileBufer = await fs.readFile(
                path.join(templatePath, originalUrl),
            );
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
                const fileBufer = await fs.readFile(
                    path.join(templatePath, originalSrc),
                );
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
 * Preprocess a parameter object to extract useful information for templating
 *
 * @param parameter
 * @param openApiSpecJson
 * @returns
 */
function preprocessParameter(
    inutParameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject,
    openApiSpecJson: OpenAPIV3.Document,
): Object {
    let schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined;
    let parameter: OpenAPIV3.ParameterObject | undefined;
    // Resolve $ref if present
    if (Object.hasOwn(inutParameter, "$ref")) {
        const parameterRef = inutParameter as OpenAPIV3.ReferenceObject;
        const pathParts = parameterRef.$ref.split("/");
        if (pathParts[0] === "#") {
            parameter = _.cloneDeep(_.get(openApiSpecJson, pathParts.slice(1)));
        }
    }

    if (!parameter) return { parameter: inutParameter };

    schema = _.cloneDeep(parameter.schema);
    if (!schema) return { parameter: parameter };
    if (schema && Object.hasOwn(schema, "$ref")) {
        return { parameter: parameter };
    }

    const { type, ...schemaObjectWithoutType } =
        schema as OpenAPIV3.SchemaObject;
    return {
        parameter: {
            ...parameter,
            description: parameter.description ? marked.parse(parameter.description || ""): undefined,
            type: type,
            isArray: type === "array",
            schema: JSON.stringify(schemaObjectWithoutType, null, 2),
        },
    };
}

/**
 * Process the OpenAPI specification V3.0.0 and build the template content
 * @param openApiSpecJson
 */
function buildOpenApiTemplateV3(
    configFile: ConfigFile,
    templates: TemplateFiles,
    openApiSpecJson: OpenAPIV3.Document,
): string {
    const renderedOperations: string[] = [];

    // prepare some templates to be used during rendering
    const operationTemplate = Handlebars.compile(templates.operation);
    const operationParametersTemplate = Handlebars.compile(
        templates.operationParameter,
    );
    const operationParametersHeaderTemplate = Handlebars.compile(
        templates.operationParametersHeader,
    );

    // Start rendering operations
    for (const path in openApiSpecJson.paths) {
        const pathItem = openApiSpecJson.paths[path];
        // this is only for type checking
        if (!pathItem) continue;

        for (const method of [
            "get",
            "post",
            "put",
            "delete",
            "patch",
            "options",
            "head",
            "trace",
        ]) {
            // ignore if the method does not exist on the path item
            if (!(method in pathItem)) continue;

            const operation = (pathItem as any)[method];

            // process the parameters
            const parametersHtml: string[] = [];
            if (operation.parameters && Array.isArray(operation.parameters)) {
                for (const parameter of operation.parameters) {
                    const parameterHtml = operationParametersTemplate(
                        preprocessParameter(parameter, openApiSpecJson),
                    );
                    parametersHtml.push(parameterHtml);
                }
            }

            const parametersHeaderHtml = operationParametersHeaderTemplate({});

            const operationHtml = operationTemplate({
                operation: {
                    ...operation,
                    parameters:
                        parametersHtml.length > 0
                            ? parametersHtml.join("\n")
                            : undefined,
                    parametersHeader: parametersHeaderHtml,
                },
                path: path,
                method: method.toUpperCase(),
            });

            renderedOperations.push(operationHtml);
        }
    }

    return renderedOperations.join("\n");
}

/**
 * Process the OpenAPI specification V3.1.0 and build the template content
 * @param openApiSpecJson
 */
function buildOpenApiTemplateV3_1(
    configFile: ConfigFile,
    templates: TemplateFiles,
    openApiSpecJson: OpenAPIV3_1.Document,
): string {
    return "bbb";
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
): Promise<string> {
    // Generate the handlebars template for the OpenAPI spec
    let openApiSpectHbs = "";
    switch (openApiSpecJson.openapi.split(".").slice(0, 2).join(".")) {
        case "3.0":
            openApiSpectHbs = buildOpenApiTemplateV3(
                configFile,
                templates,
                openApiSpecJson as OpenAPIV3.Document,
            );
            break;
        case "3.1":
            openApiSpectHbs = buildOpenApiTemplateV3_1(
                configFile,
                templates,
                openApiSpecJson as OpenAPIV3_1.Document,
            );
            break;
        default:
            throw new Error(
                `OpenAPI version ${openApiSpecJson.openapi} not supported`,
            );
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
        openApiSpectHbs,
        templates.lastpage,
        "</body>",
        "</html>",
    ].join("\n");

    // effectively render the template
    const template = Handlebars.compile(finalTemplate);

    return template({
        metadata: configFile.metadata,
        openApiUrl: configFile.openApiUrl,
    });
}
