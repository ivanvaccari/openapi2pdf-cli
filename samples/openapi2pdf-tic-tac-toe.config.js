/**
 * Example cofig file for openapi2pdf-cli
 * 
 * For file format, see: https://github.com/ivanvaccari/openapi2pdf-cli/blob/d4fe275d8bcd8a91f0ef3e79a0094c3bc6acda30/src/types.ts#L6
 */


module.exports = {
    template: "hurraycola",
    openapiJsonPath: "https://raw.githubusercontent.com/OAI/learn.openapis.org/refs/heads/main/examples/v3.1/tictactoe.json",
    metadata:{
        revisions: [{
                version:'1.0.0',
                date: '2024-06-01',
                authors: 'Elio',
                changes: 'Initial release of the API documentation.'
            },
            {
                version:'1.1.0',
                date: '2024-06-15',
                authors: 'Storie tese',
                changes: 'Updated documentation to reflect new endpoints and features in version 1.1.0 of the Platform API.'
            },
            {
                version:'1.2.0',
                date: '2024-07-01',
                authors: 'Jack',
                changes: 'Added examples and improved descriptions for better clarity in version 1.2.0 of the Platform API documentation.'
            }
        ],
        pdf: {
            title: "Platform API Documentation",
            author: "Al"
        }
    },
    pdfOptions:{
        margin: {
            top: "15mm",
            right: "10mm",
            bottom: "15mm",
            left: "10mm"
        },
        format: "A4",
        scale: 0.80
    },
    outputFiles: {
        pdf: "samples/tic-tac-toe-hurraycola.pdf",
        html: "samples/tic-tac-toe-hurraycola.html"
    }
}