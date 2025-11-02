# openapi2pdf-cli

A cli tool to generate PDF documentation from OpenAPI specifications using customizable templates.

## Features

- Reads OpenAPI specs from URL
- Supports HTML and PDF output formats
- Customizable templates using Handlebars
- One built-in template for immediate use (inspired by [Postman](https://www.postman.com/))

## Usage

To use this script, you need:

- a Node.js environment
- An OpenAPI v3.x specification (either local file or URL)
- A configuration file `openapi2pdf.config.js`to customize the output

### Installation

```bash
git clone https://github.com/ivanvaccari/openapi2pdf-cli
cd openapi2pdf-cli
npm install
npm run build
```

### Run the generator

To run the tool, use the following command:

```bash
node dist/index.js --config openapi2pdf.config.js
```

You will find the generated documentation in the specified output files.

NOTE: Depending on the size of the OpenAPI specification, the generation process may take some time. Let it run.

## Configuration file

This tool supports reading `json` and `js` configuration files.

`Js` files should export the [ConfigFile](./src/types.ts) object:

```javascript
module.exports = {
    // options
};
```

`json` files directly contain the [ConfigFile](./src/types.ts) object.

See an example configuration file here: [samples\openapi2pdf-test.config.js](./samples/openapi2pdf-test.config.js). The full set of available options is described in [ConfigFile type](./src/types.ts) file.

## Templates

This tool uses handlebars templates to generate the documentation. The template is composed of multiple files, each one responsible for rendering a specific section of the documentation.

This tool provides the following built-in templates:
- `postman`,  inspired by the Postman documentation style
- `hurraycola`, inspired by some random documents found online

Omitting the `template` option in the configuration file will use the `postman` built-in template.

You can use your own template by specifying the `template` option in the configuration file with the path (relative to the config file) to your template directory. The template directory must contain the following files:

- `api.hbs`: template for the "Rest Api" page, which includes all the operations
- `assumptions.hbs`: template for the "Assumptions" page, that you can use to describe any assumption made in the API design or to add custom notes after the `frontpage.hbs` content.
- `frontpage.hbs`: template for the front page of the documentation, that usually contains the title, description and other general information about the API.
- `header.hbs`: template for the header of each page
- `footer.hbs`: template for the footer of each page
- `lastpage.hbs`: template for the last page of the documentation, that usually contains contact information or other notes.
- `operation.hbs`: template for each operation (endpoint) of the API
- `operation-parameter.hbs`: template for each parameter of an operation
- `operation-response.hbs`: template for each response of an operation
- `operation-body.hbs`: template for the request body of an operation
- `operation-response-content-type.hbs`: template for each content type of a response
- `style.scss`: stylesheet for the documentation.
- `toc.hbs`: template for the table of contents
- `toc-line.hbs`: template for each line of the table of contents
- `toc-tag.hbs`: template for each tag section in the table of contents
- `schemas.hbs`: template for the schemas section of the documentation
- `summary.hbs`: template for the summary page of the documentation
- `revisions.hbs`: template for the revisions page of the documentation

You can use one of the built-in templates as a starting point to create your own custom templates.

All template files are mandatory. If you don't want to render a specific section, create an empty file.

## Examples

See the [samples](./samples) directory for example configuration file and generated documentation.

- [./samples/openapi2pdf.config.js](./samples/openapi2pdf.config.js)
- [./samples/shopify-2020.pdf](./samples/shopify-2020.pdf)
- [./samples/pet-store.pdf](./samples/pet-store.pdf)
- [./samples/tic-tac-toe.pdf](./samples/tic-tac-toe.pdf)
