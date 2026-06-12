const requestBody = {
  jsonrpc: "2.0",
  method: "tasks/send",
  params: {
    message: {
      parts: [
        {
          kind: "data",
          metadata: { mimeType: "application/a2ui+json" },
          data: {
            userAction: { name: "whatThisPersonFavFood" },
            arguments: { name: "vinod" }
          }
        }
      ]
    }
  },
  id: "1"
};

fetch("http://localhost:7860/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody)
}).then(res => res.text()).then(console.log).catch(console.error);
