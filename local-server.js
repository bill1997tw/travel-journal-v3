const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const googleMapsPlaceHandler = require("./api/google-maps-place.js");

const root = __dirname;
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function getCacheControl(filePath) {
  const fileName = path.basename(filePath);
  if (
    fileName === "index.html"
    || fileName === "app.js"
    || fileName === "cloud-sync.js"
    || fileName === "supabase-config.js"
    || fileName === "sw.js"
    || fileName === "manifest.webmanifest"
  ) {
    return "no-cache";
  }
  return "public, max-age=3600";
}

function createApiResponse(res) {
  let statusCode = 200;
  const headers = {};

  return {
    status(code) {
      statusCode = Number(code) || 200;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
    json(payload) {
      res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        ...headers
      });
      res.end(JSON.stringify(payload));
    },
    send(payload) {
      res.writeHead(statusCode, headers);
      res.end(payload);
    }
  };
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${port}`}`);
  const requestPath = requestUrl.pathname;

  if (requestPath === "/api/google-maps-place") {
    try {
      await googleMapsPlaceHandler(
        {
          method: req.method,
          headers: req.headers,
          query: Object.fromEntries(requestUrl.searchParams.entries())
        },
        createApiResponse(res)
      );
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Local API handler failed." }));
    }
    return;
  }

  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(root, relativePath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": getCacheControl(filePath)
    });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Travel Journal local server running at http://127.0.0.1:${port}`);
});
