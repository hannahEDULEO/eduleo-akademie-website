export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Direkter Versuch
    let response = await env.ASSETS.fetch(request);

    // Bei 404: index.html im Verzeichnis versuchen
    if (response.status === 404) {
      if (!path.endsWith('/')) path += '/';
      const indexUrl = new URL(request.url);
      indexUrl.pathname = path + 'index.html';
      response = await env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return response;
  }
};
