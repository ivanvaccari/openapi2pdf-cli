# openapi2pdf-cli

A cli tool to generate PDF documentation from OpenAPI specifications using customizable templates.

:warning: This is a work in progress. Use at your own risk.

## TODO
- [ ] Add security schemes rendering

## Features

- Reads OpenAPI specs from URL
- Supports HTML and PDF output formats
- Customizable templates using Handlebars
- Some built-in templates for immediate use (one inspired by [Postman](https://www.postman.com/), one inspired by other sources)

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
npm link
```

Note: the `npm link` command makes the `openapi2pdf` command available globally on your system. You can skip this step and run the tool using `npx openapi2pdf-cli --config openapi2pdf.config.js` instead (from the project root directory).

### Run the generator

To run the tool, use the following command:

```bash
openapi2pdf --config openapi2pdf.config.js
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

The following templates are available out of the box:
- `postman`,  inspired by the Postman documentation style
- `hurraycola`, inspired by some random documents found online

Omitting the `template` option in the configuration file will use the `postman` built-in template.

You can customize the templates in two ways:
- define your own template directory in your working directory (eg: where the config file is located), in which you must specify **all** the required template files. Set the relative path of the template directory in the `template` option of the configuration file.
- define a directory with the same name of a built-in template (e.g. `postman` or `hurraycola`) in your working directory (eg: where the config file is located), and override only the files you want to customize. The other files will be taken from the built-in template. Set the name of the built-in template in the `template` option of the configuration file,

Based on your case, you can use one of the built-in templates as a starting point and customize it to your needs. The following files are defined in each template:

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


## Examples

See the [samples](./samples) directory for example configuration file and generated documentation.



