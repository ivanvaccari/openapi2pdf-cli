import { PaperFormat } from "puppeteer";

/**
 * A generic object with string keys and any type values
 */
export type GenericObject = {
    [key: string]: GenericObject | GenericObject[] | string | number | boolean | null | undefined;
};

export type TemplateFiles = {
    /**
     * Css style to be applied to the document. This content is compiled with sass before use, so it can use sass features.
     */
    style: string;

    /**
     * Template to be used as header of each page
     */
    header: string;

    /**
     * Template to be used as footer of each page
     */
    footer: string;

    /**
     * Template to be used as first page of the document
     */
    frontpage: string;

    /**
     * Template to be used as last page of the document
     */
    lastpage: string;

    /**
     * Template to be inserted after frontpage and before rest api documentation
     */
    revisions: string;

    /**
     * Template to be inserted after revisions and before rest api documentation
     */
    summary: string;

    /**
     * Authentication modes description
     */
    authentication: string;

    /**
     * Assumptions for using these apis, like data formats
     */
    assumptions: string;

    /**
     * Template to be used for each operation documentation
     */
    operation: string;

    /**
     * Template for operation parameter
     */
    operationParameter: string;

    /**
     * Template for operation response
     */
    operationResponse: string;

    /**
     * Template for operation response for a single content-type
     */
    operationResponseContentType: string;

    /**
     * One line of the table of contents
     */
    tocLine: string;

    /**
     * Table of contents template
     */
    toc: string;

    /**
     * Template for the toc tag
     */
    tocTag: string;

    /**
     * Template for the api page
     */
    api: string;

    /**
     * Template for the schemas section
     */
    schemas: string;

    /**
     * Body template for methods that support it (like POST, PUT, PATCH)
     */
    operationBody: string;

    /**
     * Directories of partials. If you want to use partials, you need to provide a directory with the partials files.
     * The name of the file (excluded .hbs) will be the name of the partial. For example, if you have a file `partials/my-partial.hbs`, you can include it in your templates using `{{> my-partial}}`.
     */
    partials?:string

    /**
     * Internal object where loaded partials are stored.
     */
    loadedPartials: {[key: string]: string};
};

/**
 * Rendered html content
 */
export type RenderedHtmlContent = {
    /**
     * Body content of the rendered html
     */
    body: string;

    /**
     * Header content of the rendered html
     */
    header: string;

    /**
     * Footer content of the rendered html
     */
    footer: string;
};

/**
 * Configuration file type
 */
export type ConfigFile = {
    /**
     * Template files directory. If provided, the system checks, in this order:
     * - presence of a relative directory with the provided name.
     * - presence of built-in template with the provided name
     *
     * At least one directory with a copy of each template file is expected to be found, if both directories are present, template files are loaded from the first one found.
     * In this way, you can override single built-in template files by providing a directory in the current working directory with the same name of the built-in template.
     * 
     * If you want to use a custom template directory not present in the built-in templates, you need to provide a directory with all the template files.
     *
     * If omitted, defaults to "postman".
     */
    template?: string;


    /**
     * Output file path for the generated files
     */
    outputFiles: {
        /**
         * Path to the output pdf file. If omitted the pdf will not be generated
         */
        pdf: string;

        /**
         * Path to the output html file. If omitted the html will not be generated
         */
        html: string;
    };

    /**
     * Url or local file path of the open api specification.
     */
    openapiJsonPath: string;

    metadata: {
        /**
         * Metadata to be set on the pdf file
         */
        pdf?: {
            /**
             * Title of the document
             */
            title?: string;

            /**
             * Author of the document
             */
            author?: string;
        };

        /**
         * Metadata information about the api/documentation
         */
        info?: {
            /**
             * Main title of the documentation. If omitted, the "title" field from open api specification info object is used.
             */
            title?: string;

            /**
             * Description of the documentation. If omitted, the "description" field from open api specification info object is used.
             */
            description?: string;

            /**
             * Current version of the api/documentation. If omitted, the "version" field from open api specification info object is used.
             */
            version?: string;
        };

        /**
         * Server for api endpoints. If omitted, the servers in the open api specification is used.
         */
        servers?: {
            url: string;
        }[];

        /**
         * Url of swaggerUi
         */
        swaggerUrl?: string;

        /**
         * Revisions information
         */
        revisions?: {
            /**
             * Document or api version
             */
            version?: string;

            /**
             * Revision date.
             */
            date?: string | Date;

            /**
             * authors of the revision
             */
            authors?: string;

            /**
             * description of the changes in this revision
             */
            changes?: string;
        }[];
    };

    /**
     * This is a subset of https://pptr.dev/api/puppeteer.pdfoptions
     *
     * some options, like header and footer-related are managed via templates and cannot be set here.
     */
    pdfOptions?: {
        /**
         * Scale of the webpage rendering. Defaults to 1, must be between 0.1 and 2.
         * 0.1 -> text appear smaller, 2 -> text appear larger
         */
        scale?: number;

        /**
         * Page ranges to print, e.g., '1-5, 8, 11-13'. Defaults to all pages.
         * See https://pptr.dev/api/puppeteer.pdfoptions
         */
        pageRanges?: string;

        /**
         * Paper format. See https://pptr.dev/api/puppeteer.paperformat
         * Defaults to 'A4'
         */
        format?: PaperFormat;

        /**
         * Sets the width of paper. You can pass in a number or a string with a unit.
         * See https://pptr.dev/api/puppeteer.pdfoptions
         */
        width?: string | number;

        /**
         * Sets the height of paper. You can pass in a number or a string with a unit.
         * See https://pptr.dev/api/puppeteer.pdfoptions
         */
        height?: string | number;

        /**
         * Page margins. See https://pptr.dev/api/puppeteer.pdfmargin
         */
        margin?: {
            top?: string | number; // defaults to 15mm
            right?: string | number; // defaults to 15mm
            bottom?: string | number; // defaults to 15mm
            left?: string | number; // defaults to 15mm
        };

        /**
         * Other pdf options supported by puppeteer
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    };

    /**
     * If defined, receives the open api specification json end must return an openapi specification json.
     * You can use this to modify the open api specification before generating the documentation
     *
     * @param openApiSpecJson
     * @returns
     */
    transform?: (openApiSpecJson: any) => any;
};
