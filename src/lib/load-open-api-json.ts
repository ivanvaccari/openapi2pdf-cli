import axios from "axios";
import fs from "fs";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

/**
 * Loads the OpenAPI JSON from a URL or local file path
 *
 * @param openapiJsonPath
 * @returns
 */
export async function loadOpenApiJson(openapiJsonPath: string): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
    let isUrl = false;
    try {
        const url = new URL(openapiJsonPath);

        isUrl = url.protocol !== "file:";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        isUrl = false;
    }

    if (isUrl) {
        const openApiSpecResponse = await axios.get(openapiJsonPath);
        if (openApiSpecResponse.status !== 200) {
            throw new Error(
                `Failed to fetch OpenAPI specification from ${openapiJsonPath}, status code: ${openApiSpecResponse.status}`,
            );
        }

        return openApiSpecResponse.data;
    } else {
        return JSON.parse(fs.readFileSync(openapiJsonPath, "utf-8").toString());
    }
}
