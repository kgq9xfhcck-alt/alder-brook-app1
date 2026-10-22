// Alder Brook Wildlife Centre: Application 1 (vanilla HTML, CSS and JS, no libraries)
(function () {
  "use strict";

  const FAV_KEY = "alderbrook.favourites";
  const DATA_URL = "data/animals.json";
  const page = document.body.dataset.page || "";

  // ---------- Service worker (offline support) ----------
  if ("serviceWorker" in navigator) {
    // When a new version takes over, reload once so the page shows it straight away.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .catch((err) => console.warn("Service worker registration failed:", err));
    });
  }

  // ---------- Install button (beforeinstallprompt) ----------
  let deferredPrompt = null;
  const installSlot = document.getElementById("install-slot");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (!installSlot || installSlot.querySelector("button")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button";
    btn.textContent = "Install app";
    btn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.remove();
    });
    installSlot.appendChild(btn);
  });

  window.addEventListener("appinstalled", () => {
    if (installSlot) installSlot.textContent = "Thanks for installing the app!";
  });

  // ---------- Favourites (localStorage, always wrapped in try/catch) ----------
  function getFavourites() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function setFavourites(list) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("Could not save favourites on this device:", err);
    }
  }

  function isFavourite(id) {
    return getFavourites().includes(id);
  }

  function toggleFavourite(id) {
    const list = getFavourites();
    const index = list.indexOf(id);
    if (index === -1) list.push(id);
    else list.splice(index, 1);
    setFavourites(list);
    return index === -1;
  }

  // ---------- Connectivity (Network Information API with fallbacks) ----------
  function updateConnectivity() {
    const banner = document.getElementById("connectivity");
    if (!banner) return;

    const conn = navigator.connection;
    const offline = !navigator.onLine;
    const slow = Boolean(conn && (conn.saveData || /2g/.test(conn.effectiveType || "")));

    if (offline) {
      banner.textContent = "You're offline. Pages you have already visited still work.";
      banner.hidden = false;
    } else if (slow) {
      banner.textContent = "Your connection looks slow, so pictures may take a moment to load.";
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  window.addEventListener("online", updateConnectivity);
  window.addEventListener("offline", updateConnectivity);
  if (navigator.connection) navigator.connection.addEventListener("change", updateConnectivity);

  // ---------- Data (external JSON file) ----------
  let animalsCache = null;

  async function loadAnimals() {
    if (animalsCache) return animalsCache;
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      animalsCache = Array.isArray(json.animals) ? json.animals : [];
    } catch (err) {
      console.warn("Could not load animal data:", err);
      animalsCache = [];
    }
    return animalsCache;
  }

  // ---------- DOM helpers (textContent only, no innerHTML) ----------
  function emptyMessage(text) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = text;
    return p;
  }

  // Optimised WebP versions made by tools/make-images.py, with the JPEG as the fallback.
  //  "card":   one 4:3 crop at two sizes, so phones download the smaller file.
  //  "detail": art direction: a tight square crop on phones, a wider 3:2 crop
  //            showing more habitat on tablets.
  function makeImage(animal, kind = "card") {
    const base = animal.image.replace(/\.jpg$/, "");
    const picture = document.createElement("picture");

    const addSource = (name, widths, sizes, media) => {
      const source = document.createElement("source");
      source.type = "image/webp";
      source.srcset = widths.map((w) => `${base}-${name}-${w}.webp ${w}w`).join(", ");
      source.sizes = sizes;
      if (media) source.media = media;
      picture.appendChild(source);
    };

    const img = document.createElement("img");
    img.src = animal.image;
    img.alt = animal.alt;

    if (kind === "detail") {
      addSource("wide", [800, 1200], "50vw", "(min-width: 768px)");
      addSource("square", [480, 960], "100vw");
      img.width = 960;
      img.height = 960;
      img.fetchPriority = "high";
    } else {
      addSource("card", [400, 800], "(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw");
      img.width = 800;
      img.height = 600;
      img.loading = "lazy";
    }

    img.addEventListener("error", () => {
      picture.querySelectorAll("source").forEach((s) => s.remove());
      img.src = "images/placeholder.svg";
    }, { once: true });

    picture.appendChild(img);
    return picture;
  }

  // Photo credit, required by the Creative Commons licences.
  function makeCredit(credit) {
    const caption = document.createElement("figcaption");
    caption.className = "detail-image__credit";

    const photo = document.createElement("a");
    photo.href = credit.source;
    photo.rel = "noopener noreferrer";
    photo.target = "_blank";
    photo.textContent = "Photo";

    const licence = document.createElement("a");
    licence.href = credit.licenseUrl;
    licence.rel = "noopener noreferrer";
    licence.target = "_blank";
    licence.textContent = credit.license;

    caption.append(photo, ` by ${credit.author}, `, licence);
    return caption;
  }

  function makeFavButton(id, name) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fav-button";

    const paint = () => {
      const on = isFavourite(id);
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "★ Saved" : "☆ Save";
      btn.setAttribute("aria-label", `${on ? "Remove" : "Save"} ${name} ${on ? "from" : "to"} favourites`);
    };

    btn.addEventListener("click", () => {
      toggleFavourite(id);
      paint();
      document.dispatchEvent(new CustomEvent("favourites:changed"));
    });

    paint();
    return btn;
  }

  function makeCard(animal) {
    const article = document.createElement("article");
    article.className = "animal-card";

    const detailUrl = `animal.html?id=${encodeURIComponent(animal.id)}`;

    const imageLink = document.createElement("a");
    imageLink.href = detailUrl;
    imageLink.appendChild(makeImage(animal));

    const body = document.createElement("div");
    body.className = "animal-card__body";

    const heading = document.createElement("h2");
    const titleLink = document.createElement("a");
    titleLink.href = detailUrl;
    titleLink.textContent = animal.name;
    heading.appendChild(titleLink);

    const latin = document.createElement("p");
    latin.className = "animal-card__latin";
    latin.textContent = animal.latin;

    const summary = document.createElement("p");
    summary.textContent = animal.summary;

    const actions = document.createElement("div");
    actions.className = "animal-card__actions";
    const status = document.createElement("span");
    status.className = "tag";
    status.textContent = animal.status;
    actions.append(status, makeFavButton(animal.id, animal.name));

    body.append(heading, latin, summary, actions);
    article.append(imageLink, body);
    return article;
  }

  // ---------- Page: home ----------
  function renderHome() {
    const summary = document.getElementById("favourites-summary");
    const countText = document.getElementById("favourites-count");
    if (!summary || !countText) return;

    const count = getFavourites().length;
    if (count > 0) {
      countText.textContent = `You have saved ${count} animal${count === 1 ? "" : "s"}.`;
      summary.hidden = false;
    }
  }

  // ---------- Page: animal list ----------
  async function renderAnimalList() {
    const grid = document.getElementById("animal-grid");
    if (!grid) return;
    const animals = await loadAnimals();

    if (!animals.length) {
      grid.replaceChildren(emptyMessage("We could not load the animals just now. Please try again later."));
      return;
    }
    grid.replaceChildren(...animals.map(makeCard));
  }

  // ---------- Page: favourites ----------
  async function renderFavourites() {
    const container = document.getElementById("favourites-list");
    if (!container) return;
    const animals = await loadAnimals();

    const draw = () => {
      const saved = animals.filter((a) => isFavourite(a.id));
      if (!saved.length) {
        container.replaceChildren(
          emptyMessage("You have not saved any animals yet. Visit the Animals page and tap Save.")
        );
        return;
      }
      container.replaceChildren(...saved.map(makeCard));
    };

    draw();
    document.addEventListener("favourites:changed", draw);
  }

  // ---------- Page: animal detail (master / detail) ----------
  async function renderDetail() {
    const container = document.getElementById("animal-detail");
    if (!container) return;

    const id = new URLSearchParams(window.location.search).get("id");
    const animals = await loadAnimals();
    const animal = animals.find((a) => a.id === id);

    if (!animal) {
      container.replaceChildren(
        emptyMessage("We could not find that animal. Please go back to the Animals page.")
      );
      return;
    }

    document.title = `${animal.name} | Alder Brook Wildlife Centre`;
    const crumb = document.getElementById("crumb-name");
    if (crumb) crumb.textContent = animal.name;

    const wrap = document.createElement("div");
    wrap.className = "detail";

    const figure = document.createElement("figure");
    figure.className = "detail-image";
    figure.appendChild(makeImage(animal, "detail"));
    if (animal.credit) figure.appendChild(makeCredit(animal.credit));

    const info = document.createElement("div");

    const heading = document.createElement("h1");
    heading.textContent = animal.name;

    const latin = document.createElement("p");
    latin.className = "animal-card__latin";
    latin.textContent = animal.latin;

    const status = document.createElement("p");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = animal.status;
    status.appendChild(tag);

    const summary = document.createElement("p");
    summary.textContent = animal.summary;

    const habitat = document.createElement("p");
    habitat.textContent = `Where it lives: ${animal.habitat}.`;

    const mapLink = document.createElement("p");
    const mapAnchor = document.createElement("a");
    mapAnchor.className = "text-link";
    mapAnchor.href = `map.html?id=${encodeURIComponent(animal.id)}`;
    mapAnchor.textContent = "Find this animal on the map";
    mapLink.appendChild(mapAnchor);

    const source = document.createElement("p");
    const sourceLink = document.createElement("a");
    sourceLink.href = animal.source;
    sourceLink.rel = "noopener noreferrer";
    sourceLink.target = "_blank";
    sourceLink.textContent = "Read more at the source (opens in a new tab)";
    source.appendChild(sourceLink);

    info.append(
      heading,
      latin,
      status,
      summary,
      habitat,
      makeFavButton(animal.id, animal.name),
      mapLink,
      source
    );

    wrap.append(figure, info);
    container.replaceChildren(wrap);
  }

  // ---------- Page: map (SVG schematic, no libraries) ----------
  const SVG_NS = "http://www.w3.org/2000/svg";

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function renderMap() {
    const svg = document.getElementById("map-svg");
    const list = document.getElementById("map-list");
    const locateBtn = document.getElementById("locate-button");
    const status = document.getElementById("locate-status");
    if (!svg || !list || !locateBtn || !status) return;

    loadAnimals().then((animals) => {
      if (!animals.length) {
        list.replaceChildren(emptyMessage("Map data is not available right now."));
        return;
      }

      const W = 600;
      const H = 600;
      const PAD = 60;
      const TILE = 256;
      const MAX_ZOOM = 17;

      // Web Mercator: the pixel position of a coordinate at zoom z, as OpenStreetMap tiles use.
      const toWorld = (lat, lng, z) => {
        const size = TILE * 2 ** z;
        const s = Math.sin((lat * Math.PI) / 180);
        return {
          x: ((lng + 180) / 360) * size,
          y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size
        };
      };

      const lats = animals.map((a) => a.location.lat);
      const lngs = animals.map((a) => a.location.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // The closest zoom that still fits every animal, centred on them.
      let zoom = MAX_ZOOM;
      while (zoom > 1) {
        const nw = toWorld(maxLat, minLng, zoom);
        const se = toWorld(minLat, maxLng, zoom);
        if (se.x - nw.x <= W - 2 * PAD && se.y - nw.y <= H - 2 * PAD) break;
        zoom -= 1;
      }
      const nw = toWorld(maxLat, minLng, zoom);
      const se = toWorld(minLat, maxLng, zoom);
      const originX = (nw.x + se.x) / 2 - W / 2;
      const originY = (nw.y + se.y) / 2 - H / 2;

      // Map a coordinate onto the SVG. Points off the map are clamped to the edge.
      const project = (lat, lng) => {
        const p = toWorld(lat, lng, zoom);
        return {
          x: Math.min(Math.max(p.x - originX, 12), W - 12),
          y: Math.min(Math.max(p.y - originY, 12), H - 12)
        };
      };

      // OpenStreetMap tiles covering the map. Offline, the plain background shows instead.
      const makeTiles = () => {
        const group = document.createElementNS(SVG_NS, "g");
        group.setAttribute("clip-path", "url(#map-clip)");
        const count = 2 ** zoom;
        for (let tx = Math.floor(originX / TILE); tx * TILE < originX + W; tx++) {
          for (let ty = Math.floor(originY / TILE); ty * TILE < originY + H; ty++) {
            if (ty < 0 || ty >= count) continue;
            const img = document.createElementNS(SVG_NS, "image");
            const wrappedX = ((tx % count) + count) % count;
            img.setAttribute("href", `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`);
            img.setAttribute("x", String(tx * TILE - originX));
            img.setAttribute("y", String(ty * TILE - originY));
            // Half a pixel of overlap hides hairline seams between tiles.
            img.setAttribute("width", String(TILE + 0.5));
            img.setAttribute("height", String(TILE + 0.5));
            group.appendChild(img);
          }
        }
        return group;
      };

      // Draw the animal pins, and the user's position if we have it.
      const draw = (userPos) => {
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        const shapes = [];

        const bg = document.createElementNS(SVG_NS, "rect");
        bg.setAttribute("class", "map-bg");
        bg.setAttribute("x", "4");
        bg.setAttribute("y", "4");
        bg.setAttribute("width", String(W - 8));
        bg.setAttribute("height", String(H - 8));
        bg.setAttribute("rx", "12");

        const defs = document.createElementNS(SVG_NS, "defs");
        const clip = document.createElementNS(SVG_NS, "clipPath");
        clip.setAttribute("id", "map-clip");
        clip.appendChild(bg.cloneNode());
        defs.appendChild(clip);

        const frame = bg.cloneNode();
        frame.setAttribute("class", "map-frame");
        shapes.push(defs, bg, makeTiles(), frame);

        // Labels go beside, above or below the pin: the first spot that stays on the map
        // and clears the other labels and pins.
        const LABEL_H = 15;
        const pins = animals.map((a) => project(a.location.lat, a.location.lng));
        const placed = pins.map(({ x, y }) => ({ x1: x - 10, y1: y - 10, x2: x + 10, y2: y + 10 }));
        const overlaps = (b) =>
          placed.some((p) => b.x1 < p.x2 && b.x2 > p.x1 && b.y1 < p.y2 && b.y2 > p.y1);
        const placeLabel = (x, y, text) => {
          const w = text.length * 7.5;
          const spots = [
            { lx: x + 14, ly: y + 4, anchor: "start", x1: x + 14, x2: x + 14 + w, y1: y - 6 },
            { lx: x - 14, ly: y + 4, anchor: "end", x1: x - 14 - w, x2: x - 14, y1: y - 6 },
            { lx: x, ly: y - 16, anchor: "middle", x1: x - w / 2, x2: x + w / 2, y1: y - 26 },
            { lx: x, ly: y + 24, anchor: "middle", x1: x - w / 2, x2: x + w / 2, y1: y + 14 }
          ].map((s) => ({ ...s, y2: s.y1 + LABEL_H }));
          const fits = (s) => s.x1 >= 8 && s.x2 <= W - 8 && s.y1 >= 8 && s.y2 <= H - 8;
          const spot =
            spots.find((s) => fits(s) && !overlaps(s)) || spots.find(fits) || spots[0];
          placed.push(spot);
          return spot;
        };

        animals.forEach((animal, i) => {
          const { x, y } = pins[i];

          const link = document.createElementNS(SVG_NS, "a");
          link.setAttribute("href", `animal.html?id=${encodeURIComponent(animal.id)}`);
          link.setAttribute("tabindex", "0");
          link.setAttribute("aria-label", `${animal.name}, ${animal.location.zone}`);

          const pin = document.createElementNS(SVG_NS, "circle");
          pin.setAttribute("class", "pin");
          pin.setAttribute("cx", String(x));
          pin.setAttribute("cy", String(y));
          pin.setAttribute("r", "10");

          const label = document.createElementNS(SVG_NS, "text");
          label.setAttribute("class", "label");
          const spot = placeLabel(x, y, animal.name);
          label.setAttribute("x", String(spot.lx));
          label.setAttribute("y", String(spot.ly));
          label.setAttribute("text-anchor", spot.anchor);
          label.textContent = animal.name;

          link.append(pin, label);
          shapes.push(link);
        });

        if (userPos) {
          const { x, y } = project(userPos.lat, userPos.lng);
          const dot = document.createElementNS(SVG_NS, "circle");
          dot.setAttribute("class", "me");
          dot.setAttribute("cx", String(x));
          dot.setAttribute("cy", String(y));
          dot.setAttribute("r", "7");
          const title = document.createElementNS(SVG_NS, "title");
          title.textContent = "You are here";
          dot.appendChild(title);
          shapes.push(dot);
        }

        svg.replaceChildren(...shapes);
      };

      const drawList = (userPos) => {
        const rows = animals.map((animal) => {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.href = `animal.html?id=${encodeURIComponent(animal.id)}`;
          link.textContent = animal.name;
          item.appendChild(link);

          const zone = document.createElement("span");
          zone.textContent = ` · ${animal.location.zone}`;
          item.appendChild(zone);

          let km = 0;
          if (userPos) {
            km = haversineKm(
              userPos.lat, userPos.lng, animal.location.lat, animal.location.lng
            );
            const dist = document.createElement("span");
            dist.textContent = ` · ${km.toFixed(1)} km away`;
            item.appendChild(dist);
          }
          return { item, km };
        });

        if (userPos) rows.sort((a, b) => a.km - b.km);
        list.replaceChildren(...rows.map((r) => r.item));
      };

      draw(null);
      drawList(null);

      locateBtn.addEventListener("click", () => {
        if (!("geolocation" in navigator)) {
          status.textContent = "Your device does not support location.";
          return;
        }
        status.textContent = "Finding you…";

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            draw(userPos);
            drawList(userPos);
            status.textContent = "Here is how far each animal is from you, nearest first.";
          },
          (err) => {
            status.textContent =
              err.code === 1
                ? "Location is blocked. You can allow it in your browser settings."
                : "We could not find your location. Please try again.";
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
      });
    });
  }

  // ---------- Start ----------
  updateConnectivity();

  switch (page) {
    case "home":
      renderHome();
      break;
    case "animals":
      renderAnimalList();
      break;
    case "animal":
      renderDetail();
      break;
    case "favourites":
      renderFavourites();
      break;
    case "map":
      renderMap();
      break;
    default:
      break;
  }
})();