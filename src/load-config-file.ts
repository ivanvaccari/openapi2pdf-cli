import fs from "fs/promises";
import { ConfigFile } from "./types";
import path from "path";
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
        return require(path.join(process.cwd(), filePath));
    } catch (err: any) {
        throw new Error(
            `Error loading config file ${path.resolve(filePath)}, ${err.message}`,
        );
    }
}
