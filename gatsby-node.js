const axios = require("axios");

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

  const eventsResponse = await axios.get(
    `${options.endpoint}${eventsUri}${options.token}`,
    headers
  );

  const eventIds = eventsResponse.data.map((event) => event.readableEventId);
  const speakers = await getMultipleRequests(eventIds, speakersUri, options);
  const sponsorships = await getMultipleRequests(
    eventIds,
    sponsorshipsUri,
    options
  );

  const events = eventsResponse.data.map((event) => ({
    ...event,
    speakers: speakers.get(event.readableEventId),
    sponsorships: sponsorships.get(event.readableEventId),
  }));

  console.log(events);

  events.forEach((event) =>
    createNode({
      ...event,
      id: createNodeId(`Event-${event.eventId}`),
      parent: null,
      children: [],
      internal: {
        type: "Event",
        content: JSON.stringify(event),
        contentDigest: createContentDigest(event),
      },
    })
  );

  return;
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
    .then(
      axios.spread(
        (...responses) => new Map(responses.map((response) => response))
      )
    )
    .catch((errors) => console.error(errors));
};

const isOptionsInitialized = (options) =>
  options.endpoint === undefined ||
  options.token === undefined ||
  options.origin === undefined;
