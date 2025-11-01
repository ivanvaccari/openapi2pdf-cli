import _ from "lodash";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { sample as OpenApiSampler } from "openapi-sampler";
import { marked } from "marked";

export class JsonSchemaRender {
    /**
     * The rendered schema html lines
     */
    private html: string[] = [];

    /**
     *
     * @param name
     * @param schema
     * @param fullSchema
     */
    constructor(
        protected name: string,
        protected link: string,
        protected schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject,
        protected openApiSpecJson: OpenAPIV3.Document<object> | OpenAPIV3_1.Document<object>,
    ) {
        // this.fullSchemaWithResolvedRefs = this.resolveRefs(openApiSpecJson);
        this.html = [];
    }

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
    private async iterate(
        name: string,
        link: string,
        schemaOrReference: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject,
    ) {
        if ((schemaOrReference as OpenAPIV3.ReferenceObject).$ref) {
            const ref = (schemaOrReference as OpenAPIV3.ReferenceObject).$ref;
            const schemaName = this.getSchemaNameByRef(ref);
            this.html.push(`See referenced schema <a href="${ref}">${schemaName}</a>`);
            return;
        }

        // From now on, we can assume it's a schema object
        const schema = schemaOrReference as OpenAPIV3.SchemaObject;

        if (schema.oneOf) {
            this.html.push(`One of the following ${schema.oneOf.length} types:`);
            for (let i = 0; i < schema.oneOf.length; i++) {
                const oneSchema = schema.oneOf[i];
                if (!oneSchema) continue;
                this.html.push(`<div class='schema-oneof-index'>Option ${i + 1}:</div>`);
                this.html.push("<div class='schema-oneof'>");
                this.iterate("", "", oneSchema);
                this.html.push("</div>");
            }
            return;
        }

        // try to generate a sample.
        // Had some failures, probably due to malformed schemas. In these cases, skip the sample generation
        let sample = "";
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sample = JSON.stringify(OpenApiSampler(schema as any, {}, this.schema), null, 2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Error generating sample for schema", name, error?.message);
            sample = "";
        }

        this.html.push("<div class='schema'>");
        this.html.push("   <div class='schema-header'>");
        this.html.push(`      <div class='schema-title' id=${link.replace("#", "")}>${name}</div>`);
        this.html.push(`      <div class='schema-type'>Type: ${schema.type}</div>`);

        if (sample) {
            this.html.push(`      <div class='schema-sample'>Example:<br><pre>${sample}</pre></div>`);
        }
        this.html.push("   </div>");

        // Render properties
        if (Object.keys(schema.properties ?? {}).length > 0) {
            await this.renderProperties(0, schema);
        }

        // end of "schema"
        this.html.push("</div>");
    }

    /**
     *
     * @param schema
     * @returns
     */
    private async renderProperties(level: number, schema?: OpenAPIV3.SchemaObject) {
        if (!schema) return;
        if (Object.keys(schema?.properties || {}).length === 0) return;

        const header = level === 0 ? "Properties" : "Sub-properties";
        const headerClass = level === 0 ? "schema-properties-header" : "schema-sub-properties-header";
        const padderClass = level === 0 ? "" : "properties-padder";
        this.html.push(`<div class='${padderClass}'>`);
        this.html.push(`<div class='${headerClass}'>${header}</div>`);
        this.html.push("<div class='schema-properties'>");
        for (const propertyName in schema.properties) {
            const propertySchema = schema.properties[propertyName];
            if (!propertySchema) continue;

            const propertySchemaRef = propertySchema as OpenAPIV3.ReferenceObject;
            const propertySchemaObj = propertySchema as OpenAPIV3.SchemaObject;
            const isRef = !!propertySchemaRef.$ref;
            const format = propertySchemaObj.format ? ` (format: ${propertySchemaObj.format})` : "";

            this.html.push("<div class='schema-property'>");
            this.html.push(`<div class='schema-property-name'>${propertyName}</div>`);
            this.html.push(
                `<div class='schema-property-required'>${schema.required && schema.required.includes(propertyName) ? "(required)" : ""}</div>`,
            );

            this.html.push(`<div class='schema-property-type'>${isRef ? "" : propertySchemaObj.type} ${format}</div>`);

            this.html.push(`<div class='schema-property-description-container'>`);

            if (isRef) {
                const restOfObject = _.omit(propertySchemaRef, ["type", "description", "format", "$ref"]);
                const schema = this.getSchemaByRef(propertySchemaRef.$ref);
                const schemaName = this.getSchemaNameByRef(propertySchemaRef.$ref);
                this.html.push(
                    `<div class='schema-property-description'>${schema?.description ? await marked.parseInline(schema?.description) : ""}<br><br>See referenced schema <a href="${propertySchemaRef.$ref}">${schemaName}</a></div>`,
                );

                if (Object.keys(restOfObject).length > 0) {
                    this.html.push("<div class='schema-property-schema'><pre>");
                    this.html.push(this.escapeHtml(JSON.stringify(restOfObject, null, 2)));
                    this.html.push("</pre></div>"); // end of schema-property-schema
                }
            } else {
                this.html.push(
                    `<div class='schema-property-description'>${isRef ? "" : await marked.parseInline(propertySchemaObj.description ?? "No description")}</div>`,
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
                    this.html.push("<div class='schema-property-schema'><pre>");
                    this.html.push(
                        this.escapeHtml(JSON.stringify(_.omit(propertySchemaObj, ["type", "description"]), null, 2)),
                    );
                    this.html.push("</pre></div>"); // end of schema-property-schema
                }

                // recursively render sub-properties
                if (subProperties && Object.keys(subProperties).length > 0) {
                    this.renderProperties(level + 1, propertySchemaObj);
                }

                if (items) {
                    this.html.push("<div class='schema-property-items'>");
                    this.html.push("<div class='properties-padder sub-schema'>");
                    this.iterate("Each array item", "", items);
                    this.html.push("</div>"); // end of properties-padder
                    this.html.push("</div>"); // end of schema-property-items
                }
            }

            this.html.push(`</div>`); // end of schema-property-description-container
            this.html.push("</div>"); // end of schema-property
        }
        this.html.push("</div>"); // end of schema-properties
        this.html.push(`</div>`); // end of margin-left
    }

    /**
     * Render the given schema to HTML
     *
     * @param schema the schema to render
     * @returns the rendered HTML
     */
    public async render(): Promise<string> {
        // Render the schema using the fullSchema context
        await this.iterate(this.name, this.link, this.schema);

        return this.html.join("\n");
    }
}
