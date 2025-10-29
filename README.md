# openapi2pdf-cli

A cli tool to generate PDF documentation from OpenAPI specifications using customizable templates.

## Features

- Reads OpenAPI specs from URL
- Supports HTML and PDF output formats
- Customizable templates using Handlebars
- One built-in template for immediate use (inspired by [Postman](https://www.postman.com/))

## Usage

Write a configuration file (e.g., `openapi2pdf.config.js`):

```javascript
module.exports = {
    openapiJsonPath: "https://api.apis.guru/v2/specs/ably.io/platform/1.1.0/openapi.json",
    ouputFiles: {
        pdf: "output/documentation.pdf",
        html: "output/documentation.html"
    }
}
```

then run the tool:

```bash
node dist/index.js --config openapi2pdf.config.js
```

You will find the generated documentation in the specified output files.

## Configuration file

This tool supports readong `json` and `js` configuration files.

`Js` files should export the [ConfigFile](./src/types.ts) object:
```javascript
module.exports = {
    // options
}
```

`json` files directly contain the [ConfigFile](./src/types.ts) object:

The full set of available options is describet in [ConfigFile type](./src/types.ts) file.


## Templates

The tool uses Handlebars templates to generate the documentation. You can provide your own templates by specifying the `template` option in the configuration file. The value should be the path to a directory (local to cwd()) containing the following files:

TODO

If the tool does not find the specified files in the template directory, it will search for them in the built-in template directory.

All files are mandatory, if you don't want to skip the render of the specified section, create an empty file.

If you don't provide a template, the built-in `postman` template will be used.