import fs from "fs/promises";
import { ConfigFile } from "./types";
import path from "path";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import _ from "lodash";
/**
 * Loads a configuration file, supporting both JSON and JS formats.
 *
 * @param path - The path to the configuration file.
 * @returns The parsed configuration object.
 */
export async function loadConfigFile(filePath: string): Promise<ConfigFile> {
    try {
        await fs.stat(filePath);
    } catch (err) {
        throw new Error(`Config file ${filePath} not found `);
    }

    try {
        if (filePath.toLowerCase().endsWith(".json")) {
            const content = await fs.readFile(filePath, "utf-8");
            return JSON.parse(content.toString());
        }
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(path.join(process.cwd(), filePath));
    } catch (err: any) {
        throw new Error(`Error loading config file ${path.resolve(filePath)}, ${err.message}`);
    }
}

/**
 * Merge metadata from OpenAPI spec into config file if not already defined
 *
 * @param configFile
 * @param openApiSpecJson
 * @returns The merged config file
 */
export function mergeConfigFileMetadata(
    configFile: ConfigFile,
    openApiSpecJson: OpenAPIV3.Document<{}> | OpenAPIV3_1.Document<{}>,
): ConfigFile {

    // Merge the info object
    _.set(configFile, "metadata.info", _.merge({}, configFile.metadata.info ?? {}, openApiSpecJson.info ?? {}));

    // If servers are not defined in metadata, use those from OpenAPI spec
    if (!configFile.metadata?.servers) {
        _.set(configFile, "metadata.servers", openApiSpecJson.servers);
    }

    return configFile;
}
