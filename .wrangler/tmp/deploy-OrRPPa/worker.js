// worker.js
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    let response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      if (!path.endsWith("/")) path += "/";
      const indexUrl = new URL(request.url);
      indexUrl.pathname = path + "index.html";
      response = await env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }
    return response;
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
