import _ from "lodash";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { sample as OpenApiSampler } from "openapi-sampler";
import { marked } from "marked";

/**
 * Render a json schema to HTML
 *
 * NOTE: This might change in place the openApiSpecJson object. If a json schema recurse to other json schemas, those will be added to the openApiSpecJson components/schemas
 * and the current schema will be modified to reference those schemas.
 * This is done to prevent generation of really deep HTML for deeply nested schemas.
 *
 */
export class JsonSchemaRender {
    /**
     *
     * @param name
     * @param schema
     * @param fullSchema
     */
    constructor(
        protected name: string,
        protected link: string,
        protected schema:
            | OpenAPIV3.SchemaObject
            | OpenAPIV3.ReferenceObject
            | OpenAPIV3_1.SchemaObject
            | OpenAPIV3_1.ReferenceObject,
        protected openApiSpecJson: OpenAPIV3.Document<object> | OpenAPIV3_1.Document<object>,
    ) {}

    /**
     * Gets a schema from a ref
     * @param ref
     * @returns
     */
    private getSchemaByRef(ref: string): OpenAPIV3.SchemaObject | undefined {
        const refPath = ref.split("/").slice(1);
        return _.get(this.openApiSpecJson, refPath);
    }

    /**
     * Gets a schema name from a ref
     * @param ref
     * @returns
     */
    private getSchemaNameByRef(ref: string): string | undefined {
        return ref.split("/").pop();
    }

    /**
     *
     */
    private escapeHtml(text: string | number) {
        if (typeof text === "number") return (text = text.toString());
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /**
     *
     */
    private async renderMarkdown(text?: string): Promise<string> {
        if (!text) return "";
        try {
            return marked.parseInline(text);
        } catch (error: any) {
            return this.escapeHtml(text);
        }
    }

    /**
     *
     * @param json
     * @returns
     */
    private async jsonToHtml(json: any): Promise<string> {
        try {
            return this.escapeHtml(JSON.stringify(json, null, 2));
        } catch (error: any) {
            return "";
        }
    }

    /**
     * Iterate over the schema and generate the HTML
     *
     * @param parents A series of strings that indicates the parent property or schema names. Also used to check for deep nesting
     * @param name The name of the current schema
     * @param link The link (id) of the current schema
     * @param schemaOrReference The schema or reference object to render
     * @returns An object with a boolean indicating if the schema was rendered as a sub-schema, and the generated HTML lines
     */
    private async iterate(
        parents: string[],
        name: string,
        link: string,
        schemaOrReference:
            | OpenAPIV3.SchemaObject
            | OpenAPIV3.ReferenceObject
            | OpenAPIV3_1.SchemaObject
            | OpenAPIV3_1.ReferenceObject,
    ): Promise<{ sub: boolean; html: string[] }> {
        const html: string[] = [];

        if ((schemaOrReference as OpenAPIV3.ReferenceObject).$ref) {
            const ref = (schemaOrReference as OpenAPIV3.ReferenceObject).$ref;
            const schemaName = this.getSchemaNameByRef(ref);
            html.push(`See referenced schema <a href="${ref}">${schemaName}</a>`);
            return { sub: false, html: html };
        }

        // From now on, we can assume it's a schema object
        const schema = schemaOrReference as OpenAPIV3.SchemaObject;

        if (schema.oneOf) {
            html.push(`One of the following ${schema.oneOf.length} types:`);
            for (let i = 0; i < schema.oneOf.length; i++) {
                const oneSchema = schema.oneOf[i];
                if (!oneSchema) continue;

                const result = await this.iterate(parents, "", "", oneSchema);
                if (result.sub) {
                    html.push(`<div class='schema-oneof-index'>Option ${i + 1}:</div>`);
                    html.push("<div class='schema-oneof'>");
                    html.push(...result.html);
                    html.push("</div>"); // end of schema-oneof
                } else {
                    html.push(...result.html);
                }
            }
            return { sub: false, html: html };
        }

        /**
         * Handle array types
         */
        if (schema.type === "array" && schema.items) {
            const result = await this.iterate(parents, "", "", schema.items);
            html.push(`(Array of following)`);
            html.push(...result.html);
            return { sub: false, html: html };
        }

        // Don't go too deep, instead create a new schema in components/schemas and reference it
        if (parents.length > 2) {
            this.openApiSpecJson.components = this.openApiSpecJson.components || {};
            this.openApiSpecJson.components.schemas = this.openApiSpecJson.components.schemas || {};

            let schemaRefLink = `#/components/schemas/${name}`;
            if (!this.openApiSpecJson.components.schemas[name]) {
                const composedSchemaName = [...parents].join("_").replace(/ /g, "_");
                this.openApiSpecJson.components.schemas[composedSchemaName] = schemaOrReference;
                schemaRefLink = `#/components/schemas/${composedSchemaName}`;
            }

            html.push(`See referenced schema <a href="${schemaRefLink}">${name}</a>`);
            return {
                sub: false,
                html: html,
            };
        }

        // try to generate a sample.
        // Had some failures, probably due to malformed schemas. In these cases, skip the sample generation
        let sample = "";
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sample = await this.jsonToHtml(OpenApiSampler(schema as any, {}, this.schema));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error generating sample for schema", name, error?.message);
            sample = "";
        }

        html.push("<div class='schema'>");
        html.push("   <div class='schema-header'>");
        if (name) {
            html.push(`      <div class='schema-title' id='${link.replace("#", "")}'>${name}</div>`);
        }
        html.push(`      <div class='schema-type'>Type: ${schema.type}</div>`);
        html.push("   </div>"); // end of schema-header

        if (sample) {
            html.push(`<div class='schema-sample'>Example:<br><pre>${sample}</pre></div>`);
        }

        // Render properties
        if (Object.keys(schema.properties ?? {}).length > 0) {
            html.push(...(await this.renderProperties([...parents], schema)));
        }

        // end of "schema"
        html.push("</div>"); // end of schema
        return { sub: true, html: html };
    }

    /**
     *
     * @param parents A seies of strings that indicates the parent property or schema names. Also used to check for deep nesting
     * @returns
     */
    private async renderProperties(parents: string[], schema?: OpenAPIV3.SchemaObject): Promise<string[]> {
        if (!schema) return [];
        if (Object.keys(schema?.properties || {}).length === 0) return [];

        const html: string[] = [];

        const header = parents.length === 1 ? "Properties" : "Sub-properties";
        const headerClass = parents.length === 1 ? "schema-properties-title" : "schema-sub-properties-title";
        const padderClass = parents.length === 1 ? "" : "properties-padder";
        html.push(`<div class='${padderClass}'>`);
        html.push(`    <div class='${headerClass}'>${header}</div>`);
        html.push("    <div class='schema-properties'>");
        html.push("        <div class='schema-properties-header'>");
        html.push("            <div class='schema-property-name'>Name</div>");
        html.push("            <div class='schema-property-description'>Description</div>");
        html.push("        </div>"); // end of schema-properties-header
        for (const propertyName in schema.properties) {
            const propertySchema = schema.properties[propertyName];
            if (!propertySchema) continue;

            const propertySchemaRef = propertySchema as OpenAPIV3.ReferenceObject;
            const propertySchemaObj = propertySchema as OpenAPIV3.SchemaObject;
            const isRef = !!propertySchemaRef.$ref;
            const format = propertySchemaObj.format ? ` (format: ${propertySchemaObj.format})` : "";
            const required = schema.required && schema.required.includes(propertyName);
            const type = isRef ? "" : (propertySchemaObj.type ? (propertySchemaObj.type+format) : "");

            html.push("        <div class='schema-property'>");
            html.push(`            <div class='schema-property-name'>${propertyName}</div>`);
            html.push(`            <div class='schema-property-description-container'>`);

            if (isRef) {
                const restOfObject = _.omit(propertySchemaRef, ["type", "description", "format", "$ref"]);
                const schema = this.getSchemaByRef(propertySchemaRef.$ref);
                const schemaName = this.getSchemaNameByRef(propertySchemaRef.$ref);
                const description = await this.renderMarkdown(schema?.description);

                html.push(
                    `<div class='schema-property-description'>
                      ${required ? "<span class='required'>Required, </span>" : ""}
                      ${type ? `<span>${type}${description ? ", " : ""}</span>` : ""}
                      ${description}
                      <br><br>
                      See referenced schema <a href="${propertySchemaRef.$ref}">${schemaName}</a>
                    </div>`,
                );

                if (Object.keys(restOfObject).length > 0) {
                    const restOfSchemaJson = await this.jsonToHtml(restOfObject);
                    html.push(`<div class='schema-property-schema'><pre>${restOfSchemaJson}</pre></div>`);
                }
            } else {
                const description = await this.renderMarkdown(propertySchemaObj.description);
                const subProperties = propertySchemaObj.properties;
                const items = propertySchemaObj.type === "array" ? propertySchemaObj.items : undefined;
                const isReadonly = propertySchemaObj.readOnly;

                let defaultValue: string | undefined = propertySchemaObj.default;
                if (defaultValue !== undefined) {
                    defaultValue = "Default value: <b>" + defaultValue + "</b>";
                }

                let enumValues: string | undefined;
                if (Array.isArray(propertySchemaObj.enum)) {
                    enumValues =
                        "Possible values: <b>" +
                        propertySchemaObj.enum.map((e) => this.escapeHtml(e)).join(", ") +
                        "</b>";
                }

                const flags = [
                    required ? "<span class='required'>Required</span>" : "",
                    type ? `<span>${type}</span>` : "",
                    isReadonly ? "<span class='readonly'>Read-only</span>" : "",
                ]
                    .filter((f) => f !== "")
                    .join(", ");

                html.push(`<div class='schema-property-description'>
                    ${flags} ${(flags.length && description) ? ", " : ""}
                    ${description}
                    ${enumValues ? `<div class='enum'>${enumValues}</div>` : ""}
                    ${defaultValue ? `<div class='default-value'>${defaultValue}</div>` : ""}
                </div>`);

                const restOfObject = _.omit(propertySchemaObj, [
                    "type",
                    "description",
                    "format",
                    "properties",
                    "items",
                    "enum",
                    "default",
                    "readOnly",
                ]);
                if (Object.keys(restOfObject).length > 0) {
                    html.push("<div class='schema-property-schema'><pre>");
                    html.push(this.escapeHtml(JSON.stringify(_.omit(restOfObject), null, 2)));
                    html.push("</pre></div>"); // end of schema-property-schema
                }

                // recursively render sub-properties
                if (subProperties && Object.keys(subProperties).length > 0) {
                    html.push(...(await this.renderProperties([...parents, propertyName], propertySchemaObj)));
                }

                if (items) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const title = (items as any).title ?? "Items of " + propertyName;

                    const result = await this.iterate([...parents, propertyName], title, "", items);
                    if (result.sub) {
                        html.push("<div class='schema-property-items'>");
                        html.push("<div class='properties-padder sub-schema'>");
                        html.push(...result.html);
                        html.push("</div>"); // end of properties-padder
                        html.push("</div>"); // end of schema-property-items
                    } else {
                        html.push(...result.html);
                    }
                }
            }

            html.push(`            </div>`); // end of schema-property-description-container
            html.push(`        </div>`); // end of schema-property
        }
        html.push("    </div>"); // end of schema-properties
        html.push(`</div>`); // end of padder

        return html;
    }

    /**
     * Render the given schema to HTML
     *
     * @param schema the schema to render
     * @returns the rendered HTML
     */
    public async render(): Promise<string> {
        try {
            // Render the schema using the fullSchema context
            const result = await this.iterate([this.name], this.name, this.link, this.schema);

            return result.html.join("\n");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error rendering schema", this.name, error?.message);
            return `<div class='schema-error'>Error rendering schema ${this.name}: ${this.escapeHtml(error?.message)}</div>`;
        }
    }
}
