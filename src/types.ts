export type ConfigFile = {
    /**
     * Template files directory. If provided, must be a reltive path directory.
     * This first check for existence from cwd(), then checks for existence in local templates directory.
     * If omitted, defaults to "postman".
     *
     * Example: "postman" if not found in cwd()/postman then checks in __dirname/templates/postman
     */
    template?: string;

    /**
     * Output file path for the generated files
     */
    ouputFiles: {
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
     * Url of the open api specification
     */
    openApiUrl: string;

    metadata: {
        /**
         * Metadata to be set on the pdf file
         */
        pdf?: {
            title?: string;
            author?: string;
        };

        /**
         * Main title of the documentation
         */
        title?: string;

        /**
         * Description of the documentation
         */
        description?: string;

        /**
         * Current version of the api/documentation
         */
        currentVersion?: string;

        /**
         * Api endpoint host
         */
        host?: string;

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
     * Pdf options.same as:
     * - https://jsreport.net/learn/chrome-pdf#options
     * - https://github.com/puppeteer/puppeteer/blob/v1.11.0/docs/api.md#pagepdfoptions
     */
    pdfOptions?: {
        scale?: number;
        displayHeaderFooter?: boolean;
        headerTemplate?: string;
        footerTemplate?: string;
        printBackground?: boolean;
        pageRanges?: string;
        format?: string;
        width?: string | number;
        height?: string | number;
        marginTop?: string | number;
        marginRight?: string | number;
        marginBottom?: string | number;
        marginLeft?: string | number;
        mediaType?: string;
    }

    /**
     * If defined, receives the open api specification json end must return an openapi specification json.
     * You can use this to modify the open api specification before generating the documentation
     *
     * @param openApiSpecJson
     * @returns
     */
    transform?: (openApiSpecJson: any) => any;
};

/**
 * A generic object with string keys and any type values
 */
export type GenericObject = {
    [key: string]:
        | GenericObject
        | GenericObject[]
        | string
        | number
        | boolean
        | null
        | undefined;
};

export type TemplateFiles = {
    /**
     * Css style to be applied to the document
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
};
