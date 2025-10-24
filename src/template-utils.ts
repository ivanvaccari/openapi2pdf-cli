import fs from "fs/promises";
import path from "path";
import { ConfigFile, GenericObject, TemplateFiles } from "./types";
import Handlebars from "handlebars";

export const templateFiles: TemplateFiles = {
    style: "style.css",
    header: "header.hbs",
    footer: "footer.hbs",
    frontpage: "frontpage.hbs",
    lastpage: "lastpage.hbs",
    revisions: "revisions.hbs",
    summary: "summary.hbs",
};

/**
 * Find the path where the template is located.
 * If not provided, use the default built-in template "postman"
 *
 * @param templatePath
 * @returns
 */
export async function findTemplatePath(templatePath?: string): Promise<string> {
    if (!templatePath) {
        return path.join(__dirname, "../templates/postman");
    }

    // try to find template in current working directory
    let _tmp = path.join(process.cwd(), templatePath);
    try {
        await fs.stat(_tmp);
        return _tmp;
    } catch (err) {}

    // try to find template in built-in templates directory
    _tmp = path.join(__dirname, "../templates/", templatePath);
    try {
        await fs.stat(_tmp);
        return _tmp;
    } catch (err) {}

    throw new Error(
        `Template ${templatePath} not found in cwd() or built-in templates`,
    );
}

/**
 * Load the template files content from the given template path
 * @param templatePath
 * @returns
 */
export async function loadTemplateFiles(
    templatePath: string,
): Promise<TemplateFiles> {
    const _templateFiles: TemplateFiles = { ...templateFiles };

    // load the templates
    for (const _key in _templateFiles) {
        const key = _key as keyof TemplateFiles;
        _templateFiles[key] = await fs
            .readFile(path.join(templatePath, _templateFiles[key]))
            .then((data) => data.toString());
    }

    templatePath = templatePath.replace(/\//g, "\\");

    // resolves "url(...)" in css to base64 data urls
    const regex = /url\(['"]([^'")]+)['"]\)/gm;
    const matcher = _templateFiles.style.matchAll(regex);
    for (const match of matcher) {
        const originalUrl = match[1];
        if (originalUrl){
            const fileBufer = await fs.readFile(path.join(templatePath, originalUrl));
            const base64Data = fileBufer.toString('base64');
            const ext = path.extname(originalUrl).substring(1);
            const dataUrl = `data:image/${ext};base64,${base64Data}`;
            _templateFiles.style = _templateFiles.style.replace(originalUrl, dataUrl);
        }
    }

    // resolves "<img src="...">" in tempates to base64 imgs
    const imgRegex = /<img\s+[^>]*src=['"]([^'"]+)['"][^>]*>/gm;
    for (const key of Object.keys(_templateFiles) as (keyof TemplateFiles)[]) {
        const templateContent = _templateFiles[key];
        const imgMatcher = templateContent.matchAll(imgRegex);
        for (const match of imgMatcher) {
            const originalSrc = match[1];
            if (originalSrc) {
                const fileBufer = await fs.readFile(path.join(templatePath, originalSrc));
                const base64Data = fileBufer.toString('base64');
                const ext = path.extname(originalSrc).substring(1);
                const dataUrl = `data:image/${ext};base64,${base64Data}`;
                _templateFiles[key] = _templateFiles[key].replace(originalSrc, dataUrl);
            }
        }
    }

    return _templateFiles;
}

/**
 * Renders HTML content using Handlebars template engine.
 *
 * @param templateContent
 * @param data
 */
export async function renderHtml(
    configFile: ConfigFile,
    _templateFiles: TemplateFiles,
    openApiSpecJson: GenericObject,
): Promise<string> {
    const finalTemplate = [
        "<html>",
        "<head>",
        "<style>",
        _templateFiles.style,
        "</style>",
        "</head>",
        "<body>",
        _templateFiles.frontpage,
        _templateFiles.revisions,
        _templateFiles.summary,
        // ... altra roba qui
        _templateFiles.lastpage,
        "</body>",
        "</html>",
    ].join("\n");

    const template = Handlebars.compile(finalTemplate);

    return template({
        metadata: configFile.metadata,
        openApiUrl: configFile.openApiUrl,
    });
}
