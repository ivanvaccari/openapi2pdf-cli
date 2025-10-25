import { program } from "commander";
import { loadConfigFile } from "./load-config-file";
import axios from "axios";
import fs from "fs";
import {
    findTemplatePath,
    loadTemplateFiles,
    renderHtml,
} from "./template-utils";
import { renderPdf } from "./render-pdf";

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
    const configFile = await loadConfigFile(program.opts().config);

    // Validate required fields in config file
    if (!configFile.openApiUrl)
        throw new Error("openApiUrl is required in config file");

    // Find template path
    const templatePath = await findTemplatePath(configFile.template);

    // fetch OpenAPI specification
    console.log(
        `Fetching OpenAPI specification from ${configFile.openApiUrl}...`,
    );
    const openApiSpecRsponse = await axios.get(configFile.openApiUrl);
    if (openApiSpecRsponse.status !== 200) {
        throw new Error(
            `Failed to fetch OpenAPI specification from ${configFile.openApiUrl}, status code: ${openApiSpecRsponse.status}`,
        );
    }
    console.log("OpenAPI specification fetched successfully.");
    let openApiSpecJson = openApiSpecRsponse.data;

    // Apply transformation if provided
    if (typeof configFile.transform === "function") {
        openApiSpecJson = configFile.transform(openApiSpecJson);
    }

    // Simple check to prevent empty spec
    if (!openApiSpecJson) {
        throw new Error("OpenAPI specification is empty");
    }

    // Load the template files so the're ready to be used
    const templates = await loadTemplateFiles(templatePath);

    // start to render the html.
    const html = await renderHtml(configFile, templates, openApiSpecJson);

    // render the pdf
    let pdfBuffer: Buffer | undefined;
    if (configFile.ouputFiles?.pdf) {
        pdfBuffer = await renderPdf(html, configFile, templates);
    }
    // save the output html if needed
    if (configFile.ouputFiles?.html) {
        fs.writeFileSync(configFile.ouputFiles.html, html);
        console.log(`HTML document saved to ${configFile.ouputFiles.html}`);
    }

    // save the output files
    if (pdfBuffer) {
        fs.writeFileSync(configFile.ouputFiles.pdf, pdfBuffer);
        console.log(`PDF document saved to ${configFile.ouputFiles.pdf}`);
    }
}

run().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
