const axios = require("axios");
const { createRemoteFileNode } = require("gatsby-source-filesystem");

const eventsNodeName = "D365Events";
const speakersNodeName = "D365Speakers";
const sponsorshipsNodeName = "D365Sponsorships";
const versionSpec = "/EvtMgmt/api/v2.0";
const tokenParam = "?emApplicationtoken=";
const eventsUri = `${versionSpec}/events/published${tokenParam}`;
const sponsorshipsUri = `${versionSpec}/events/{id}/sponsorships${tokenParam}`;
const speakersUri = `${versionSpec}/events/{id}/speakers${tokenParam}`;
const headers = {
  headers: {
    "Content-Type": "application/json",
  },
  method: "GET",
};

exports.sourceNodes = async (
  { actions, createContentDigest, createNodeId },
  options
) => {
  if (isOptionsInitialized(options)) {
    console.error(
      "Endpoint, token and origin must be passed as options in gatsby-config.js."
    );
    return;
  }

  headers.headers.Origin = options.origin;

  // TODO strip trailing slash from options.endpoint

  const { createNode } = actions;

  // TODO connect sponsors to events
  // TODO image handling for event
  // TODO image handling for sponsor

  const events = await getEvents(options);
  const eventIds = events.map((event) => event.readableEventId);
  const speakers = await getMultipleRequests(eventIds, speakersUri, options);

  const hydratedEvents = events.map((event) => ({
    ...event,
    speakers: speakers.get(event.readableEventId).map((speaker) => speaker.id),
  }));

  hydratedEvents.forEach((event) =>
    createNode({
      ...event,
      id: event.eventId,
      parent: null,
      children: [],
      internal: {
        type: eventsNodeName,
        content: JSON.stringify(event),
        contentDigest: createContentDigest(event),
      },
    })
  );

  const flattenedSpeakersList = flattenMap(speakers);
  flattenedSpeakersList.forEach((speaker) =>
    createNode({
      ...speaker,
      parent: null,
      children: [],
      internal: {
        type: speakersNodeName,
        content: JSON.stringify(speaker),
        contentDigest: createContentDigest(speaker),
      },
    })
  );

  // const sponsorships = await getMultipleRequests(
  //   eventIds,
  //   sponsorshipsUri,
  //   options
  // );
  // sponsorships.forEach((sponsorship) =>
  //   createNode({
  //     ...sponsorship,
  //     parent: null,
  //     children: [],
  //     internal: {
  //       type: sponsorshipsNodeName,
  //       content: JSON.stringify(sponsorship),
  //       contentDigest: createContentDigest(sponsorship),
  //     },
  //   })
  // );
  return;
};

exports.onCreateNode = async (
  { node, actions: { createNode }, store, cache, createNodeId, reporter },
  options
) => {
  if (node.internal.type === speakersNodeName) {
    try {
      let fileNode = await createRemoteFileNode({
        url: `${options.endpoint}${versionSpec}/${node.imageUrl}`,
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
      },
      interfaces: ["Node"],
    }),
  ]);
};

const getEvents = async (options) => {
  const eventsResponse = await axios.get(
    `${options.endpoint}${eventsUri}${options.token}`,
    headers
  );

  return eventsResponse.data;
};

const getMultipleRequests = async (eventIds, uri, options) => {
  return axios
    .all(
      eventIds.map(async (id) => {
        const currentUri = uri.replace("{id}", id);
        const result = await axios.get(
          `${options.endpoint}${currentUri}${options.token}`,
          headers
        );
        return [id, result.data];
      })
    )
    .then(axios.spread((...responses) => new Map(responses)))
    .catch((errors) => console.error(errors));
};

const flattenMap = (map) => [].concat.apply([], Array.from(map.values()));

const isOptionsInitialized = (options) =>
  options.endpoint === undefined ||
  options.token === undefined ||
  options.origin === undefined;
