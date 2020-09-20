# gatsby-source-d365-events

Source plugin for pulling data from Microsoft Dynamics 365 event management into [Gatsby](https://www.gatsbyjs.org/) websites.

## Install

From the command line, use npm to install the plugin:

```console
npm install gatsby-source-d365-events
```

In the `gatsby-config.js` file in the Gatsby project's root directory, add the plugin configuration inside of the `plugins` section. Every option is mandatory and can be found where you [register your web application](https://docs.microsoft.com/en-us/dynamics365/marketing/developer/register-web-application-events-api):

```js:title=gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: `gatsby-source-d365-events`,
      options: {
        endpoint: `https://abc.svc.dynamics.com`,
        token: process.env.D365_TOKEN,
        origin: "https://myorigin.local",
      },
    },
  ],
};
```

## Using .env variables

You should definitely not include you token information in your source code. To configure this and enable easy deployment to multiple environments using different instances of D365, you can use environment variables.

In your .env file

```text:title=.env
D365_ENDPOINT = https://abd.svc.dynamics.com
D365_TOKEN = secret!
D365_ORIGIN = https://myorigin.local
```

In your gatsby-config.js file

```js:title=gatsby-config.js
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`,
});

module.exports = {
  plugins: [
    {
      resolve: "gatsby-source-d365-events",
      options: {
        endpoint: process.env.D365_ENDPOINT,
        token: process.env.D365_TOKEN,
        origin: process.env.D365_ORIGIN,
      },
    },
  ],
};
```
