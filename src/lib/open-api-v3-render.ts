/**
 * Process the OpenAPI specification V3.0.0 and build the template content
 * @param openApiSpecJson
 */

import { OpenAPIV3 } from "openapi-types";
import { ConfigFile, TemplateFiles } from "../types";
import _ from "lodash";
import { marked } from "marked";
import { JsonSchemaRender } from "./json-schema-render";
import Handlebars from "handlebars";

export class OpenApiV3Render {
    private html: string[] = [];
    private operationTemplate: Handlebars.TemplateDelegate;
    private operationParametersTemplate: Handlebars.TemplateDelegate;
    private operationResponseTemplate: Handlebars.TemplateDelegate;
    private operationResponseContentTypeTemplate: Handlebars.TemplateDelegate;
    private tocLineTemplate: Handlebars.TemplateDelegate;
    private tocTemplate: Handlebars.TemplateDelegate;
    private apiTemplate: Handlebars.TemplateDelegate;
    private schemasTemplate: Handlebars.TemplateDelegate;
    private tocTagTemplate: Handlebars.TemplateDelegate;
    private configFile: ConfigFile;
    private templates: TemplateFiles;
    private openApiSpecJson: OpenAPIV3.Document;

    constructor(configFile: ConfigFile, templates: TemplateFiles, openApiSpecJson: OpenAPIV3.Document) {
        this.templates = templates;
        this.configFile = configFile;
        this.openApiSpecJson = Object.freeze(openApiSpecJson);
        // prepare some templates to be used during rendering
        this.operationTemplate = Handlebars.compile(this.templates.operation);
        this.operationParametersTemplate = Handlebars.compile(this.templates.operationParameter);
        this.operationResponseTemplate = Handlebars.compile(this.templates.operationResponse);
        this.operationResponseContentTypeTemplate = Handlebars.compile(this.templates.operationResponseContentType);
        this.tocTagTemplate = Handlebars.compile(this.templates.tocTag);
        this.tocLineTemplate = Handlebars.compile(this.templates.tocLine);
        this.tocTemplate = Handlebars.compile(this.templates.toc);
        this.apiTemplate = Handlebars.compile(this.templates.api);
        this.schemasTemplate = Handlebars.compile(this.templates.schemas);
    }

    /**
     * Renders the Table of Contents section
     */
    public async renderToc(): Promise<string> {
        const htmlByTag: { [tag: string]: string[] } = {};
        const html: string[] = [];

        for (const path in this.openApiSpecJson.paths) {
            const pathItem = this.openApiSpecJson.paths[path];
            // this is only for type checking
            if (!pathItem) continue;
            for (const method of ["get", "post", "put", "delete", "patch", "options", "head", "trace"]) {
                // ignore if the method does not exist on the path item
                if (!(method in pathItem)) continue;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const operation = (pathItem as any)[method];

                const tocLineHtml = this.tocLineTemplate({
                    method: method.toUpperCase(),
                    path: path,
                    summary: operation.summary || "",
                    link: `#${method}-${path.replace(/\//g, "-")}`,
                });

                operation.tags = operation.tags || [""];
                for (const tag of operation.tags) {
                    if (!htmlByTag[tag]) {
                        htmlByTag[tag] = [];
                    }
                    htmlByTag[tag].push(tocLineHtml);
                }
            }
        }


        const usedTags = Object.keys(htmlByTag).sort();
        for (const tag of usedTags) {
            let tagSpec = this.openApiSpecJson.tags?.find((t) => t.name === tag);
            if (!tagSpec) {
                // no tag, use a fake one
                tagSpec = { name: tag, description: "" };
            }

            let description: string = tagSpec.description ? await marked.parseInline(tagSpec.description) : "";
            if (tagSpec.externalDocs) {
                description += ` <a href="${tagSpec.externalDocs.url}">${tagSpec.externalDocs.description} ${tagSpec.externalDocs.url}</a>`;
            }

            const tagHtml = this.tocTagTemplate({
                title: tagSpec.name,
                description: description,
                lines: htmlByTag[tag],
            });
            html.push(tagHtml);
        }

        return this.tocTemplate({
            content: html.join("\n"),
        });
    }

    /**
     * Preprocess a parameter object to extract useful information for templating
     *
     * @param parameter the parameter object
     * @returns
     */
    private async preprocessParameter(parameter: OpenAPIV3.ParameterObject): Promise<object> {
        const schema: OpenAPIV3.SchemaObject | undefined = parameter.schema
            ? _.cloneDeep(parameter.schema as OpenAPIV3.SchemaObject)
            : undefined;

        if (!schema) return { parameter: parameter };
        const { type, ...schemaObjectWithoutType } = schema as OpenAPIV3.SchemaObject;
        return {
            parameter: {
                ...parameter,
                description: parameter.description ? await marked.parseInline(parameter.description || "") : undefined,
                type: type,
                isArray: type === "array",
                schema:
                    Object.keys(schemaObjectWithoutType).length > 0
                        ? JSON.stringify(schemaObjectWithoutType, null, 2)
                        : undefined,
            },
        };
    }

    /**
     *
     */
    private async processComponents(where: "schemas"): Promise<string> {
        const schemaHtmlLines: string[] = [];
        for (const schemaName of Object.keys(this.openApiSpecJson.components?.[where] ?? {})) {
            const schema = this.openApiSpecJson.components?.[where]?.[schemaName];

            if (schema) {
                const link = "#/components/schemas/" + schemaName;
                const schemaHtml = await new JsonSchemaRender(schemaName, link, schema, this.openApiSpecJson).render();
                schemaHtmlLines.push(schemaHtml);
            }
        }

        return schemaHtmlLines.join("\n");
    }

    /**
     * Generate the parameters HTML for an operation
     *
     * @param operation the operation object
     * @param operationParametersTemplate the template to be used for each parameter
     */
    private async processParameters(operation: OpenAPIV3.OperationObject): Promise<string[] | undefined> {
        // process the parameters. this will produce an
        const parametersHtml: string[] = [];

        if (operation.parameters && Array.isArray(operation.parameters)) {
            for (let parameter of operation.parameters) {
                // Resolve ref if needed
                if ((parameter as OpenAPIV3.ReferenceObject).$ref) {
                    const refPath = (parameter as OpenAPIV3.ReferenceObject).$ref.split("/").slice(1);
                    parameter = _.get(this.openApiSpecJson, refPath);
                }

                const parameterHtml = this.operationParametersTemplate(
                    await this.preprocessParameter(parameter as OpenAPIV3.ParameterObject),
                );
                parametersHtml.push(parameterHtml);
            }
        }

        return parametersHtml.length > 0 ? parametersHtml : undefined;
    }

    /**
     * Process the responses for an operation
     *
     */
    private async processResponses(operation: OpenAPIV3.OperationObject): Promise<string[] | undefined> {
        const responsesHtml: string[] = [];

        if (operation.responses) {
            for (const statusCode in operation.responses) {
                const responseForStatuscode = operation.responses[statusCode] as OpenAPIV3.ResponseObject;
                const contentTypesHtml: string[] = [];
                if (responseForStatuscode.content) {
                    for (const contentType in responseForStatuscode.content) {
                        const content = responseForStatuscode.content[contentType] as OpenAPIV3.MediaTypeObject;

                        let contentSchema: string | undefined;
                        try {
                            contentSchema = content.schema
                                ? await new JsonSchemaRender("", "", content.schema, this.openApiSpecJson).render()
                                : undefined;
                        } catch (err) {
                            console.error(
                                `Error processing schema for response ${statusCode} content-type ${contentType}: ${(err as Error).message}`,
                            );
                        }
                        const contentHtml = this.operationResponseContentTypeTemplate({
                            contentType: {
                                contentType: contentType,
                                content: contentSchema,
                            },
                        });
                        contentTypesHtml.push(contentHtml);
                    }
                }

                const responseHtml = this.operationResponseTemplate({
                    response: {
                        code: statusCode,
                        description: responseForStatuscode.description
                            ? await marked.parseInline(responseForStatuscode.description)
                            : undefined,
                        content: contentTypesHtml.length > 0 ? contentTypesHtml.join("\n") : undefined,
                    },
                });

                responsesHtml.push(responseHtml);
            }
        }

        return responsesHtml.length > 0 ? responsesHtml : undefined;
    }

    /**
     *
     * @returns
     */
    public async render() {
        // Start rendering operations
        for (const path in this.openApiSpecJson.paths) {
            const pathItem = this.openApiSpecJson.paths[path];
            // this is only for type checking
            if (!pathItem) continue;

            for (const method of ["get", "post", "put", "delete", "patch", "options", "head", "trace"]) {
                // ignore if the method does not exist on the path item
                if (!(method in pathItem)) continue;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const operation = (pathItem as any)[method];

                // render parameters html
                const parametersHtml = await this.processParameters(operation);
                // render responses html
                const responsesHtml = await this.processResponses(operation);

                const operationHtml = this.operationTemplate({
                    operation: {
                        ...operation,
                        parameters: parametersHtml,
                        responses: responsesHtml,
                    },
                    anchor: `${method}-${path.replace(/\//g, "-")}`,
                    path: path,
                    method: method.toUpperCase(),
                });

                this.html.push(operationHtml);
            }
        }

        const content = this.html.join("\n");

        return this.apiTemplate({ content: content });
    }

    /**
     * Render schemas at the end
     */
    public async renderSchemas(): Promise<string> {
        const schemasHtml = await this.processComponents("schemas");
        return this.schemasTemplate({ content: schemasHtml });
    }
}
