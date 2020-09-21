const axios = require("axios");
const { createRemoteFileNode } = require("gatsby-source-filesystem");

const eventsNodeName = "D365Events";
const speakersNodeName = "D365Speakers";
const sponsorshipsNodeName = "D365Sponsorships";
const versionSpec = "/EvtMgmt/api/v2.0/";
const tokenParam = "?emApplicationtoken=";
const eventsUri = `${versionSpec}events/published${tokenParam}`;
const sponsorshipsUri = `${versionSpec}events/{id}/sponsorships${tokenParam}`;
const speakersUri = `${versionSpec}events/{id}/speakers${tokenParam}`;
let isInitialized = false;

exports.sourceNodes = async ({ actions, createContentDigest }, options) => {
  const headers = getHeaders(options);
  const { endpoint, token } = options;
  const httpOptions = { headers, endpoint, token };

  const { createNode } = actions;
  const createNodeOptions = {
    createNode,
    createContentDigest,
  };

  // TODO image handling for event
  // TODO image handling for sponsor

  const events = await getEvents(httpOptions);
  const eventIds = events.map((event) => event.readableEventId);
  const speakers = await getEventResources(eventIds, speakersUri, httpOptions);
  const sponsorships = await getEventResources(
    eventIds,
    sponsorshipsUri,
    httpOptions
  );

  const hydratedEvents = events.map((event) => ({
    ...event,
    speakers: getRelatedEntities(event, speakers),
    sponsorships: getRelatedEntities(event, sponsorships),
  }));

  createNodesForEntities(createNodeOptions, eventsNodeName, hydratedEvents);

  const flattenedSpeakersList = flattenMap(speakers);
  createNodesForEntities(
    createNodeOptions,
    speakersNodeName,
    flattenedSpeakersList
  );

  const flattenedSponsorshipsList = flattenMap(sponsorships);
  createNodesForEntities(
    createNodeOptions,
    sponsorshipsNodeName,
    flattenedSponsorshipsList
  );

  isInitialized = true;
};

const getHeaders = (options) => {
  if (isOptionsInitialized(options)) {
    throw "Endpoint, token and origin must be defined in gatsby-config.js.";
  }

  return {
    headers: {
      "Content-Type": "application/json",
      Origin: stripTrailingSlash(options.origin),
    },
    method: "GET",
  };
};

const isOptionsInitialized = (options) =>
  options.endpoint === undefined ||
  options.token === undefined ||
  options.origin === undefined;

const stripTrailingSlash = (str) => {
  return str.endsWith("/") ? str.slice(0, -1) : str;
};

const getEvents = async (httpOptions) => {
  const eventsResponse = await axios.get(
    `${httpOptions.endpoint}${eventsUri}${httpOptions.token}`,
    httpOptions.headers
  );

  return eventsResponse.data.map((event) => ({ ...event, id: event.eventId }));
};

const getEventResources = async (eventIds, uri, httpOptions) => {
  return axios
    .all(
      eventIds.map(async (id) => {
        const currentUri = uri.replace("{id}", id);
        const result = await axios.get(
          `${httpOptions.endpoint}${currentUri}${httpOptions.token}`,
          httpOptions.headers
        );
        return [id, result.data];
      })
    )
    .then(axios.spread((...responses) => new Map(responses)))
    .catch((errors) => console.error(errors));
};

const getRelatedEntities = (event, entities) =>
  entities.get(event.readableEventId).map((entity) => entity.id);

const flattenMap = (map) => [].concat.apply([], Array.from(map.values()));

const createNodesForEntities = (createNodeOptions, nodeName, entities) => {
  const { createNode, createContentDigest } = createNodeOptions;
  entities.forEach((entity) =>
    createNode({
      ...entity,
      parent: null,
      children: [],
      internal: {
        type: nodeName,
        content: JSON.stringify(entity),
        contentDigest: createContentDigest(entity),
      },
    })
  );
};

exports.onCreateNode = async (
  { node, actions: { createNode }, store, cache, createNodeId, reporter },
  options
) => {
  if (node.internal.type === speakersNodeName) {
    try {
      let fileNode = await createRemoteFileNode({
        url: `${options.endpoint}${versionSpec}${node.imageUrl}`,
        name: node.name,
        parentNodeId: node.id,
        createNode,
        createNodeId,
        cache,
        store,
      });

      if (fileNode) {
        node.image___NODE = fileNode.id;
      }
    } catch (e) {
      console.error("gatsby-source-d365-events ERROR:", e);
    }
  }
};

exports.createSchemaCustomization = ({ actions, schema }) => {
  if (!isInitialized) return;
  const { createTypes } = actions;
  createTypes([
    schema.buildObjectType({
      name: eventsNodeName,
      fields: {
        speakers: {
          type: `[${speakersNodeName}]`,
          resolve: (source, args, context) => {
            return context.nodeModel.getNodesByIds({
              ids: source.speakers,
              type: `${speakersNodeName}`,
            });
          },
        },
        sponsorships: {
          type: `[${sponsorshipsNodeName}]`,
          resolve: (source, args, context) => {
            return context.nodeModel.getNodesByIds({
              ids: source.sponsorships,
              type: `${sponsorshipsNodeName}`,
            });
          },
        },
      },
      interfaces: ["Node"],
    }),
  ]);
};
