import _ from "lodash";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { sample as OpenApiSampler } from "openapi-sampler";
import { marked } from "marked";

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
    private escapeHtml(text: string) {
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
     *
     */
    private async iterate(
        name: string,
        link: string,
        schemaOrReference:
            | OpenAPIV3.SchemaObject
            | OpenAPIV3.ReferenceObject
            | OpenAPIV3_1.SchemaObject
            | OpenAPIV3_1.ReferenceObject,
    ): Promise<string[]> {
        const html: string[] = [];

        if ((schemaOrReference as OpenAPIV3.ReferenceObject).$ref) {
            const ref = (schemaOrReference as OpenAPIV3.ReferenceObject).$ref;
            const schemaName = this.getSchemaNameByRef(ref);
            html.push(`See referenced schema <a href="${ref}">${schemaName}</a>`);
            return html;
        }

        // From now on, we can assume it's a schema object
        const schema = schemaOrReference as OpenAPIV3.SchemaObject;

        if (schema.oneOf) {
            html.push(`One of the following ${schema.oneOf.length} types:`);
            for (let i = 0; i < schema.oneOf.length; i++) {
                const oneSchema = schema.oneOf[i];
                if (!oneSchema) continue;
                html.push(`<div class='schema-oneof-index'>Option ${i + 1}:</div>`);
                html.push("<div class='schema-oneof'>");
                html.push(...(await this.iterate("", "", oneSchema)));
                html.push("</div>"); // end of schema-oneof
            }
            return html;
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
        html.push(`      <div class='schema-title' id=${link.replace("#", "")}>${name}</div>`);
        html.push(`      <div class='schema-type'>Type: ${schema.type}</div>`);
        html.push("   </div>"); // end of schema-header

        if (sample) {
            html.push(`<div class='schema-sample'>Example:<br><pre>${sample}</pre></div>`);
        }

        // Render properties
        if (Object.keys(schema.properties ?? {}).length > 0) {
            html.push(...(await this.renderProperties(0, schema)));
        }

        // end of "schema"
        html.push("</div>"); // end of schema
        return html;
    }

    /**
     *
     * @param schema
     * @returns
     */
    private async renderProperties(level: number, schema?: OpenAPIV3.SchemaObject): Promise<string[]> {
        if (!schema) return [];
        if (Object.keys(schema?.properties || {}).length === 0) return [];

        const html: string[] = [];

        const header = level === 0 ? "Properties" : "Sub-properties";
        const headerClass = level === 0 ? "schema-properties-title" : "schema-sub-properties-title";
        const padderClass = level === 0 ? "" : "properties-padder";
        html.push(`<div class='${padderClass}'>`);
        html.push(`    <div class='${headerClass}'>${header}</div>`);
        html.push("    <div class='schema-properties'>");
        html.push("        <div class='schema-properties-header'>");
        html.push("            <div class='schema-property-name'>Name</div>");
        html.push("            <div class='schema-property-required'>Required</div>");
        html.push("            <div class='schema-property-type'>Type</div>");
        html.push("            <div class='schema-property-description'>Description</div>");
        html.push("        </div>"); // end of schema-properties-header
        for (const propertyName in schema.properties) {
            const propertySchema = schema.properties[propertyName];
            if (!propertySchema) continue;

            const propertySchemaRef = propertySchema as OpenAPIV3.ReferenceObject;
            const propertySchemaObj = propertySchema as OpenAPIV3.SchemaObject;
            const isRef = !!propertySchemaRef.$ref;
            const format = propertySchemaObj.format ? ` (format: ${propertySchemaObj.format})` : "";

            html.push("        <div class='schema-property'>");
            html.push(`            <div class='schema-property-name'>${propertyName}</div>`);
            html.push(`            <div class='schema-property-required'>`);
            html.push(`                ${schema.required && schema.required.includes(propertyName) ? "Required" : ""}`);
            html.push(`            </div>`);
            html.push(
                `            <div class='schema-property-type'>${isRef ? "" : propertySchemaObj.type} ${format}</div>`,
            );
            html.push(`            <div class='schema-property-description-container'>`);

            if (isRef) {
                const restOfObject = _.omit(propertySchemaRef, ["type", "description", "format", "$ref"]);
                const schema = this.getSchemaByRef(propertySchemaRef.$ref);
                const schemaName = this.getSchemaNameByRef(propertySchemaRef.$ref);
                const description = await this.renderMarkdown(schema?.description);

                html.push(
                    `<div class='schema-property-description'>${description}<br><br>See referenced schema <a href="${propertySchemaRef.$ref}">${schemaName}</a></div>`,
                );

                if (Object.keys(restOfObject).length > 0) {
                    const restOfSchemaJson = await this.jsonToHtml(restOfObject);
                    html.push(`<div class='schema-property-schema'><pre>${restOfSchemaJson}</pre></div>`);
                }
            } else {
                const description = isRef ? "" : (await this.renderMarkdown(propertySchemaObj.description) ?? "No description");
                html.push(
                    `<div class='schema-property-description'>${description}</div>`,
                );

                const subProperties = propertySchemaObj.properties;
                const items = propertySchemaObj.type === "array" ? propertySchemaObj.items : undefined;
                const restOfObject = _.omit(propertySchemaObj, [
                    "type",
                    "description",
                    "format",
                    "properties",
                    "items",
                ]);
                if (Object.keys(restOfObject).length > 0) {
                    html.push("<div class='schema-property-schema'><pre>");
                    html.push(
                        this.escapeHtml(JSON.stringify(_.omit(propertySchemaObj, ["type", "description"]), null, 2)),
                    );
                    html.push("</pre></div>"); // end of schema-property-schema
                }

                // recursively render sub-properties
                if (subProperties && Object.keys(subProperties).length > 0) {
                    html.push(...(await this.renderProperties(level + 1, propertySchemaObj)));
                }

                if (items) {
                    html.push("<div class='schema-property-items'>");
                    html.push("<div class='properties-padder sub-schema'>");
                    html.push(...(await this.iterate("Each array item", "", items)));
                    html.push("</div>"); // end of properties-padder
                    html.push("</div>"); // end of schema-property-items
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
            const html = await this.iterate(this.name, this.link, this.schema);

            return html.join("\n");
        } catch (error: any) {
            console.error("Error rendering schema", this.name, error?.message);
            return `<div class='schema-error'>Error rendering schema ${this.name}: ${this.escapeHtml(error?.message)}</div>`;
        }
    }
}
