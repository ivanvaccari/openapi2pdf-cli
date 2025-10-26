import fs from "fs/promises";
import path from "path";
import { ConfigFile, GenericObject, TemplateFiles } from "./types";
import Handlebars from "handlebars";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import _ from "lodash";
import { marked } from "marked";
import { sample as OpenApiSampler } from "openapi-sampler";


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
    operationResponse: "operation-response.hbs",
    operationResponseContentType: "operation-response-content-type.hbs",
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

    // load the templates
    for (const _key in templates) {
        const key = _key as keyof TemplateFiles;
        templates[key] = await fs.readFile(path.join(templatePath, templates[key])).then((data) => data.toString());
    }

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
 * Generate a more human-readable json schema
 
function renderJsonSchema2(schema: OpenAPIV3.SchemaObject): string {
    if (schema.oneOf) {
        return "oneOf";
    }

    const lines: string[] = [];
    const _iter = (depth: number, parentKey: string, obj: any, required?: string[]) => {
        if (Array.isArray(obj)) {
            lines.push(`${" ".repeat(depth * 2)}${parentKey} [`);
            obj.forEach((item) => _iter(depth + 1, "", item));
            lines.push(`${" ".repeat(depth * 2)}]`);
            return;
        }

        if (obj && typeof obj === "object") {
            const isRequired = required?.includes(parentKey);

            const objWithoutManagedProperties = _.omit(obj, ["type", "description", "required"]);

            // If other properties exist, we have a sub-object
            const subObject = Object.keys(objWithoutManagedProperties).length > 0;

            // If a sub-object exists, we need to open a bracket
            const openBracket = subObject ? " {" : "";

            // type and description becomes a "sort-of" comment for the line
            let descriptionHtml = "";
            if (obj.type || obj.description || isRequired) {
                // This wraps long descriptions into multiple lines
                const prependLength = `${openBracket}${parentKey ?? ""}`.length;
                let descriptionLines = [
                    [isRequired ? "REQUIRED" : "", obj.type || "object", obj.description || ""]
                        .filter((v) => !!v)
                        .join(", "),
                ];
                if (descriptionLines.join("").split(" ").length > 15) {
                    // 15 is an arbitrary length,
                    // join just to reconduct to a simple string
                    const words = descriptionLines.join("").split(" ");
                    descriptionLines = _.chunk(words, 15).map((chunk) => chunk.join(" "));
                }
                for (let i = 0; i < descriptionLines.length; i++) {
                    if (i === 0) {
                        descriptionHtml += ` <span style="color: gray;">// ${descriptionLines[i]}</span>`;
                    } else {
                        descriptionHtml += `<br><span style="color: gray; margin-left: ${depth * 2 + prependLength + 2}ch;">// ${descriptionLines[i]}</span>`;
                    }
                }
            }

            lines.push(`${" ".repeat(depth * 2)}${parentKey}${openBracket} ${descriptionHtml}`);

            // iterate over sub-objects
            for (const key in objWithoutManagedProperties) {
                _iter(depth + 1, key, obj[key], key === "properties" ? obj.required : required);
            }

            // If there was a sub-object, bracket needs to be closed
            if (subObject) lines.push(`${" ".repeat(depth * 2)}}`);
            return;
        }

        lines.push(`${" ".repeat(depth * 2)}${parentKey} ${JSON.stringify(obj)}`);
    };

    _iter(0, "", schema);

    return lines.join("<br>");
}
*/
/**
 *
 */
function renderJsonSchema(name: string, fullSchema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): string {
    if (!fullSchema) return "";

    const schemaHtmlLines: string[] = [];

    const _iter = (schemaOrReference: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => {
        if ((schemaOrReference as OpenAPIV3.ReferenceObject).$ref) {
            schemaHtmlLines.push(`Reference: ${(schemaOrReference as OpenAPIV3.ReferenceObject).$ref}`);
            return;
        }

        // From now on, we can assume it's a schema object
        const schema = schemaOrReference as OpenAPIV3.SchemaObject;

        if (schema.oneOf) {
            schemaHtmlLines.push(`One of the following ${schema.oneOf.length} types:`);
            for (let i = 0; i < schema.oneOf.length; i++) {
                const oneSchema = schema.oneOf[i];
                if (!oneSchema) continue;
                schemaHtmlLines.push(renderJsonSchema("", oneSchema));
            }
            return;
        }

        schemaHtmlLines.push("<div class='schema'>");
        schemaHtmlLines.push("   <div class='schema-header'>");
        schemaHtmlLines.push(`      <div class='schema-title'>${name}</div>`);
        schemaHtmlLines.push(`      <div class='schema-type'>Type: ${schema.type}</div>`);
        // schemaHtmlLines.push(`      <div class='schema-sample'><pre>${OpenApiSampler(schema as any, undefined,  fullSchema)}</pre></div>`);
        schemaHtmlLines.push("   </div>");
        // Render properties
        if (Object.keys(schema.properties ?? {}).length > 0) {
            schemaHtmlLines.push("<div class='schema-properties-header'>Properties</div>");
            schemaHtmlLines.push("<div class='schema-properties'>");
            for (const propertyName in schema.properties) {
                const propertySchema = schema.properties[propertyName];
                if (!propertySchema) continue;

                if ((propertySchema as OpenAPIV3.ReferenceObject).$ref) {
                    schemaHtmlLines.push("<div class='schema-property'>");
                    schemaHtmlLines.push(`<div class='schema-property-name'>${propertyName}</div>`);
                    schemaHtmlLines.push(
                        `<div class='schema-property-required'>${schema.required && schema.required.includes(propertyName) ? "(required)" : ""}</div>`,
                    );
                    schemaHtmlLines.push(`<div class='schema-property-description-container'>`);
                    schemaHtmlLines.push(`<div class='schema-property-description'></div>`);
                    schemaHtmlLines.push("<div class='schema-property-schema'>");
                    schemaHtmlLines.push(JSON.stringify(_.omit(propertySchema, ["type", "description"]), null, 2));
                    schemaHtmlLines.push("</div>"); // end of schema-property-schema
                    schemaHtmlLines.push(`</div>`); // end of schema-property-description-container
                    schemaHtmlLines.push("</div>"); // end of schema-property
                    continue;
                }

                // From now on, we can assume it's a schema object
                const propertySchemaObj = propertySchema as OpenAPIV3.SchemaObject;
                schemaHtmlLines.push("<div class='schema-property'>");
                schemaHtmlLines.push(`<div class='schema-property-name'>${propertyName}</div>`);
                schemaHtmlLines.push(
                    `<div class='schema-property-required'>${schema.required && schema.required.includes(propertyName) ? "(required)" : ""}</div>`,
                );
                schemaHtmlLines.push(`<div class='schema-property-type'>${propertySchemaObj.type}</div>`);
                schemaHtmlLines.push(`<div class='schema-property-description-container'>`);
                schemaHtmlLines.push(
                    `<div class='schema-property-description'>${marked.parseInline(propertySchemaObj.description ?? "")}</div>`,
                );

                const restOfObject = _.omit(propertySchemaObj, ["type", "description"]);
                if (Object.keys(restOfObject).length > 0) {
                    schemaHtmlLines.push("<div class='schema-property-schema'><pre>");
                    schemaHtmlLines.push(JSON.stringify(_.omit(propertySchemaObj, ["type", "description"]), null, 2));
                    schemaHtmlLines.push("</pre></div>"); // end of schema-property-schema
                }

                schemaHtmlLines.push(`</div>`); // end of schema-property-description-container
                schemaHtmlLines.push("</div>"); // end of schema-property
            }
            schemaHtmlLines.push("</div>");
        }

        // end of "schema"
        schemaHtmlLines.push("</div>");
    };

    _iter(fullSchema);
    return schemaHtmlLines.join("\n");
}

/**
 * Replaces all $ref in the OpenAPI spec with their actual values.
 * In this way we simplify the templating process.
 *
 * @param openApiSpecJson The OpenAPI specification JSON object. NOTE: changed in place!
 * @returns The OpenAPI specification JSON object with resolved $ref

function resolveRefs(openApiSpecJson: OpenAPIV3.Document) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _iter = (obj: any): any => {
        if (Array.isArray(obj)) {
            return obj.map((item) => _iter(item));
        }

        if (Object.keys(obj).length === 1 && obj.$ref) {
            const refPath = obj.$ref.split("/").slice(1);
            const refValue = _.get(openApiSpecJson, refPath);
            if (refValue) {
                obj = _iter(refValue);
            }
            return obj;
        }

        if (obj && typeof obj === "object") {
            for (const key in obj) {
                obj[key] = _iter(obj[key]);
            }
            return obj;
        }

        return obj;
    };

    return _iter(openApiSpecJson);
}
 */

/**
 * Preprocess a parameter object to extract useful information for templating
 *
 * @param parameter the parameter object
 * @returns
 */
function preprocessParameter(parameter: OpenAPIV3.ParameterObject): object {
    const schema: OpenAPIV3.SchemaObject | undefined = parameter.schema
        ? _.cloneDeep(parameter.schema as OpenAPIV3.SchemaObject)
        : undefined;

    if (!schema) return { parameter: parameter };
    const { type, ...schemaObjectWithoutType } = schema as OpenAPIV3.SchemaObject;
    return {
        parameter: {
            ...parameter,
            description: parameter.description ? marked.parseInline(parameter.description || "") : undefined,
            type: type,
            isArray: type === "array",
            schema: JSON.stringify(schemaObjectWithoutType, null, 2),
        },
    };
}

/**
 * Generate the parameters HTML for an operation
 *
 * @param operation the operation object
 * @param operationParametersTemplate the template to be used for each parameter
 */
function processParameters(
    operation: OpenAPIV3.OperationObject,
    operationParametersTemplate: Handlebars.TemplateDelegate<object>,
) {
    // process the parameters. this will produce an
    const parametersHtml: string[] = [];
    if (operation.parameters && Array.isArray(operation.parameters)) {
        for (const parameter of operation.parameters) {
            const parameterHtml = operationParametersTemplate(
                preprocessParameter(parameter as OpenAPIV3.ParameterObject),
            );
            parametersHtml.push(parameterHtml);
        }
    }

    return parametersHtml.length > 0 ? parametersHtml.join("\n") : undefined;
}

/**
 * Process the responses for an operation
 *
 */
function processResponses(
    operation: OpenAPIV3.OperationObject,
    operationResponseTemplate: Handlebars.TemplateDelegate<object>,
    operationResponseContentTypeTemplate: Handlebars.TemplateDelegate<object>,
) {
    const responsesHtml: string[] = [];

    if (operation.responses) {
        for (const statusCode in operation.responses) {
            const responseForStatuscode = operation.responses[statusCode] as OpenAPIV3.ResponseObject;
            const contentTypesHtml: string[] = [];
            if (responseForStatuscode.content) {
                for (const contentType in responseForStatuscode.content) {
                    const content = responseForStatuscode.content[contentType] as OpenAPIV3.MediaTypeObject;
                    const contentHtml = operationResponseContentTypeTemplate({
                        contentType: {
                            contentType: contentType,
                            content: renderJsonSchema("", content.schema),
                        },
                    });
                    contentTypesHtml.push(contentHtml);
                }
            }

            const responseHtml = operationResponseTemplate({
                response: {
                    code: statusCode,
                    description: responseForStatuscode.description
                        ? marked.parseInline(responseForStatuscode.description)
                        : undefined,
                    content: contentTypesHtml.length > 0 ? contentTypesHtml.join("\n") : undefined,
                },
            });

            responsesHtml.push(responseHtml);
        }
    }

    return responsesHtml.length > 0 ? responsesHtml.join("\n") : undefined;
}

/**
 *
 */
function processSchemas(openApiSpecJson: OpenAPIV3.Document) {
    const schemaHtmlLines: string[] = [];
    Object.keys(openApiSpecJson.components?.schemas ?? {}).forEach((schemaName) => {
        const schema = openApiSpecJson.components?.schemas?.[schemaName];
        if (schema) {
            const schemaHtml = renderJsonSchema(schemaName, schema);
            schemaHtmlLines.push(schemaHtml);
        }
    });

    return schemaHtmlLines.join("\n");
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
    const htmlLines: string[] = [];

    // prepare some templates to be used during rendering
    const operationTemplate = Handlebars.compile(templates.operation);
    const operationParametersTemplate = Handlebars.compile(templates.operationParameter);
    const operationParametersHeaderTemplate = Handlebars.compile(templates.operationParametersHeader);
    const operationResponseTemplate = Handlebars.compile(templates.operationResponse);
    const operationResponseContentTypeTemplate = Handlebars.compile(templates.operationResponseContentType);

    // Start rendering operations
    for (const path in openApiSpecJson.paths) {
        const pathItem = openApiSpecJson.paths[path];
        // this is only for type checking
        if (!pathItem) continue;

        for (const method of ["get", "post", "put", "delete", "patch", "options", "head", "trace"]) {
            // ignore if the method does not exist on the path item
            if (!(method in pathItem)) continue;

            const operation = (pathItem as any)[method];

            // render parameters header html
            const parametersHeaderHtml = operationParametersHeaderTemplate({});
            // render parameters html
            const parametersHtml = processParameters(operation, operationParametersTemplate);
            // render responses html
            const responsesHtml = processResponses(
                operation,
                operationResponseTemplate,
                operationResponseContentTypeTemplate,
            );

            const operationHtml = operationTemplate({
                operation: {
                    ...operation,
                    parameters: parametersHtml,
                    parametersHeader: parametersHeaderHtml,
                    responses: responsesHtml,
                },
                path: path,
                method: method.toUpperCase(),
            });

            htmlLines.push(operationHtml);
        }
    }

    htmlLines.push(processSchemas(openApiSpecJson));
    return htmlLines.join("\n");
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
): Promise<{ body: string; header: string; footer: string }> {
    // preventively resolve all $ref in the OpenAPI spec so we now can assume all schemas contains the direct values
    // instead of having to resolve them during templating
    // openApiSpecJson = resolveRefs(_.cloneDeep(openApiSpecJson) as OpenAPIV3.Document);

    // Generate the handlebars template for the OpenAPI spec
    let openApiSpectHbs = "";
    switch (openApiSpecJson.openapi.split(".").slice(0, 2).join(".")) {
        case "3.0":
            openApiSpectHbs = buildOpenApiTemplateV3(configFile, templates, openApiSpecJson as OpenAPIV3.Document);
            break;
        case "3.1":
            openApiSpectHbs = buildOpenApiTemplateV3_1(configFile, templates, openApiSpecJson as OpenAPIV3_1.Document);
            break;
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
        openApiSpectHbs,
        templates.lastpage,
        "</body>",
        "</html>",
    ].join("\n");

    // effectively render the template
    const template = Handlebars.compile(finalTemplate);

    const body = template({
        metadata: configFile.metadata,
        openApiUrl: configFile.openApiUrl,
    });

    const header = Handlebars.compile(templates.header)({
        metadata: configFile.metadata,
        openApiUrl: configFile.openApiUrl,
    });

    const footer = Handlebars.compile(templates.footer)({
        metadata: configFile.metadata,
        openApiUrl: configFile.openApiUrl,
    });

    return {
        body: body,
        header: header,
        footer: footer,
    };
}
