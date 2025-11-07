#!/usr/bin/env node

import { program } from "commander";
import { loadConfigFile, mergeConfigFileMetadata } from "./config-file";
import fs from "fs";
import { loadTemplateFiles, renderHtml } from "./template-utils";
import { renderPdf } from "./render-pdf";
import { loadOpenApiJson } from "./lib/load-open-api-json";

/**
 * Main entry point of the tool
 */
async function run() {
    program.option("--config <string>");
    program.parse();

    // Ensure config file is provided
    if (!program.opts().config) {
        throw new Error("Config file is required. Use --config <path>");
    }

    // Load configuration file
    let configFile = await loadConfigFile(program.opts().config);

    // Validate required fields in config file
    if (!configFile.openapiJsonPath) throw new Error("openapiJsonPath is required in config file");

    // Load the template files so they're ready to be used
    const templates = await loadTemplateFiles(configFile);

    // fetch OpenAPI specification
    console.log(`Loading OpenAPI specification from ${configFile.openapiJsonPath}...`);
    let openApiSpecJson = await loadOpenApiJson(configFile.openapiJsonPath);
    console.log("OpenAPI specification loaded successfully.");

    // Merge some metadata from OpenAPI spec if not provided in config file
    configFile = mergeConfigFileMetadata(configFile, openApiSpecJson);

    // Apply transformation if provided
    if (typeof configFile.transform === "function") {
        openApiSpecJson = configFile.transform(openApiSpecJson);
    }

    // Simple check to prevent empty spec
    if (!openApiSpecJson) {
        throw new Error("OpenAPI specification is empty");
    }



    // start to render the html.
    const renderedContent = await renderHtml(configFile, templates, openApiSpecJson);

    // render the pdf
    let pdfBuffer: Buffer | undefined;
    if (configFile.outputFiles?.pdf) {
        pdfBuffer = await renderPdf(renderedContent, configFile);
    }
    // save the output html if needed
    if (configFile.outputFiles?.html) {
        fs.writeFileSync(configFile.outputFiles.html, renderedContent.body);
        console.log(`HTML document saved to ${configFile.outputFiles.html}`);
    }

    // save the output files
    if (pdfBuffer) {
        fs.writeFileSync(configFile.outputFiles.pdf, pdfBuffer);
        console.log(`PDF document saved to ${configFile.outputFiles.pdf}`);
    }
}

run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
