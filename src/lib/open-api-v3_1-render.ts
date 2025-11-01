/**
 * Process the OpenAPI specification V3.1.0 and build the template content
 * @param openApiSpecJson
 */

import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { ConfigFile, TemplateFiles } from "../types";
import { OpenApiV3Render } from "./open-api-v3-render";

export class OpenApiV3_1Render extends OpenApiV3Render {

    constructor(configFile: ConfigFile, templates: TemplateFiles, openApiSpecJson: OpenAPIV3_1.Document) {

        // NOTE: renderer logic is the same as v3.0, so we reuse it
        // There's actually no difference in rendering between OpenAPI v3.0 and v3.1 for our purposes
        super(configFile, templates, openApiSpecJson as OpenAPIV3.Document);
    }

}
