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
    private operationParametersHeaderTemplate: Handlebars.TemplateDelegate;
    private operationResponseTemplate: Handlebars.TemplateDelegate;
    private operationResponseContentTypeTemplate: Handlebars.TemplateDelegate;
    private tocLineTemplate: Handlebars.TemplateDelegate;
    private tocTemplate: Handlebars.TemplateDelegate;
    private apiTemplate: Handlebars.TemplateDelegate;
    private schemasTemplate: Handlebars.TemplateDelegate;
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
        this.operationParametersHeaderTemplate = Handlebars.compile(this.templates.operationParametersHeader);
        this.operationResponseTemplate = Handlebars.compile(this.templates.operationResponse);
        this.operationResponseContentTypeTemplate = Handlebars.compile(this.templates.operationResponseContentType);
        this.tocLineTemplate = Handlebars.compile(this.templates.tocLine);
        this.tocTemplate = Handlebars.compile(this.templates.toc);
        this.apiTemplate = Handlebars.compile(this.templates.api);
        this.schemasTemplate = Handlebars.compile(this.templates.schemas);
    }

    /**
     *
     */
    public renderToc(): string {
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
                    tocLine: {
                        method: method.toUpperCase(),
                        path: path,
                        summary: operation.summary || "",
                        link: `#${method}-${path.replace(/\//g, "-")}`,
                    },
                });
                html.push(tocLineHtml);
            }
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
    private preprocessParameter(parameter: OpenAPIV3.ParameterObject): object {
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
    private processComponents(where: "schemas"): string {
        const schemaHtmlLines: string[] = [];
        Object.keys(this.openApiSpecJson.components?.[where] ?? {}).forEach((schemaName) => {
            const schema = this.openApiSpecJson.components?.[where]?.[schemaName];

            if (schema) {
                const link = "#/components/schemas/" + schemaName;
                const schemaHtml = new JsonSchemaRender(schemaName, link, schema, this.openApiSpecJson).render();
                schemaHtmlLines.push(schemaHtml);
            }
        });

        return schemaHtmlLines.join("\n");
    }

    /**
     * Generate the parameters HTML for an operation
     *
     * @param operation the operation object
     * @param operationParametersTemplate the template to be used for each parameter
     */
    private processParameters(operation: OpenAPIV3.OperationObject) {
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
                    this.preprocessParameter(parameter as OpenAPIV3.ParameterObject),
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
    private processResponses(operation: OpenAPIV3.OperationObject) {
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
                                ? new JsonSchemaRender("", "", content.schema, this.openApiSpecJson).render()
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
     * @returns
     */
    public render() {
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

                // render parameters header html
                const parametersHeaderHtml = this.operationParametersHeaderTemplate({});
                // render parameters html
                const parametersHtml = this.processParameters(operation);
                // render responses html
                const responsesHtml = this.processResponses(operation);

                const operationHtml = this.operationTemplate({
                    operation: {
                        ...operation,
                        parameters: parametersHtml,
                        parametersHeader: parametersHeaderHtml,
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
    public renderSchemas(): string {
        const schemasHtml = this.processComponents("schemas");
        return this.schemasTemplate({ content: schemasHtml });
    }
}
