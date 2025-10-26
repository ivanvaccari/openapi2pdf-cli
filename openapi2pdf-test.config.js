module.exports = {

    template: "postman",
    openApiUrl: "https://api.apis.guru/v2/specs/ably.io/platform/1.1.0/openapi.json",
    metadata:{
        title: "Ably Platform API Documentation",
        description: "Comprehensive documentation for the Ably Platform API, generated from the OpenAPI specification.Comprehensive documentation for the Ably Platform API, generated from the OpenAPI specification.Comprehensive documentation for the Ably Platform API, generated from the OpenAPI specification.Comprehensive documentation for the Ably Platform API, generated from the OpenAPI specification.Comprehensive documentation for the Ably Platform API, generated from the OpenAPI specification.Comprehensive documentation for the Ably Platform API, generated from the OpenAPI specification.Comprehensive documentation for the Ably Platform API, generated from the OpenAPI specification.",
        currentVersion: "1.2.0",
        host: "api.ably.io",
        swaggerUrl: "https://rest.ably.io",
        revisions: [{
                version:'1.0.0',
                date: '2024-06-01',
                authors: 'Al',
                changes: 'Initial release of the Ably Platform API documentation.'
            },
            {
                version:'1.1.0',
                date: '2024-06-15',
                authors: 'John',
                changes: 'Updated documentation to reflect new endpoints and features in version 1.1.0 of the Ably Platform API.'
            },
            {
                version:'1.2.0',
                date: '2024-07-01',
                authors: 'Jack',
                changes: 'Added examples and improved descriptions for better clarity in version 1.2.0 of the Ably Platform API documentation.'
            }
        ]    
    },
    pdfOptions:{
        margin: {
            top: "15mm",
            right: "10mm",
            bottom: "15mm",
            left: "10mm"
        },
        format: "A4",
        scale: 0.75
    },
    outputFiles: {
        pdf: "output/test.pdf",
        html: "output/test.html"
    }
}