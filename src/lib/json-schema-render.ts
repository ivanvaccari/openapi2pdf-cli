import _ from "lodash";
import { OpenAPIV3 } from "openapi-types";
import { sample as OpenApiSampler } from "openapi-sampler";
import { marked } from "marked";

export class JsonSchemaRender {
    /**
     * The full OpenAPI schema document
     */
    // private fullSchema: OpenAPIV3.Document<{}>;

    /**
     * The full OpenAPI schema document with resolved $ref
     */
    private fullSchemaWithResolvedRefs: OpenAPIV3.Document<{}>;

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
        protected schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
        protected openApiSpecJson: OpenAPIV3.Document<{}>,
    ) {
        this.fullSchemaWithResolvedRefs = this.resolveRefs(openApiSpecJson);
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
     * Replaces all $ref in the OpenAPI spec with their actual values.
     * In this way we simplify the templating process.
     *
     * @param openApiSpecJson The OpenAPI specification JSON object.
     * @returns The OpenAPI specification JSON object with resolved $ref
     */
    private resolveRefs(openApiSpecJson: OpenAPIV3.Document) {
        openApiSpecJson = _.cloneDeep(openApiSpecJson);
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

    /**
     *
     */
    private iterate(name: string, link: string, schemaOrReference: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) {
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
                this.iterate("", "", oneSchema);
            }
            return;
        }

        // try to generate a sample
        let sample = "";
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sample = JSON.stringify(OpenApiSampler(schema as any, undefined, this.fullSchemaWithResolvedRefs), null, 2);
        } catch (error) {
            console.error("Error generating sample for schema ", name, error);
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
            this.html.push("<div class='schema-properties-header'>Properties</div>");
            this.html.push("<div class='schema-properties'>");
            for (const propertyName in schema.properties) {
                const propertySchema = schema.properties[propertyName];
                if (!propertySchema) continue;

                const propertySchemaRef = propertySchema as OpenAPIV3.ReferenceObject;
                const propertySchemaObj = propertySchema as OpenAPIV3.SchemaObject;
                const isRef = !!propertySchemaRef.$ref;

                this.html.push("<div class='schema-property'>");
                this.html.push(`<div class='schema-property-name'>${propertyName}</div>`);
                this.html.push(
                    `<div class='schema-property-required'>${schema.required && schema.required.includes(propertyName) ? "(required)" : ""}</div>`,
                );

                this.html.push(`<div class='schema-property-type'>${isRef ? "" : propertySchemaObj.type}</div>`);

                this.html.push(`<div class='schema-property-description-container'>`);

                if (isRef) {
                    const restOfObject = _.omit(propertySchemaRef, ["type", "description", "$ref"]);
                    const schema = this.getSchemaByRef(propertySchemaRef.$ref);
                    const schemaName = this.getSchemaNameByRef(propertySchemaRef.$ref);
                    this.html.push(
                        `<div class='schema-property-description'>${schema?.description ? marked.parseInline(schema?.description) : ""}<br><br>See referenced schema <a href="${propertySchemaRef.$ref}">${schemaName}</a></div>`,
                    );

                    if (Object.keys(restOfObject).length > 0) {
                        this.html.push("<div class='schema-property-schema'><pre>");
                        this.html.push(JSON.stringify(restOfObject, null, 2));
                        this.html.push("</pre></div>"); // end of schema-property-schema
                    }
                } else {
                    this.html.push(
                        `<div class='schema-property-description'>${isRef ? "" : marked.parseInline(propertySchemaObj.description ?? "No description")}</div>`,
                    );

                    const restOfObject = _.omit(propertySchemaObj, ["type", "description"]);
                    if (Object.keys(restOfObject).length > 0) {
                        this.html.push("<div class='schema-property-schema'><pre>");
                        this.html.push(JSON.stringify(_.omit(propertySchemaObj, ["type", "description"]), null, 2));
                        this.html.push("</pre></div>"); // end of schema-property-schema
                    }
                }

                this.html.push(`</div>`); // end of schema-property-description-container
                this.html.push("</div>"); // end of schema-property
            }
            this.html.push("</div>");
        }

        // end of "schema"
        this.html.push("</div>");
    }

    /**
     * Render the given schema to HTML
     *
     * @param schema the schema to render
     * @returns the rendered HTML
     */
    public render(): string {
        // Render the schema using the fullSchema context
        this.iterate(this.name, this.link, this.schema);

        return this.html.join("\n");
    }
}
