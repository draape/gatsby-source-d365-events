const axios = require("axios");

exports.onPreInit = () => console.log("Loaded gatsby-source-d365-events");

exports.sourceNodes = async (
  { actions, createContentDigest, createNodeId },
  options
) => {
  // TODO Guards for options.endpoint, options.token, options.origin
  const { createNode } = actions;

  const request = await axios.get(
    `${options.endpoint}/EvtMgmt/api/v2.0/events/published?emApplicationtoken=${options.token}`,
    {
      headers: {
        "Content-Type": "application/json",
        Origin: options.origin,
      },
      method: "GET",
    }
  );

  request.data.forEach((event) =>
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
